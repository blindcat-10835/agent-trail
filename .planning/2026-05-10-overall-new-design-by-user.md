## 整体设计

所有tools，包含all的页面应该是一定程度上一一对应的。但是有微小的差别。
比如openclaw的Overview中可以有agents card：显示每个agents的icon等内容。

### overview中显示的内容
- 第一行统计cards：SESSIONS, TURNS, PROJECTS, 
- RECENT USAGE: 显示TODAY, LAST 7 DAYS, LAST 30 DAYS的token消耗数
- AGENTS CARD: 仅有agents的tool中显示
- TOP MODELS：显示在这个工具中models根据用的tokens数的排名，如果是all的话就显示所有工具中的排名。同时显示用了多少token以及占总量的多少。可以根据时间filter
- crons: 