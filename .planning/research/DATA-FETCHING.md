# OVAO 数据获取架构

**研究日期:** 2025-05-02
**范围:** `gateway/`、`stores/gateway/`、`server/`、`lib/` 中所有数据获取相关代码

---

## 总览

OVAO 的数据获取架构基于 **WebSocket RPC + 实时事件流** 的双通道模型，通过一个服务端反向代理将浏览器与 OpenClaw Gateway 连通：

```
浏览器 (OVAO UI)
   ↕ WebSocket (/gateway-ws)
Next.js Server (server/index.mjs)
   ↕ WebSocket (ws://gateway:18789)
OpenClaw Gateway
```

**两条数据通道：**

| 通道 | 方向 | 用途 | 代码入口 |
|------|------|------|----------|
| **RPC 请求/响应** | 客户端 → Gateway → 客户端 | 查询快照数据、执行操作 | `gateway/rpc-client.ts` |
| **事件流** | Gateway → 客户端（单向推送） | Agent 实时状态变更、日志、工具调用 | `gateway/event-parser.ts` |

---

## 1. 服务端 WebSocket 反向代理

**文件:** `server/index.mjs`

浏览器不直接连接 Gateway。Next.js 自定义服务器在 `/gateway-ws` 路径上提供 WebSocket 代理，核心职责：

1. **认证注入** — 拦截客户端的 `connect` RPC 帧，注入 `auth.token`（从配置文件读取），客户端永远不接触 token
2. **双向透传** — 其他所有帧在浏览器 ↔ Gateway 之间原样转发
3. **连接生命周期** — 任一侧断开时清理对侧连接

**Gateway 配置发现优先级（`readGatewayConfig()`）：**

```
1. 项目配置: .ovao-config.json（gatewayUrl + gatewayToken）
2. 环境变量: GATEWAY_URL / GATEWAY_TOKEN
3. 全局配置: ~/.openclaw/openclaw.json（从 gateway.port 推导 URL + gateway.auth.token）
4. 降级: NEXT_PUBLIC_GATEWAY_WS（无 auth，可能失败）
```

---

## 2. WebSocket 客户端

**文件:** `gateway/ws-client.ts`

`GatewayWsClient` 是一个单例类（模块级 `wsClient`），管理 WebSocket 连接的完整生命周期：

### 2.1 连接流程

```
connect()
  → 构造 WS URL: ws(s)://{host}/gateway-ws
  → new WebSocket(url)
  → 收到 "connect.challenge" 事件
  → sendConnect(): 发送 connect RPC（method: "connect"）
  → 收到 hello-ok 响应
  → 连接成功，触发 status → "connected"
```

### 2.2 握手参数 (`sendConnect()`)

```typescript
{
  minProtocol: 1,
  maxProtocol: 3,
  client: { id: "openclaw-control-ui", version: "0.1.0", platform: "web", mode: "ui" },
  caps: ["tool-events"],
  scopes: ["operator.admin"],
}
```

### 2.3 断线重连

- 指数退避：`1000ms × 2^attempt`，上限 30000ms，加随机抖动 ≤1000ms
- 最大重连 20 次
- 收到 `shutdown` 事件时不再重连

### 2.4 帧分发

收到消息后按 `type` 字段分发：

| `type` | 处理 |
|--------|------|
| `"event"` | 事件名 → `eventHandlers`，支持 `"*"` 通配符 |
| `"res"` | `id` → `responseHandlers`（一次性消费） |

---

## 3. RPC 客户端

**文件:** `gateway/rpc-client.ts`

`GatewayRpcClient` 封装请求-响应模式，基于 WebSocket 帧的 `id` 字段做关联：

```typescript
rpc.request<T>(method, params?, timeoutMs?)
```

**机制：**
1. 生成 `crypto.randomUUID()` 作为请求 ID
2. 注册一次性 `onResponse(id, handler)` 回调
3. 发送 `{ type: "req", id, method, params }` 帧
4. 等待 `{ type: "res", id, ok, payload/error }` 帧
5. 默认超时 10 秒，超时抛 `RpcError("TIMEOUT")`

**错误类型 `RpcError`：**
- `NOT_CONNECTED` — WebSocket 未连接
- `TIMEOUT` — 响应超时
- Gateway 返回的 `error.code` — 如权限不足、方法不存在等

---

## 4. Dashboard 数据获取（连接后批量 RPC）

**文件:** `stores/gateway/gateway-store.ts` → `fetchDashboardData()`

WebSocket 连接成功后，立即并发发送 **7 个 RPC 请求** 拉取所有 Dashboard 数据：

