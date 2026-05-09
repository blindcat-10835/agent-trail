# Agent Avatar Fetching — Design Spec

**Date:** 2026-05-10
**Status:** Draft

## Problem

OpenClaw agent cards show only a first-letter text glyph instead of the agent's actual avatar image. The avatar file path is defined in `~/.openclaw/workspace-{agentName}/IDENTITY.md` under the `Avatar:` field, but nothing reads or serves it.

## Current State

The pipeline is partially stubbed:

| Layer | Status |
|-------|--------|
| BFF proxy route `agents/[agentName]/avatar/route.ts` | Exists, proxies to ingest |
| Ingest endpoint `GET /api/v1/agents/:name/avatar` | **Missing** |
| IDENTITY.md parser | **Missing** |
| `lib/agent-avatar-utils.ts` utility | Exists, unused |
| `AgentAvatar` component | Text glyph only, no `<img>` |

## Architecture

Avatar images are served directly from the filesystem — no DB storage needed.

```
IDENTITY.md:  ~/.openclaw/workspace-{agentName}/IDENTITY.md
Avatar file:  ~/.openclaw/workspace-{agentName}/avatar.{webp,png,jpg,svg}
Agent name:   extracted from session path ~/.openclaw/agents/{agentName}/sessions/*.jsonl
```

The naming convention is consistent: agent `blue` → `workspace-blue`, agent `mia` → `workspace-mia`.

## Implementation

### 1. Ingest: IDENTITY.md Parser

New file `ingest/parser/identity.ts`:

- `parseIdentityMarkdown(content: string)` — extracts structured fields from IDENTITY.md
- Returns `{ name, creature, vibe, emoji, avatar }` (all optional strings)
- Parses the `- **Key:** Value` format using a simple regex per line
- Also extracts the agent display name from the H1 title line (e.g., `# IDENTITY.md - Blue | 基本面分析员`)

### 2. Ingest: Avatar Endpoint

New route in `ingest/api/agents.ts`:

`GET /api/v1/agents/:name/avatar`

Flow:
1. Resolve workspace dir: `~/.openclaw/workspace-{name}/`
2. Read `IDENTITY.md`, parse `Avatar:` field to get filename (e.g., `avatar.webp`)
3. Read the image file from `{workspaceDir}/{filename}`
4. Infer MIME type from extension (`webp` → `image/webp`, `png` → `image/png`, etc.)
5. Return image with `Content-Type` and `Cache-Control: public, max-age=3600`
6. On any error (no IDENTITY.md, no avatar field, file not found): return 404

### 3. Frontend: AgentAvatar Component

Update `components/dashboard/agent-avatar.tsx`:

- Try loading image from `/api/agent-tools/openclaw/agents/{agent.name}/avatar`
- On successful load: render `<img>` inside the existing circular container
- On error: fall back to current first-letter glyph
- Use `onError` handler on `<img>` to hide the image and show the fallback

### 4. AgentInfo Type Update

Add optional `emoji` field to `AgentInfo` in `types/trace.ts` for future emoji fallback support. The agents API endpoint will parse `Emoji:` from IDENTITY.md and include it in the response.

## Files Changed

| File | Change |
|------|--------|
| `ingest/parser/identity.ts` | **New** — IDENTITY.md parser |
| `ingest/api/agents.ts` | Add `GET /api/v1/agents/:name/avatar` route |
| `types/trace.ts` | Add `emoji?: string` to `AgentInfo` |
| `ingest/api/agents.ts` | Include `emoji` in agents list response |
| `components/dashboard/agent-avatar.tsx` | Add `<img>` with error fallback |
| `lib/agent-tools/client-hooks.tsx` | No change needed (already fetches AgentInfo) |

## Edge Cases

- **No workspace dir**: return 404 gracefully
- **IDENTITY.md missing**: return 404
- **Avatar field missing or empty**: return 404
- **Avatar file doesn't exist**: return 404
- **Non-image avatar file**: serve with inferred MIME type; browser handles gracefully
- **Agent name with path traversal**: validate agent name against `[a-z0-9_-]+` pattern before resolving filesystem path
