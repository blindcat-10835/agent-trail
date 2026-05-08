# 测试 Fixture 与真实数据格式对比分析

**日期**: 2026-05-08  
**范围**: `tests/fixtures/claude/` 和 `tests/fixtures/codex/` 与实际 `~/.claude` / `~/.codex` 数据格式的差异

---

## Claude Code — 差异清单

### 1. Subagent / Fork 格式是虚构的（高严重度）

**Fixture 假设**（`subagent.jsonl`, `dag-fork.jsonl`）：
```json
{"uuid":"sub-1","type":"assistant","session":{"id":"child-sess","type":"subagent","parentId":"parent-sess"}}
```

**真实格式**：每个 JSONL 条目**不包含** `session` 字段。Claude Code 的子 agent 是独立的 JSONL 文件，无法通过单个文件内的字段感知父子关系。

**影响**：`parseClaudeSession` 中的 `if (parsed.session)` 分支永远不会被真实数据触发，subagent/fork 检测逻辑是死代码。

---

### 2. `"type":"compact"` 不存在于真实数据（高严重度）

**Fixture 假设**（`compact-boundary.jsonl`）：
```json
{"uuid":"compact-1","type":"compact","message":{"role":"system","content":"[compact] ..."}}
```

**真实格式**：没有 `"type":"compact"` 类型。Claude Code 的上下文压缩体现为 `"type":"file-history-snapshot"` 条目，结构完全不同，也没有 `truncatedUuids` 字段。

**影响**：`if (parsed.type === 'compact')` 分支永远不触发，compact 检测为死代码。

---

### 3. 工具调用结果（`tool_result`）未被提取（高严重度）

**Fixture 假设**：`tool-calls.jsonl` 只有 assistant 的 `tool_use`，没有对应的 user `tool_result` 消息。

**真实格式**：每个 `tool_use` 之后必然跟一个 `user` 类型消息，内容为：
```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [{"type":"tool_result","tool_use_id":"call_xxx","content":"...","is_error":false}]
  }
}
```

**影响**：`parseMessage()` 只提取 `type === 'text'` 的内容块，`tool_result` 块的内容被丢弃（变为空字符串）。工具调用结果无法与父 `tool_use` 关联。

---

### 4. UUID 流式去重在真实数据中不会触发（低严重度）

**Fixture 假设**（`streaming-dedup.jsonl`）：同一 UUID 的消息重复出现（模拟流式传输中间状态）。

**真实格式**：每个条目有唯一 UUID，Claude Code 写入 JSONL 时只写最终完整消息。

**影响**：UUID 去重逻辑本身没问题，但作为"流式去重"的测试场景与实际不符，测试验证的是一个不会发生的边界条件。

---

### 5. `thinking` 内容块被静默忽略（中严重度）

**真实格式**：assistant 消息的 `content` 数组中经常包含 `{type:"thinking", thinking:"..."}` 块（扩展思考模式下）。

**影响**：`parseMessage()` 只过滤 `type === 'text'`，thinking 块被丢弃，无法在 UI 中展示推理过程。

---

## Codex — 差异清单

### 1. `function_call_output` 在 `response_item` 中，不在 `event_msg` 中（**关键 Bug**）

**Fixture 假设**（`function-call.jsonl`）：
```json
{"type":"event_msg","event_msg":{"type":"function_call_output","call_id":"call_01","content":"...","status":"completed"}}
```

**真实格式**：
```json
{"type":"response_item","payload":{"type":"function_call_output","call_id":"call_xxx","output":"..."}}
```

**影响**：`parseCodexSession` 只在 `event_msg` 分支中处理 `function_call_output`，真实数据的工具调用结果全部被丢弃，工具调用永远停留在 `pending` 状态。这是**唯一真正的 Bug**，会导致所有真实 Codex session 的工具结果丢失。

---

### 2. `custom_tool_call` / `custom_tool_call_output` 未处理（高严重度）

**真实格式**（用于 `apply_patch` 等工具）：
```json
{"type":"response_item","payload":{"type":"custom_tool_call","call_id":"...","name":"apply_patch","input":"..."}}
{"type":"response_item","payload":{"type":"custom_tool_call_output","call_id":"...","output":"{...}"}}
```

**影响**：没有任何 fixture 覆盖此格式，parser 生成 "Skipping unknown response_item type" 警告，文件编辑类工具调用全部不可见。

---

### 3. `spawn_agent` 类型是虚构的（高严重度）

**Fixture 假设**（`spawn-agent.jsonl`）：
```json
{"type":"spawn_agent","spawn_agent":{"session_id":"child-sess-1","type":"spawned"}}
```

**真实格式**：Codex 没有 `spawn_agent` 类型的条目。子 agent 通过 `~/.codex/session_index.jsonl` 链接，不在会话内部标记。

**影响**：子 agent 链接检测是死代码。

---

### 4. 双格式兼容（已处理，无问题）

**Fixture 格式**（旧式）：
```json
{"type":"session_meta","session_meta":{"session_id":"s1"}}
{"type":"turn_context","turn_context":{"turn_id":"t1","model":"gpt-4"}}
```

**真实格式**（payload 封装）：
```json
{"type":"session_meta","payload":{"id":"...","cwd":"..."}}
{"type":"turn_context","payload":{"turn_id":"...","model":"..."}}
```

**状态**：Parser 已用 `parsed.xxx || parsed.payload` 双路访问，两种格式均可处理，✓ 正常。

---

### 5. `reasoning` / `web_search_call` 条目产生噪音警告（低严重度）

**真实格式**：真实 Codex session 包含大量 `response_item` 条目，`payload.type` 为 `"reasoning"`（GPT-5 推理 token）或 `"web_search_call"`，没有对应 fixture。

**影响**：每条生成 "Skipping unknown response_item type" 警告，日志噪音大，且推理过程不可见。

---

## 优先级总结

| 优先级 | 问题 | 来源 |
|--------|------|------|
| P0 🔴 | Codex `function_call_output` 位置错误 → 所有工具结果丢失 | codex parser |
| P1 🟠 | Claude `tool_result` 内容未提取 → 工具调用无结果数据 | claude parser |
| P1 🟠 | Codex `custom_tool_call` 未处理 → 文件编辑工具不可见 | codex parser |
| P2 🟡 | Claude/Codex subagent 检测逻辑是死代码（格式不符） | both parsers |
| P2 🟡 | Claude `compact` 类型在真实数据中不存在 | claude parser |
| P3 🟢 | Claude `thinking` 块被忽略 | claude parser |
| P3 🟢 | Codex `reasoning` / `web_search_call` 无处理，产生警告噪音 | codex parser |

---

## 建议下一步

1. **修 P0**：在 `ingest/parser/codex.ts` 的 `response_item` 分支中添加 `function_call_output` 和 `custom_tool_call_output` 的处理逻辑，同时补充 `custom_tool_call` 提取。

2. **修 P1（Claude）**：在 `parseMessage()` 中提取 `tool_result` 块的内容，并在工具调用配对阶段通过 `tool_use_id` 完成关联。

3. **更新 fixture**：用真实 `~/.codex/sessions/` 和 `~/.claude/projects/` 的实际片段替换或补充现有 fixture，确保测试覆盖真实格式。
