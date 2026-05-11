## 整体设计

Terminal × HUD 的混合风格：主体是现代 dashboard，局部使用 terminal/log aesthetic，顶部或背景加入轻量 HUD 装饰。

所有tools，包含all的页面应该是一定程度上一一对应的。但是有微小的差别。
比如openclaw的Overview中可以有agents card：显示每个agents的icon等内容。

### 现在的设计
整体的布局需要保留，但是细节你可以自由设计。
顶部 Header：横向三栏。左侧是品牌 logo 和 "AGENTS TRACING" 标题；中间是 Source Switcher，用来在 Claude / OpenClaw / Codex 等数据源之间切换（可以有一些下拉或者延伸的方法获取更多source，也可以更改默认显示哪4个source）；右侧是几个操作按钮：手动 Sync、Light/Dark 主题切换、Right Rail 开关。
中间主区域（剩余高度）：横向布局。最左侧是Sidebar，放导航图标（Dashboard / Sessions / Activity 等页面入口）。右边是主内容区，渲染当前路由的页面。如果全局 Right Rail 开启，主内容区右侧还会出现一个可拖拽调宽的面板，用于显示选中 session 的摘要信息。
的拖拽分隔条。
底部 Status Bar（很窄）：显示 ingest 服务连接状态等系统级信息。

### overview中显示的内容
你可以根据这些需要展示的信息进行自由设计
- 第一行统计cards：SESSIONS, TURNS, PROJECTS, TOKENS/COST
- RECENT USAGE / COST : 显示TODAY, LAST 7 DAYS, LAST 30 DAYS的token消耗数，
  ```
  Usage & Cost
  Today:      1.2M tokens / $3.42
  7 days:     9.8M tokens / $21.70
  30 days:   41.3M tokens / $86.20
  ```
- AGENTS CARD: 仅有agents的tool中显示
- TOP MODELS：显示在这个工具中models根据用的tokens数的排名，如果是all的话就显示所有工具中的排名。同时显示用了多少token以及占总量的多少。可以根据时间filter。同时可以顶部切换成COST消耗。也是根据model排行
- Automations: 这部分也是具有这个功能的tool显示即可。不具有的可以显示一点有趣的小玩意儿之类的。符合终端风即可。
- Stars Card: 重点展示最近几个在这个tool中被starred的session，如果是all的话就展示所有tool的最近几个。
- Timeline：混合展示刚刚发生了什么，如果在特定tool页面内的话就只展示这个tool相关的
    ```
    10:32 Codex automation finished: weekly docs update
    10:28 OpenCode agent build failed: permission denied
    10:20 Claude Code session resumed in project zcloud
    10:15 OpenClaw cron sent report to Telegram
    ```
- Project Ranking (根据tool切换而切换): 
    ```
    Top Projects
    - zcloud: 32 sessions / 4.2M tokens / $12.30
    - LLMsUnion: 18 sessions / 2.1M tokens / $6.80
    - stock-dashboard: 11 sessions / 900K tokens / $2.40
    ```

### sessions
目前Session 详情页内部布局，session按照trun来显示，一个turn包括一次user发送的信息和agent对此的回复。
你可以根据现在需要展示的信息进行自由设计。
打开某个 session 后，整个主内容区被替换为 session 详情，一定需要显示的内容有：
- status
- search area, 去搜索当前sessino中的内容
- prev/next (turn), turn x of x, session hash, 
- COLLAPSE ALL / EXPAND ALL
- 主体区域：
  - 左侧（一般占整个屏幕）：turn timeline，右侧有一个可以收缩的 session info
  - turn timeline中，每个turn card在折叠时只显示turn 编号和用户消息，展开时显示用户消息全文，agent消息，包括各种活动块（tool, skill, subagent等等），都能够展开显示具体的活动
