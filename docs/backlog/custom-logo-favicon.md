---
type: feat
title: Replace Default Next.js Logo and Favicon
status: todo
priority: p2
created: 2026-05-27
branch:
worktree:
---

## Description

目前仍在使用 Next.js 默认的 `favicon.ico`，没有自定义的应用图标。项目品牌名是 "Agents Trail"，赛博朋克 HUD 风格，但 favicon 和浏览器标签页完全没有体现。

现状：
- `app/favicon.ico` — Next.js 默认图标（未替换）
- `app/layout.tsx` metadata — 没有 `icons` 字段，未配置自定义 favicon
- Header 品牌（`shell-header.tsx`）用的是 `◆` 文本符号 + "AGENTS TRAIL" 文字，尚可但没有对应的图标资产
- 没有 `app/icon.svg` 或 `app/opengraph-image.*` 等约定式图标文件

需要设计一套符合赛博朋克 HUD 风格的品牌图标，覆盖 favicon、浏览器标签、以及 header 中的品牌标识。

## Acceptance criteria

- [ ] 替换 `app/favicon.ico` 为自定义图标（或使用 Next.js App Router 约定式 `icon.svg`/`icon.png`）
- [ ] 在 `metadata.icons` 或约定式文件中配置完整的 favicon 套件（16/32/180/apple-touch-icon）
- [ ] 图标风格与赛博朋克 HUD 主题一致（accent 色、几何感）
- [ ] 可选：替换 header 品牌区的 `◆` 为 SVG logo 组件
- [ ] 可选：添加 `opengraph-image` 用于社交分享
