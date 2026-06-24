---
type: feat
title: Make local-session-search Skill Standalone-Installable
status: todo
priority: p3
created: 2026-06-25
branch:
worktree:
---

## Description

目前 `local-session-search` skill 只随仓库分发：canonical 源在 `.agents/skills/local-session-search/`，靠 `scripts/link-agents.sh` 软链到各工具目录。用户要用上它，必须 clone / 跑 agent-trail 才能拿到。

这个条目的目标是：**让这个 skill 可以被单独下载 / 安装**，理想情况下用户一条命令就能把它装进自己的编码 agent（Claude Code、Codex 等），而不需要先理解整个仓库结构。

**前提 / 边界**：这个 skill 是和 agent-trail **强耦合**的 —— 它本质上是"agent-trail ingest/BFF 接口的使用说明"，只有在本地跑着 ingest 服务、且 session 已被 ingest 的前提下才有用。所以"单独可下载"的真实受众是 **agent-trail 的用户**，不是泛用 skill 市场的随机访客。这一点决定了下面方案的取舍。

## 常见方案（调研记录）

1. **`npx skills`（Vercel Labs 的 skills CLI）**
   - `npx skills add <owner>/<repo>`，配套 `list / find / remove / update / init`，用 `.skills.json` + `skills-lock.json` 记录，装到 `.agents/skills/` 或 `.claude/skills/`（正好和本项目目录约定一致）。
   - ⚠️ 它只认**仓库根目录**的 `SKILL.md`，不支持子目录路径。我们的 skill 在 `.agents/skills/local-session-search/SKILL.md`（子目录），所以 `npx skills add camtrik/agent-trail` 找不到。两条出路：
     - **A1** 单独建一个小仓库（如 `camtrik/local-session-search`），根目录放 `SKILL.md` → `npx skills add camtrik/local-session-search` 直接可用，也能被 `npx skills find` 搜到。代价：源头和 `.agents/skills/` 分裂，需脚本/submodule 同步。
     - **A2** 不碰 `npx skills`，只在 README 写一条手动 copy/curl 安装片段。

2. **Claude Code 插件 + Marketplace（Anthropic 官方路子）**
   - 在**当前仓库**加 `.claude-plugin/marketplace.json`（+ 插件清单）指向 skills 目录 → 用户 `/plugin marketplace add camtrik/agent-trail` → `/plugin install …`。
   - 优点：Claude Code 原生 `/plugin` UI 可装、有版本管理、不用建第二个仓库，以后多 skill 可一起打包。代价：marketplace 期望 skills 在固定位置，可能要做个小适配指向 `.agents/skills/`。

3. **公共 skill 目录站（曝光/引流）**
   - agentskills.io、awesome-skills.com、tonsofskills.com（`ccpi` CLI）、lobehub/skills，或给 `anthropics/skills` 提 PR。
   - 价值：发现性。但脱离 agent-trail 这 skill 没法用，公共站访客会困惑。**建议等安装故事成熟后再做**，且更多是给 agent-trail 本身引流。

### 倾向

核心决策是 **单仓库插件（方案 2）** vs **拆出独立仓库（A1）**：前者保留 `.agents/skills/` 为唯一真源、走 Claude Code 原生流程；后者换取 `npx skills add` 的潮流式一行安装但要同步两份。当前倾向方案 2。公共注册站（方案 3）暂缓。

## Acceptance criteria

- [ ] 在方案 2（单仓库插件）/ A1（独立仓库）之间做出决定并记录理由。
- [ ] 用户可以用一条命令（`/plugin install …` 或 `npx skills add …`）把 skill 装进自己的编码 agent。
- [ ] `.agents/skills/local-session-search/` 仍是唯一真源；若拆仓库，需有同步机制避免两份漂移。
- [ ] README 三语（en/zh/ja）补充对应安装方式（遵守"多语言 README 同步"规则）。
- [ ] 明确并在文档里写清这个 skill 与 agent-trail ingest 服务的耦合前提。

## Related

- 实现该 skill 的条目：`_done/v0.1.7/agent-session-retrieval.md`
- 底层搜索 primitive：`_done/v0.1.7/global-session-search.md`
- skill 本体：`.agents/skills/local-session-search/SKILL.md`
- 同步脚本：`scripts/link-agents.sh`
- 调研来源：Claude Code skills docs（code.claude.com/docs/en/skills）、`npx skills`（Vercel Labs）、anthropics/skills、agentskills.io
