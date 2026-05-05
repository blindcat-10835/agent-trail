# Requirements: OVAO

**Defined:** 2026-04-30
**Core Value:** Agent 状态实时可视化 — 用户一眼掌握所有 Agent 运行状态

## v1 Requirements

### 工程基础 (Engineering)

- [ ] **ENGR-01**: 项目脚手架配置（Next.js 16 + Tailwind v4 CSS-first + ESLint + shadcn/ui）
- [ ] **ENGR-02**: 设计令牌系统（HUD 语义化 CSS 变量，light/dark 双主题，WCAG AA 对比度验证）
- [ ] **ENGR-03**: Shell 布局（侧栏导航 + 主内容区 + 底部状态栏）
- [ ] **ENGR-04**: HUD 基础组件库（Card / Panel / StatusIndicator / Header / GlowEffect）

### Agent Dashboard

- [ ] **DASH-01**: Agent 状态网格（卡片布局展示所有 Agent 实时状态） ✅ Phase 4
- [ ] **DASH-02**: Agent 状态指示器（颜色编码：idle/working/tool_calling/speaking/error） ✅ Phase 4
- [ ] **DASH-03**: KPI 摘要条（活跃/工作中/错误 Agent 数量，Token 用量） ✅ Phase 4
- [ ] **DASH-04**: Gateway 连接状态指示器（在线/离线/重连中） ✅ Phase 4
- [ ] **DASH-05**: 搜索/筛选 Agent（按状态筛选、按名称搜索） ✅ Phase 4

### Office Layout

- [ ] **OFFC-01**: 2D 办公室平面图（Agent 在工位上的位置可视化）
- [ ] **OFFC-02**: Agent 位置交互（点击 Agent 查看状态/跳转工作区）

### Workspace 视图

- [ ] **WORK-01**: 单 Agent 详情视图（终端日志流 + 任务进度 + 能力信息） ✅ Phase 4
- [ ] **WORK-02**: 实时日志流（WebSocket 推送的彩色编码事件流） ✅ Phase 4

## v2 Requirements

### 设置与偏好

- **PREF-01**: 用户设置页面（主题切换、Gateway 配置、布局偏好）
- **PREF-02**: 自定义强调色（cyan/amber/green/purple/red 主题切换）
- **PREF-03**: 布局密度控制（紧凑/标准/宽松）

### 高级可视化

- **VIS-01**: Radar 雷达可视化（极坐标图展示 Agent 活跃度）
- **VIS-02**: 活跃度迷你图（每张 Agent 卡片内的近期活动 sparkline）
- **VIS-03**: 工具冷却进度条（tool_calling 状态下的动画进度条）

### 效率工具

- **UTIL-01**: Command Palette（⌘K 快速搜索和导航）
- **UTIL-02**: Provider/成本追踪（Token 用量、费用估算、模型分布）

## Out of Scope

| Feature | Reason |
|---------|--------|
| 3D 效果/WebGL | 性能开销大，无障碍性差，2D CSS 足够 |
| 音频通知 | 监控场景下干扰大，用视觉指示替代 |
| 拖拽面板 | 状态管理复杂，布局脆弱，用固定网格+密度切换 |
| 国际化 (i18n) | 当前只需中文界面，代码结构预留扩展即可 |
| 多 Gateway 管理 | 只连接单个 Gateway，不需要多实例管理 |
| Agent 配置编辑 | 只做可视化展示，不做编辑操作 |
| 认证/权限 | 单用户本地工具，无认证需求 |
| 移动端专门优化 | 桌面优先，响应式但不专门适配移动端 |
| 协作功能 | 监控工具，不是协作平台 |
| 游戏化 | 不适合专业工具场景 |

## Traceability

| Requirement | Milestone | Phase | Status |
|-------------|-----------|-------|--------|
| ENGR-01 | M1 | Phase 1 | Pending |
| ENGR-02 | M1 | Phase 2 | Pending |
| ENGR-03 | M1 | Phase 3 | Pending |
| ENGR-04 | M1 | Phase 3 | Pending |
| DASH-01 | M2 | Phase 4 | ✅ Complete |
| DASH-02 | M2 | Phase 4 | ✅ Complete |
| DASH-03 | M2 | Phase 4 | ✅ Complete |
| DASH-04 | M2 | Phase 4 | ✅ Complete |
| DASH-05 | M2 | Phase 4 | ✅ Complete |
| OFFC-01 | M3 | Phase 5 | Pending |
| OFFC-02 | M3 | Phase 5 | Pending |
| WORK-01 | M2 | Phase 4 | ✅ Complete |
| WORK-02 | M2 | Phase 4 | ✅ Complete |

**Coverage:**

- v1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-30*
*Last updated: 2026-04-30 after initial definition*