```typescript
Promise.allSettled([
  rpc.request("agents.list"),         // Agent 列表 + 默认 Agent
  rpc.request("sessions.list"),       // 活跃会话列表
  rpc.request("skills.status"),       // Skill 列表
  rpc.request("cron.list"),           // 定时任务列表
  rpc.request("channels.status", { probe: true }), // Channel 连接状态
  rpc.request("usage.status"),        // 用量概览（Provider 级别）
  rpc.request("usage.detail"),        // 用量详情（Token/Cost）
])
```

使用 `Promise.allSettled`（而非 `Promise.all`），单个请求失败不影响其他数据的加载。

### 4.1 各 RPC 方法详情

| 方法 | Gateway 响应类型 | OVAO 转换 | 存储位置 |
|------|-------------------|-----------|----------|
| `agents.list` | `AgentsListResponse` | 提取 identity、计算 displayName、构建 avatarUrl | `state.agents` (Map) |
| `sessions.list` | `SessionInfo[]` 或 `{ sessions: SessionInfo[] }` | 计数活跃会话 + 构建 sessionKey→agentId 映射 | `state.activeSessions` + 内部 `sessionKeyMap` |
| `skills.status` | `{ skills: GatewaySkillEntry[] }` | 过滤 disabled、映射为 `SkillInfo[]` | `state.skills` |
| `cron.list` | `{ jobs: CronTask[] }` | 直传 | `state.cronTasks` |
| `channels.status` | `{ channelAccounts, channelLabels }` | 展平为 `ChannelInfo[]`，推导 status | `state.channels` |
| `usage.status` | `{ providers: UsageProviderInfo[] }` | 直传 | `state.providers` |
| `usage.detail` | `UsageDetailSnapshot` | 直传 | `state.usageDetail` |

### 4.2 Avatar URL 构建

Agent 的 `avatarUrl` 通过 Gateway HTTP 端点构建（而非 RPC 返回）：

```typescript
gatewayHttpBase = derive from NEXT_PUBLIC_GATEWAY_WS (ws→http)
avatarUrl = `${gatewayHttpBase}/avatar/${encodeURIComponent(agentId)}`
```

---

## 5. 实时事件流

### 5.1 Agent 事件帧结构

Gateway 推送的 Agent 事件帧：

```typescript
{
  type: "event",
  event: "string",           // 事件名（Gateway 决定）
  payload: AgentEventPayload // 结构化载荷
}

interface AgentEventPayload {
  runId: string;          // 运行 ID
  seq: number;            // 序号
  stream: AgentStream;    // "lifecycle" | "tool" | "assistant" | "error"
  ts: number;             // 时间戳
  data: Record<string, unknown>;
  sessionKey?: string;
}
```

### 5.2 事件解析 (`gateway/event-parser.ts`)

每种 `stream` 映射到不同的 UI 状态：

| stream | 解析函数 | 状态 | 日志类型 |
|--------|----------|------|----------|
| `lifecycle` | `parseLifecycle` | phase=start/thinking → `working`; phase=end → `idle`; fallback/error → `error` | `lifecycle` |
| `tool` | `parseTool` | phase=start → `tool_calling`; 否则 → `working` | `tool` |
| `assistant` | `parseAssistant` | `speaking`（提取文本内容） | `assistant` |
| `error` | `parseError` | `error` | `error` |

### 5.3 Agent 归属路由 (`stores/gateway/agent-event-routing.ts`)

收到事件后需要确定它属于哪个 Agent。多级回退策略：

```
1. payload.data.agentId 直接指定 → 直接用
2. runIdMap 缓存命中（同一 runId 之前的事件已经关联）→ 用缓存的 agentId
3. sessionKeyMap 缓存命中 → 优选 isDefault=true 的 Agent
4. sessionKey 模式匹配: "agent:{name}:..." → 按 name 模糊匹配
5. 全部未命中 → 触发 100ms 防抖重拉 sessions.list，重建映射
```

### 5.4 事件去重

使用 `seenEventKeys` 集合（FIFO，上限 5000），key 格式：
- 有 seq: `{runId}|{stream}|seq:{seq}`
- 无 seq: `{runId}|{stream}|noseq:{ts}|{dataSignature}`

### 5.5 终态事件保护

Agent 的 lifecycle `end` 事件进入 `terminatedRunIds` 集合（上限 1000），后续同一 `runId` 的事件不再覆盖 Agent 状态，但仍记入日志。

---

## 6. 数据合并与状态管理

### 6.1 RPC 数据与实时状态合并 (`stores/gateway/rpc-agent-merge.ts`)

RPC 刷新的 Agent 数据与运行时实时状态做智能合并：

```typescript
// 运行时非 idle 状态优先于 RPC idle 状态
status = runtime.status !== "idle" && rpc.status === "idle"
  ? runtime.status
  : rpc.status;

// RPC avatar 优先，否则保留运行时 fallback
avatarUrl = rpc.avatarUrl ?? runtime.avatarUrl ?? null;
```

