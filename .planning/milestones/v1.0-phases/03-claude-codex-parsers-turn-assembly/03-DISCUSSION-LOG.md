# Phase 3: Claude/Codex Parsers + Turn Assembly - Discussion Log

**Date:** 2026-05-06
**Mode:** interactive (default)

## Areas Discussed

### 1. Claude Code Parser

| # | Question | Options Presented | Selected | Notes |
|---|----------|-------------------|----------|-------|
| 1 | 如何处理 DAG/fork/continuation/streaming 去重/subagent？ | 完整支持 / 最小可行 / 仅消息流 | 完整支持 | 对齐 agentsview Go parser 行为 |
| 2 | Compact/system 边界怎么处理？ | 独立存储 / Turn 层过滤 / 合并 | 独立存储 | Compact 和 system message 作为独立 message，不合并 |
| 3 | Subagent 子会话怎么处理？ | 引用存储 / 内联 / 只存 ID | 引用存储 | 用户确认引用存储后可判断 session 是否为 subagent |
| 4 | Streaming 重复消息去重？ | UUID 去重 / 不处理 | UUID 去重 | 按 message UUID，保留第一个 |

### 2. Codex Parser

| # | Question | Options Presented | Selected | Notes |
|---|----------|-------------------|----------|-------|
| 1 | 直接用 turn_context 边界还是一一映射？ | 一一映射 / 统一组装 | 一一映射 | 确认 Codex turn_context 与 TraceTurn 一致 |
| 2 | spawn_agent 子会话处理？ | 引用存储 / 内联 | 引用存储 | 与 Claude subagent 策略一致 |

### 3. Turn Assembly Completeness

| # | Question | Options Presented | Selected | Notes |
|---|----------|-------------------|----------|-------|
| 1 | Compact/queued/system 边界处理深度？ | 完整处理 / 保持现状 | 完整处理 | Compact 前后独立存储，queued 合并，system 可选折叠 |
| 2 | Tool call/result 配对方式？ | assembler 配对 / parser 层配对 | assembler 配对 | 支持跨 turn 配对 |

### 4. Source Discovery

| # | Question | Options Presented | Selected | Notes |
|---|----------|-------------------|----------|-------|
| 1 | Claude/Codex 默认路径？ | 已知路径 / 你来指定 | 已知路径 | Claude: ~/.claude/sessions/, Codex: ~/.codex/sessions/ |
| 2 | Discovery 实现方式？ | 独立函数 / 统一函数 | 独立函数 | discoverClaudeSources / discoverCodexSources |

## Deferred Ideas

- Subagent inline UI — Phase 5
- Chokidar watcher — Phase 6
- SSE real push — Phase 6
- Full fixture regression — Phase 6

## the agent's Discretion

- Parser 内部实现细节（streaming vs batch）
- Parse error recovery 和 logging verbosity
- Fixture 选择
- Turn assembler flag 设计

---

*Phase: 03-claude-codex-parsers-turn-assembly*
*Discussion: 2026-05-06*
