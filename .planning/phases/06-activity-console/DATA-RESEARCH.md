# Phase 6 & 7 数据获取研究

**研究日期**: 2026-05-02
**最后更新**: 2026-05-02 (修正：Next.js 参考项目也是文件系统访问)

---

## 核心结论

**两个参考项目都使用文件系统直读**，不依赖 Gateway HTTP API。

| 参考项目 | 数据获取方式 | 说明 |
|---------|------------|------|
| openclaw-dashboard-nextjs | **文件系统直读** (`fs.readFileSync`) | 读取 JSONL 文件 + CLI 进程流式 |
| openclaw-dashboard-html | **文件系统直读** | 读取 sessions.json + JSONL |

**OVAO 应采用相同方式：Next.js API Route + 文件系统直读。**

---

## Phase 6: Activity Console 数据获取

### 数据源 1: Cron 执行记录

- **文件路径**: `~/.openclaw/cron/runs/*.jsonl`
- **读取方式**: `fs.readFileSync()` + `fs.readdirSync()`
- **数据格式**: JSONL (每行一个 JSON 对象)
- **参考代码**: `openclaw-dashboard-nextjs/lib/logs.ts` — `getLogEntries()`

```json
{ "ts": 1773554773166, "jobId": "650f415e-...", "action": "finished",
  "status": "error", "error": "...", "summary": "...", "delivered": true,
  "deliveryStatus": "delivered", "sessionId": "e15a0f96-...",
  "runAtMs": 1773554400023, "durationMs": 373131, "nextRunAtMs": 1773640800000,
  "model": "MiniMax-M2.5", "provider": "minimax-portal",
  "usage": { "input_tokens": 307177, "output_tokens": 5766, "total_tokens": 54116 } }
```

**路径推导**: `path.resolve(WORKSPACE_PATH, '..', 'cron', 'runs')`

### 数据源 2: Config 审计日志

- **文件路径**: `~/.openclaw/logs/config-audit.jsonl`
- **读取方式**: `fs.readFileSync()`
- **数据格式**: JSONL
- **参考代码**: `openclaw-dashboard-nextjs/lib/logs.ts` — `parseConfigAuditLine()`

```json
{ "ts": "2026-03-02T10:41:27.138Z", "source": "config-io", "event": "config.write",
  "configPath": "/Users/ebbi/.openclaw/openclaw.json", "pid": 59045,
  "argv": ["...", "openclaw", "onboard", "--install-daemon"],
  "suspicious": [], "result": "rename" }
```

**路径推导**: `path.resolve(WORKSPACE_PATH, '..', 'logs', 'config-audit.jsonl')`

### 数据源 3: 实时日志流

- **获取方式**: `child_process.spawn('openclaw', ['logs', '--follow', '--json'])`
- **传输方式**: SSE (Server-Sent Events) 包裹 JSONL 输出
- **参考代码**: `openclaw-dashboard-nextjs/app/api/logs/stream/route.ts`

### 需要的环境变量

```bash
WORKSPACE_PATH=~/.openclaw/workspace       # 工作区路径 (用于推导数据目录)
OPENCLAW_BIN=/path/to/openclaw              # CLI 路径 (仅实时流需要)
```

### OVAO 实现方案

```
app/api/logs/route.ts          — 读取 cron runs + config audit JSONL
app/api/logs/stream/route.ts   — spawn openclaw logs --follow --json
lib/logs.ts                    — 解析和聚合逻辑
lib/types.ts                   — LogEntry / LogSummary / LogFilter 类型
```

---

## Phase 7: Sessions Dashboard 数据获取

### 数据源: 会话元数据 + 消息历史

- **会话元数据**: `~/.openclaw/agents/{AGENT_ID}/sessions/sessions.json`
- **消息历史**: `~/.openclaw/agents/{AGENT_ID}/sessions/*.jsonl`
- **读取方式**: `fs.readFileSync()`
- **参考代码**: `openclaw-dashboard-html/server.js` — `/api/sessions`, `/api/session-messages`

```json
// Session 元数据
{ "key": "main:main:project", "label": "Main Agent", "model": "anthropic/claude-opus-4-6",
  "totalTokens": 50000, "contextTokens": 200000, "kind": "main",
  "updatedAt": 1234567890, "aborted": false, "cost": 0.35, "lastMessage": "..." }

// 消息
{ "type": "message", "message": { "role": "assistant", "content": "...",
  "usage": { "tokensIn": 100, "tokensOut": 200 }, "model": "claude-opus-4-6" } }
```

### OVAO 实现方案

```
app/api/sessions/route.ts              — 读取 sessions.json
app/api/sessions/[key]/messages/route.ts — 读取 session JSONL
lib/sessions.ts                        — 解析和聚合逻辑
types/session.ts                       — SessionInfo / SessionMessage 类型
```

---

## Gateway RPC vs 文件系统对比

| 方面 | Gateway WebSocket RPC | 文件系统直读 |
|------|----------------------|------------|
| **数据完整性** | 低 — 只有部分数据 | 高 — 完整历史 |
| **实时性** | 高 — WS 事件推送 | 中 — 需轮询或 SSE |
| **实现复杂度** | 已有客户端 | 需新建 API Route |
| **依赖** | Gateway 必须在线 | 文件必须存在 |
| **参考验证** | 无参考 | 两个项目验证可行 |

### 推荐: 文件系统直读 + WebSocket 补充

- **主要数据**: 通过 Next.js API Route 读取文件系统
- **实时更新**: 复用现有 `agent.*` WebSocket 事件推送新活动通知
- **缓存**: Server Component 缓存 + 客户端 SWR

---

## OVAO 需要的配置变更

`.env.local` 新增:

```bash
# 现有 (保留)
NEXT_PUBLIC_API_BASE=http://localhost:8000
NEXT_PUBLIC_GATEWAY_WS=ws://localhost:18789

# 新增 — 文件系统数据访问
WORKSPACE_PATH=/Users/ebbi/.openclaw/workspace
OPENCLAW_BIN=openclaw  # 或完整路径
```

**注意**: `WORKSPACE_PATH` 是 server-side 环境变量，不加 `NEXT_PUBLIC_` 前缀，不会暴露到客户端。

---

## 风险

1. **低风险** — 文件系统访问在两个参考项目中都已验证可行
2. **低风险** — Gateway 是本地进程，文件一定在同机器上
3. **中风险** — 需要确保 `WORKSPACE_PATH` 正确配置
4. **低风险** — 实时流依赖 `openclaw` CLI，但这是可选功能
