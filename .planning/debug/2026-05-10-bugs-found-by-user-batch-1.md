### sessions显示不全的问题
Right rail 请求的是 limit: '500'，总共加载 500 条 sessions。
这是 client-side 分页的固有局限：右 rail 没有加载全部 sessions，只加载了按 updated_at 排序的最新 500 条。Group by 是在这 500 条上做的分组，不是在全部数据上。

根因： lib/agent-tools/server-adapter.ts:35 的 MAX_LIMIT = 100。前端请求 limit: '500'，但 BFF 的 sanitizeLimit() 把它截断成了 100。所以 right rail 实际只拿到 100 条 sessions，不是 500 条。

我们设置max_limit的初衷是能让加载不那么重。但是rightrail中显示的总数，以及filter后每个tools的sessions应该显示的

