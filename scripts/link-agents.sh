#!/usr/bin/env bash
# link-agents.sh — wire shared skills from .agents/ into each agent tool's skill dir.
#
# Skills (and other agent assets) live canonically under .agents/ (tracked in git).
# Each agent tool reads from its own local directory (.claude/, .codex/, .opencode/),
# which are gitignored. This script creates per-skill symlinks so the shared content
# is visible to every tool, without disturbing each tool's private content.
#
# Safe to re-run: it skips entries that already point at the right target, and
# refuses to overwrite anything that isn't already a symlink (so private skills
# with the same name as a shared one are surfaced as a conflict rather than lost).
#
# Usage:
#   bash scripts/link-agents.sh           # link skills into all tool dirs that exist
#   bash scripts/link-agents.sh --dry-run # show what would happen, change nothing

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

SHARED_DIR="$ROOT/.agents/skills"
TOOL_DIRS=(".claude" ".codex" ".opencode")

if [[ ! -d "$SHARED_DIR" ]]; then
  echo "error: $SHARED_DIR does not exist" >&2
  exit 1
fi

linked=0
skipped=0
conflicts=0

for tool in "${TOOL_DIRS[@]}"; do
  tool_path="$ROOT/$tool"
  if [[ ! -d "$tool_path" ]]; then
    echo "  $tool/                  not present, skipping"
    continue
  fi

  skills_path="$tool_path/skills"
  if [[ $DRY_RUN -eq 0 ]]; then
    mkdir -p "$skills_path"
  fi

  for skill_dir in "$SHARED_DIR"/*/; do
    skill_name="$(basename "$skill_dir")"
    target_rel="../../.agents/skills/$skill_name"
    link_path="$skills_path/$skill_name"

    if [[ -L "$link_path" ]]; then
      current="$(readlink "$link_path")"
      if [[ "$current" == "$target_rel" ]]; then
        echo "  $tool/skills/$skill_name  ok"
        skipped=$((skipped + 1))
        continue
      fi
      echo "  $tool/skills/$skill_name  symlink points elsewhere ($current) — leaving alone"
      conflicts=$((conflicts + 1))
      continue
    fi

    if [[ -e "$link_path" ]]; then
      echo "  $tool/skills/$skill_name  CONFLICT: a non-symlink exists (private skill?) — not touching"
      conflicts=$((conflicts + 1))
      continue
    fi

    if [[ $DRY_RUN -eq 1 ]]; then
      echo "  $tool/skills/$skill_name  would link -> $target_rel"
    else
      ln -s "$target_rel" "$link_path"
      echo "  $tool/skills/$skill_name  linked"
    fi
    linked=$((linked + 1))
  done
done

echo ""
echo "Summary: $linked linked, $skipped already up-to-date, $conflicts conflicts"
if [[ $conflicts -gt 0 ]]; then
  echo "Conflicts are not errors — they mean a tool already has its own skill"
  echo "with the same name. Either rename one, or leave it as-is."
fi
