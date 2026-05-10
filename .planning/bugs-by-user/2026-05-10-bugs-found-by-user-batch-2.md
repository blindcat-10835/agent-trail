### stars的session无法取得的问题
 GET /api/agent-tools/all/sessions/starred 404 in 1511ms 
star功能自己能运转，但是刷新后就回消失：
```
[NEXT]  POST /api/agent-tools/all/sessions/64a46f4d-f523-46a1-a201-74236a40fc60/star 200 in 483ms (next.js: 470ms, application-code: 14ms)
[NEXT]  GET /api/agent-tools/openclaw/sessions?limit=100&sort=updated_at&order=desc&offset=100&groupBy=agent%2Cproject 200 in 214ms (next.js: 205ms, application-code: 9ms)
[NEXT]  GET /openclaw/dashboard 200 in 193ms (next.js: 56ms, application-code: 137ms)
[NEXT]  GET /api/ingest/health 200 in 379ms (next.js: 351ms, application-code: 29ms)
[NEXT]  GET /api/agent-tools/all/sessions/starred 404 in 369ms (next.js: 341ms, application-code: 29ms)
[NEXT]  GET /api/agent-tools/ope
```

### 我不确定session的动态加载有没有生效 
我现在只能取得到最早55d前到sessions。感觉在那之前应该是还有其他session的。所以怀疑动态加载没有生效，还是只取得了limit数量的sessions。需要检查

