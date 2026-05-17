# Overview Cost 估算实现方案

## 当前结论

首页 cost 现在不应该直接硬编码实现。原因是当前 ingest 数据只有 token channel 和 model 字符串，没有可靠的价格来源、价格生效时间、币种、计价单位，也没有把不同供应商的缓存读写 token、reasoning/output token 差异映射到统一计费规则。

## 建议方案

1. 新增价格注册表

   建议增加 `ingest/config/model-pricing.ts`，用配置描述每个 model 的价格规则，而不是把价格写在 SQL 或 React 组件中。规则至少包含：

   - `provider`
   - `modelPattern` 或标准化后的 `modelId`
   - `currency`
   - `unitTokens`，通常为 1,000,000
   - `inputPerUnit`
   - `outputPerUnit`
   - `cacheReadPerUnit`
   - `cacheWritePerUnit`
   - `reasoningPerUnit`，如果供应商单独计价才启用
   - `effectiveFrom` 和可选 `effectiveTo`
   - `sourceUrl`，记录价格来源

2. 新增 model 标准化层

   当前 `messages.model` 可能出现完整版本号、别名、空字符串和 `<synthetic>`。建议增加 `ingest/pricing/normalize-model.ts`：

   - 过滤空值和 synthetic model
   - 将 provider 前缀、历史别名和版本化 ID 映射到可定价 model
   - 对无法识别的 model 返回 `pricingStatus: "unknown"`，cost 保持 `null`

3. 在 ingest 层计算 cost

   不建议前端计算 cost。应在 ingest API 中按 session 或 model 聚合后计算：

   ```ts
   cost =
     inputTokens / unitTokens * inputPerUnit +
     outputTokens / unitTokens * outputPerUnit +
     cacheReadTokens / unitTokens * cacheReadPerUnit +
     cacheWriteTokens / unitTokens * cacheWritePerUnit +
     reasoningTokens / unitTokens * reasoningPerUnit
   ```

   计算结果返回 number，无法匹配价格规则时返回 `null`，并额外返回 `pricingStatus` 方便 UI 展示。

4. 扩展 API 响应

   建议扩展以下端点：

   - `/api/v1/overview/top-models`：每个 model 返回 `cost`、`pricingStatus`
   - `/api/v1/overview/aggregates`：返回 `totalCost`，当部分 model 未定价时返回 `null` 或 `partial`
   - `/api/v1/overview/daily-tokens`：后续可扩展为 `daily-usage`，同时返回 `cost`

5. 测试覆盖

   需要新增固定价格 fixture，覆盖：

   - 输入/output 分开计价
   - cache read/cache write 计价
   - unknown model 返回 `cost: null`
   - cost 排序时 null 排在最后
   - 不同 source 的 model 名称标准化

## UI 展示建议

- cost 不完整时不要显示 `$0.00`，保持 `—` 并显示 `Pricing pending` 或 `Partial pricing`
- top models 的 COST 排序只对有 cost 的 model 生效，unknown/null 排在最后
- KPI hero 的 `TOTAL COST · 30D` 只有在所有相关 token 都有价格规则时展示数值
