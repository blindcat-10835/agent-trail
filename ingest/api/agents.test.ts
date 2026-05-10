/**
 * Agents API Tests — Param validation, IDENTITY.md parser, avatar endpoint
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { agentsRoutes } from './agents.js'
import { parseIdentityMarkdown } from '../parser/identity.js'
import { resolveAvatar } from './agents.js'

function createApp() {
  const app = new Hono()
  app.route('/', agentsRoutes)
  return app
}

// ---------------------------------------------------------------------------
// parseIdentityMarkdown tests
// ---------------------------------------------------------------------------

describe('parseIdentityMarkdown', () => {
  it('extracts Name, Creature, Vibe, Emoji, Avatar from markdown', () => {
    const md = `# IDENTITY.md - Blue | 基本面分析员

- **Name:** Blue
- **Creature:** 分析员
- **Vibe:** precise, methodical
- **Emoji:** 📊
- **Avatar:** avatar.webp
`
    const result = parseIdentityMarkdown(md)
    expect(result.name).toBe('Blue')
    expect(result.creature).toBe('分析员')
    expect(result.vibe).toBe('precise, methodical')
    expect(result.emoji).toBe('📊')
    expect(result.avatar).toBe('avatar.webp')
  })

  it('returns empty object for empty string', () => {
    const result = parseIdentityMarkdown('')
    expect(result).toEqual({})
  })

  it('handles lines without Key: Value format gracefully', () => {
    const md = `Some random text
no key value here
- **Name:** TestAgent
`
    const result = parseIdentityMarkdown(md)
    expect(result.name).toBe('TestAgent')
    expect(Object.keys(result)).toHaveLength(1)
  })

  it('extracts display name from H1 title when no Name field', () => {
    const md = `# IDENTITY.md - Mia | 基本面分析员

- **Creature:** 分析员
`
    const result = parseIdentityMarkdown(md)
    expect(result.name).toBe('Mia')
    expect(result.creature).toBe('分析员')
  })

  it('prefers explicit Name field over H1 title', () => {
    const md = `# IDENTITY.md - DisplayName | Role

- **Name:** ActualName
`
    const result = parseIdentityMarkdown(md)
    expect(result.name).toBe('ActualName')
  })
})

// ---------------------------------------------------------------------------
// GET /api/v1/agents — param validation
// ---------------------------------------------------------------------------

describe('GET /api/v1/agents — param validation', () => {
  it('should return 400 when source is missing', async () => {
    const app = createApp()
    const res = await app.request('/api/v1/agents')
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('source')
  })

  it('should return 400 for invalid source', async () => {
    const app = createApp()
    const res = await app.request('/api/v1/agents?source=invalid')
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// GET /api/v1/agents/:name/avatar — route-level tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/agents/:name/avatar', () => {
  it('returns 400 for path traversal agent name', async () => {
    const app = createApp()
    const res = await app.request('/api/v1/agents/..%2Fetc/avatar')
    expect(res.status).toBe(400)
  })

  it('returns 400 for agent name with invalid characters', async () => {
    const app = createApp()
    const res = await app.request('/api/v1/agents/a%20b/avatar')
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// resolveAvatar — unit tests (no os.homedir mocking needed)
// ---------------------------------------------------------------------------

describe('resolveAvatar', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avatar-test-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  function setupWorkspace(agentName: string, identityContent: string | null, avatarFileName?: string, avatarData?: Buffer) {
    const suffix = agentName === 'main' ? 'workspace' : `workspace-${agentName}`
    const workspaceDir = path.join(tempDir, '.openclaw', suffix)
    fs.mkdirSync(workspaceDir, { recursive: true })
    if (identityContent !== null) {
      fs.writeFileSync(path.join(workspaceDir, 'IDENTITY.md'), identityContent, 'utf-8')
    }
    if (avatarFileName && avatarData) {
      fs.writeFileSync(path.join(workspaceDir, avatarFileName), avatarData)
    }
    return workspaceDir
  }

  it('returns null when workspace dir does not exist', () => {
    expect(resolveAvatar('nonexistent', tempDir)).toBeNull()
  })

  it('returns null when IDENTITY.md is missing', () => {
    setupWorkspace('noagent', null)
    expect(resolveAvatar('noagent', tempDir)).toBeNull()
  })

  it('returns null when IDENTITY.md has no Avatar field', () => {
    setupWorkspace('testagent', `# IDENTITY.md - TestAgent\n- **Name:** TestAgent\n`)
    expect(resolveAvatar('testagent', tempDir)).toBeNull()
  })

  it('returns null when avatar file does not exist', () => {
    setupWorkspace('testagent', `# IDENTITY.md\n- **Avatar:** missing.webp\n`)
    expect(resolveAvatar('testagent', tempDir)).toBeNull()
  })

  it('returns null for path traversal in avatar filename', () => {
    const fakeImage = Buffer.from([0x00])
    // Create a secret file outside workspace
    const secretDir = path.join(tempDir, '.openclaw', 'secret')
    fs.mkdirSync(secretDir, { recursive: true })
    fs.writeFileSync(path.join(secretDir, 'secret.txt'), 'sensitive')

    setupWorkspace('testagent', `# IDENTITY.md\n- **Avatar:** ../secret/secret.txt\n`, 'ignored', fakeImage)
    expect(resolveAvatar('testagent', tempDir)).toBeNull()
  })

  it('returns image with correct MIME type for .webp', () => {
    const fakeImage = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])
    setupWorkspace('testagent', `# IDENTITY.md\n- **Avatar:** avatar.webp\n`, 'avatar.webp', fakeImage)
    const result = resolveAvatar('testagent', tempDir)
    expect(result).not.toBeNull()
    expect(result!.mime).toBe('image/webp')
    expect(result!.data).toEqual(fakeImage)
  })

  it('returns image/png for .png avatar files', () => {
    const fakeImage = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    setupWorkspace('agentpng', `# IDENTITY.md\n- **Avatar:** pic.png\n`, 'pic.png', fakeImage)
    const result = resolveAvatar('agentpng', tempDir)
    expect(result).not.toBeNull()
    expect(result!.mime).toBe('image/png')
    expect(result!.data).toEqual(fakeImage)
  })

  it('resolves "main" agent to workspace/ (no suffix)', () => {
    const fakeImage = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    // Should create ~/.openclaw/workspace/ not workspace-main/
    setupWorkspace('main', `# IDENTITY.md\n- **Avatar:** avatar.png\n`, 'avatar.png', fakeImage)
    const result = resolveAvatar('main', tempDir)
    expect(result).not.toBeNull()
    expect(result!.mime).toBe('image/png')
    expect(result!.data).toEqual(fakeImage)
    // Verify the directory was created at workspace/ not workspace-main/
    expect(fs.existsSync(path.join(tempDir, '.openclaw', 'workspace', 'IDENTITY.md'))).toBe(true)
    expect(fs.existsSync(path.join(tempDir, '.openclaw', 'workspace-main'))).toBe(false)
  })
})
