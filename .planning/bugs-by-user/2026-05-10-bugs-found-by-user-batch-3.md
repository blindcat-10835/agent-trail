### codex的subagent显示的位置不对

codex的session显示中貌似所有subagent的显示模块都集中在了turn 1，而非真正分发的位置。
且很多turn的user发送的信息显示类似下面的内容：
```
<subagent_notification> {"agent_path":"019df1ee-7100-7a32-8f72-5e6d99454af0","status":{"completed":"selected_source=/Users/ebbi/.codex/generated_images/019df1ee-7100-7a32-8f72-5e6d99454af0/ig_054e2cd1eddc49220169f84e5a060081919165a3f2bb84d429.png\nqa_note=Best candidate has exactly 6 separated full-body idle frames with stable Hachiware identity and no detached artifacts, but the magenta background still shows slight tonal variation instead of a perfectly flat fill."}} </subagent_notification>
```
显然这不应该是user发送的信息，应该是有解析错误？

分析并且修正

### filter的显示行为
在all中时，现在的显示项目是对的。
但在个别的tool页面时，filter应该只显示下面的内容：
- Group by Project 
- Starred only 

### filter group后的显示
按照tool或者project分类后，默认显示应该是收缩(collapse)状态。点击之后才能显示某个tool/project中具体的sessions。现在是分类之后所有sessions都被是expanded的状态。需要修复

### session页面中的collapse all & expand all 
之前应该是有这两个按钮的，但是不知道为什么没了。我希望添加回来。并且集中成为一个按钮，动态在collapse all和expand all之间转换

### 前端turn中子模块的交互体验

在session详情页面打开一个子模块，如Agent, Bash等有时会向上弹出，收回时也会擅自移动页面现在停留的位置。
但是在大部分情况下是正常的。不知道是什么原因。如果可以修复的话修复一下。