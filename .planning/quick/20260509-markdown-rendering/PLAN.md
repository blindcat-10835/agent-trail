---
name: markdown-rendering
type: quick
created: 2026-05-09
---

# Render Session Content with Markdown

## Problem
Session turn content (user messages, assistant messages, thinking blocks) is displayed as plain text with `whitespace-pre-wrap`. Markdown formatting (headers, bold, code blocks, lists, etc.) is not rendered.

## Scope
1. Install `react-markdown` + `remark-gfm`
2. Create `components/replay/markdown-content.tsx` — reusable markdown renderer
3. Update `turn-card.tsx` — use `MarkdownContent` for user + assistant messages (lines 154-156, 189-191)
4. Update `thinking-block.tsx` — use `MarkdownContent` for thinking content (line 40)
5. Add markdown-specific styles in `globals.css`

## Out of Scope
- `ToolBlock` (JSON input/results don't need markdown)
- `ChatBubble` (truncated preview, markdown overkill)
- `SkillBlock` (short summaries)

## Key Constraint
Must preserve `HighlightMatch` search highlighting that wraps matches in `<mark>` tags. The markdown renderer must integrate with search highlighting.
