---
type: feat
title: Replace Default Next.js Logo and Favicon
status: done
priority: p2
created: 2026-05-27
updated: 2026-06-25
branch: feat/time-gate-branding
worktree: .worktree/feat-time-gate-branding
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

- [x] 替换 `app/favicon.ico` 为自定义图标（或使用 Next.js App Router 约定式 `icon.svg`/`icon.png`）
- [x] 在 `metadata.icons` 或约定式文件中配置完整的 favicon 套件（16/32/180/apple-touch-icon）
- [x] 图标风格与赛博朋克 HUD 主题一致（accent 色、几何感）
- [x] 可选：替换 header 品牌区的 `◆` 为 SVG logo 组件
- [x] 可选：添加 `opengraph-image` 用于社交分享

## Implementation

- Time Gate 主标、紧凑标、描边标三套 SVG 品牌资产
- Header 使用继承语义化 `text-accent` 的 React SVG 组件
- Next.js file-based metadata 提供 16/32/SVG favicon 与 180px Apple 图标
- Web App Manifest 提供 192/512px 安装图标
- 静态 1200×630 Open Graph 分享图，避免运行时图片生成
