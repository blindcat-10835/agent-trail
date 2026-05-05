---
status: resolved
trigger: "检查当前 Dashboard 是否已经自动连接到本地 OpenClaw gateway。"
created: 2026-04-30T12:25:00+0800
updated: 2026-04-30T12:43:47+0800
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: 最终确认是双层问题：既缺少首次挂载时的 `init()` 调用，也缺少参考架构中的同源 `/gateway-ws` 代理，因此浏览器会先停在 `Disconnected`，修完入口后又因为 `origin` / `auth token` 校验停在 `Reconnecting`。
test: 先补上 shell 挂载时的 gateway bootstrap，再恢复同源 WebSocket 代理和 token 注入链路，用浏览器重新打开 `/dashboard` 观察最终状态。
expecting: 若修复完整，页面应从 `Disconnected` / `Reconnecting` 转为 `Gateway: Connected` 和 `WS CONNECTED`。
next_action: session complete

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: 打开应用后应自动连接本地 OpenClaw gateway，无需手动触发。
actual: 当前需要确认是否已经自动连接，用户尚未提供失败症状。
errors: 未提供。
reproduction: 启动 `npm dev`，打开 `/dashboard`，观察 gateway 连接状态。
started: 2026-04-30 当前会话中提出。

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-04-30T12:27:33+0800
  checked: `gateway/ws-client.ts`, `stores/gateway/gateway-store.ts`, `.env.local`
  found: WebSocket 默认地址会使用 `NEXT_PUBLIC_GATEWAY_WS=ws://localhost:18789`；`ws.connect()` 只在 store 的 `init()` 中触发。
  implication: 只要 `init()` 没有在页面首次挂载时被调用，就不会自动去连本地 gateway。

- timestamp: 2026-04-30T12:27:33+0800
  checked: repo-wide `init` usage search
  found: `useGatewayStore` 的 `init` 定义在 `stores/gateway/gateway-store.ts`，全仓库唯一调用点是 store 内部的 `reconnect()`，没有任何 `app/` 或 `components/` 代码在首次加载时调用它。
  implication: 当前实现没有自动连接入口。

- timestamp: 2026-04-30T12:27:33+0800
  checked: live `/dashboard` page in browser automation
  found: 页面正文包含 `OFFLINE`、`Gateway: Disconnected`、`WS DISCONNECTED`、`No agents found` 和 `Connect to Gateway to see agents`。
  implication: 运行中的 UI 明确表明当前没有连接上本地 OpenClaw gateway。

- timestamp: 2026-04-30T12:43:47+0800
  checked: direct WebSocket handshake against local gateway
  found: 连到本地 gateway 后先收到 `connect.challenge`，随后分别确认了两层拒绝原因：浏览器直连 `ws://localhost:18789` 会因为 `origin not allowed` 被拒，允许 origin 后又会因为 `AUTH_TOKEN_MISSING` 被拒。
  implication: 自动连接入口修好后，仍然必须恢复参考架构中的同源代理层，由代理改写 origin 并注入 token。

- timestamp: 2026-04-30T12:43:47+0800
  checked: reference project + local OpenClaw config
  found: 参考工程使用自定义 `server/index.ts` 代理 `/gateway-ws`；本机 `~/.openclaw/openclaw.json` 已包含可用于本地 gateway 的 token 模式配置。
  implication: 当前仓库可以通过自定义 server 复用本机 OpenClaw 配置，在不要求用户额外粘贴 token 的情况下恢复连接。

- timestamp: 2026-04-30T12:43:47+0800
  checked: live `/dashboard` after code changes
  found: 页面正文包含 `CONNECTED`、`Gateway: Connected`、`WS CONNECTED`，并显示 4 个 agents / 25 个 sessions；Next runtime `sessionErrors` 为空。
  implication: 自动连接和本地 gateway 握手链路已经恢复正常。

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: 当前仓库丢了参考实现里的两段关键链路：1) shell 首次挂载时没有调用 `useGatewayStore().init()`，所以自动连接根本不会启动；2) 客户端又被 `.env.local` 覆盖成直连 `ws://localhost:18789`，绕过了本应存在的同源 `/gateway-ws` 代理，导致浏览器被 gateway 的 origin 校验和 token 校验拒绝。
fix: 新增 `GatewayBootstrap` 在 shell 挂载时自动 `init()/disconnect()`；`GatewayWsClient` 恢复为固定连接同源 `/gateway-ws`；新增 `server/index.mjs` 自定义 Next server，在 `/gateway-ws` upgrade 时代理到真实 gateway、改写 origin、注入 token，并在没有 `.ovao-config.json` 时自动回退读取本机 `~/.openclaw/openclaw.json`；同时更新 `package.json` scripts 和 `.gitignore`。
verification: 对变更文件的 ESLint 通过；重启到新的自定义 dev server 后，实时打开 `http://localhost:3000/dashboard`，页面显示 `Gateway: Connected` 和 `WS CONNECTED`，Next runtime `sessionErrors` 为空。
files_changed:
  - app/(shell)/layout.tsx
  - components/hud/gateway-bootstrap.tsx
  - gateway/ws-client.ts
  - server/index.mjs
  - package.json
  - .gitignore
