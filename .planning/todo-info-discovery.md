# automations

## codex

### 本地文件发现记录

日期：2026-05-11

#### 背景

为第二阶段 UI 准备，确认 Codex 的 automation 信息是否存在本地可读取的文件落点，以及哪些内容适合直接用于 dashboard 的 `Automations` 卡片。

#### 已确认事实

##### 1. Codex 确实有本地 automations 目录

已确认目录存在：

- `~/.codex/automations`
- `~/.codex/automations/automation`

当前发现到的文件：

- `~/.codex/automations/automation/automation.toml`
- `~/.codex/automations/automation/memory.md`

##### 2. `automation.toml` 是 automation 定义文件

已确认 `automation.toml` 包含以下字段：

- `version`
- `id`
- `kind`
- `name`
- `prompt`
- `status`
- `rrule`
- `model`
- `reasoning_effort`
- `execution_environment`
- `cwds`
- `created_at`
- `updated_at`

当前样例表现为：

- `id = "automation"`
- `kind = "cron"`
- `name = "东京上海午夜查票"`
- `status = "PAUSED"`

这说明 Codex automation 的核心展示信息可以直接从本地 TOML 读取，不需要依赖 session 解析。

##### 3. `memory.md` 是每次自动化运行后的简短记忆/摘要

已确认 `memory.md` 中按时间追加运行记录，当前样例中已有：

- `2026-03-15 00:03:50 JST`
- `2026-03-16 00:02:20 JST`

每条记录包含：

- 本次读了哪些输入
- 做了哪些尝试
- 为什么失败或成功
- 更新了哪些输出文件

这类内容适合在 dashboard 中展示为：

- automation 最近一次做了什么
- 最近一次失败原因
- 最近一次输出落点

##### 4. Codex 自己的 session 指令文本也明确声明了存储位置

在 `~/.codex/sessions/**/*.jsonl` 中，Codex app context 明确写到：

- automations 存储在 `$CODEX_HOME/automations/<id>/automation.toml`
- `automation.toml` 保存 automation setup
- 运行时机状态（如 last/next run）不在 TOML 本身

这说明：

- `automation.toml` 适合做定义层数据源
- 运行调度状态可能需要另找来源，不能假设在 TOML 内

#### 对 Dashboard 的直接启发

如果要做 Codex 的 `Automations` 卡片，第一版建议直接读取：

1. `~/.codex/automations/*/automation.toml`
2. 同目录下的 `memory.md`（若存在）

第一版即可稳定展示：

- automation 名称
- 状态（如 `PAUSED` / `ACTIVE`）
- 调度规则（内部可保留 RRULE，前端再格式化）
- 运行 workspace（`cwds`）
- 使用模型
- 最近一次运行摘要

#### 当前未确认项

以下内容本次没有在本地文件中完成确认：

- `last_run_at`
- `next_run_at`
- 最近一次 run 的结构化 success/failure 状态字段
- 多个 automations 时是否一定是一目录一个 automation
- 是否存在额外 SQLite 或 app 内状态文件保存运行调度信息

其中最后一项虽然在 session 指令文本中被提到“run timing state lives in SQLite automations table”，但这次只确认了本地文件侧的落点，没有继续定位该 SQLite 位置。

#### 结论

Codex 的 automation 功能不是纯 UI 概念，而是有明确本地文件落点。

对当前项目而言，`Automations` 卡片至少可以先基于以下两个文件构建：

- `automation.toml`：定义与配置
- `memory.md`：最近运行摘要

因此，Codex automation 在第二阶段 UI 中是可做的，而且不必先依赖现有 ingest 数据库。
