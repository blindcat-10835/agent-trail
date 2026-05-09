# Errors Learned

历史错误教训索引。写新组件前查阅，避免重复踩坑。

---

## EL-001: `<button>` 嵌套 `<button>` → React Hydration Mismatch

**日期**: 2026-05-09
**文件**: `components/replay/tool-block.tsx`
**现象**: 控制台报 hydration error：`<button> cannot be a descendant of <button>`

### 根因

`ToolBlock` 的折叠头部是 `<button>`，内部 copy 按钮也是 `<button>`。HTML 规范禁止 interactive content 嵌套，React SSR/CSR 渲染结果不一致触发 hydration mismatch。

### 规则

> **任何可点击行（header bar、collapsible row）内如果还需要放独立操作按钮（copy、link、delete），外层必须用 `<div role="button">` 而非 `<button>`。**

### Fix Pattern

```tsx
// ❌ 错误 — button 嵌套 button
<button onClick={toggle}>
  <span>Title</span>
  <button onClick={handleCopy}>Copy</button>  {/* hydration error! */}
</button>

// ✅ 正确 — 外层用 div[role=button]
<div
  role="button"
  tabIndex={0}
  onClick={toggle}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}
  className="cursor-pointer ..."
>
  <span>Title</span>
  <button onClick={handleCopy}>Copy</button>  {/* OK — 不嵌套 */}
</div>
```

### 项目内已用此模式的组件

- `components/replay/turn-card.tsx` — TurnCard header（copy + chevron）
- `components/replay/tool-block.tsx` — ToolBlock header（copy + chevron）

### 检查清单

写 collapsible/expandable row 时问自己：
1. 行内是否有独立操作按钮（copy、external link、delete）？
2. 如果有 → 外层用 `<div role="button">`
3. 如果没有 → `<button>` 即可
