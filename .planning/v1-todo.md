#### BUG: qoder cost
- qoder的cost没有取到
- 可以用消耗的credits进行计算？

#### BUG: 搜索问题
- session列表的搜索没有很好的工作

#### BUG: qoder的更新时间没有从正确的地方取得
- 如题

#### REFACTOR: sourceTag, SOURCE_LABELS everywhere
- 集中写一下比较好
```
const SOURCE_LABELS: Record<TraceSource, string> = {
  'claude-code': 'Claude',
  openclaw: 'OpenClaw',
  codex: 'Codex',
  opencode: 'OpenCode',
  qoder: 'Qoder',
}
```

#### REFACTOR: 程序打包的地方可以优化
- 体积过大
- 打包流程有些复杂，需要搞清楚

#### FEAT: filter实现
- 在rightrail或者session列表页面的右上角加一个漏斗符号，可以filter
- filter可以by project, 则显示