### 6.2 连接时快照种子 (`stores/gateway/snapshot-seed.ts`)

WebSocket 握手成功后，Gateway 在 `hello-ok` 响应中携带 `snapshot.health.agents` 作为初始种子，在 RPC 批量请求返回前提供基本 Agent 列表。

### 6.3 本地快照缓存 (`lib/dashboard-snapshot-cache.ts`)

连接成功后，Dashboard 数据快照写入 `localStorage`（TTL 5 分钟）。下次页面加载时：
1. 先从缓存恢复（stale-while-revalidate 模式）
2. WebSocket 连接后用新数据覆盖

---

## 7. 写操作（RPC 调用）

当前只有一个写操作：

### `agents.update`

```typescript
rpcClient.request("agents.update", {
  agentId: string,
  avatar: string | null,
});
```

通过 `useGatewayStore().updateAgentAvatar()` 调用，更新 Agent 头像后立即更新本地状态。

---

## 8. 静态数据 / 无 Gateway 降级

**配置:** `lib/gateway-config.ts` 读写 `.ovao-config.json`，存储 Gateway URL 和 Token。

**无 Gateway 时：**
- UI 显示 `connectionStatus: "disconnected"`
- 各 selector 通过 `connectionUIState()` 返回 `disconnected` / `loading` 状态
- Dashboard 使用缓存快照（如果有）展示 stale 数据

---

## 9. 完整数据流时序

```
页面加载
  → hydrateFromCache() — 从 localStorage 恢复 stale 数据
  → init()
    → ws.connect()
    → 收到 connect.challenge → sendConnect()
    → 收到 hello-ok
      → buildSeededAgentsMap() — 从 hello-ok.snapshot 提取种子 Agent
      → fetchDashboardData() — 7 个并发 RPC
      → writeDashboardSnapshot() — 写入 localStorage
      → store 更新，UI 渲染

实时阶段
  → ws.onEvent("*") — 订阅所有事件
  → handleAgentEvent(payload)
    → resolveAgentId() — 多级回退归属
    → parseAgentEvent() — 解析状态
    → set() — 更新 agents / agentLogs / globalEventFeed / alertItems
    → UI 自动重渲染（Zustand selector）
```

---

## 10. 关键文件索引

| 文件 | 职责 |
|------|------|
| `server/index.mjs` | WebSocket 反向代理 + 认证注入 |
| `gateway/ws-client.ts` | WebSocket 连接管理、重连、帧分发 |
| `gateway/rpc-client.ts` | RPC 请求-响应封装 |
| `gateway/types.ts` | Gateway 协议帧类型定义 |
| `gateway/adapter-types.ts` | 业务领域类型（Channel, Skill, Cron 等） |
| `gateway/event-parser.ts` | Agent 事件 → UI 状态解析 |
| `stores/gateway/gateway-store.ts` | Zustand 主 store — 连接管理、数据获取、事件处理 |
| `stores/gateway/agent-event-routing.ts` | Agent ID 归属路由 |
| `stores/gateway/rpc-agent-merge.ts` | RPC 数据与实时状态合并 |
| `stores/gateway/log-reducer.ts` | Agent 日志追加/去重/assistant 文本合并 |
| `stores/gateway/snapshot-seed.ts` | 从 hello-ok 提取初始 Agent 列表 |
| `stores/gateway/run-terminal-guard.ts` | 终态事件保护 |
| `stores/gateway/p0-selectors.ts` | Dashboard P0 选择器（连接门控 + 状态映射） |
| `stores/gateway/p0-types.ts` | P0 数据契约类型 |
| `stores/gateway/p0-ui-state.ts` | P0 UI 状态枚举 |
| `stores/gateway/agent-display-name.ts` | Agent 显示名解析 |
| `stores/gateway/agent-avatar-cache.ts` | Avatar localStorage 缓存 |
| `lib/dashboard-snapshot-cache.ts` | Dashboard 快照 localStorage 缓存 |
| `lib/gateway-config.ts` | Gateway URL/Token 配置读写 |

---

## 总结

OVAO 的数据获取 **完全基于 WebSocket**，没有 REST/HTTP API 调用。数据通过两条通道获取：

1. **RPC（请求-响应）**：初始快照查询、写操作。Gateway 协议以 `{ type: "req", id, method, params }` / `{ type: "res", id, ok, payload }` 帧对实现。
2. **事件流（推送）**：Agent 实时状态变更。Gateway 以 `{ type: "event", event, payload }` 帧推送。

所有数据汇入单一的 Zustand store（`useGatewayStore`），通过 selector 层（`p0-selectors.ts`）向 UI 暴露，包含连接状态门控和 stale-while-revalidate 缓存策略。
