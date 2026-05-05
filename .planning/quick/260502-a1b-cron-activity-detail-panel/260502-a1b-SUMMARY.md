---
status: complete
---
Implemented CronDrawer component and wired click handler in OverviewTab. Clicking a cron row in the "CRON · SCHEDULED" section opens a right-side detail panel (min(560px, 92vw)) showing last/next run, duration, status, schedule (with cron expr), delivery, recent runs list with status dots/duration/summary, and agent initial avatar in header when agentId/agentName is present in run details.
