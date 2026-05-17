import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Extract the last path segment from a file-system or project path. */
export function shortPath(p: string): string {
  if (!p) return p
  return p.split('/').filter(Boolean).at(-1) ?? p
}

/**
 * Return the path relative to a project root (cwd).
 * Falls back to the last two segments if the root doesn't match.
 */
export function relPath(filePath: string, cwd?: string): string {
  if (!filePath) return ''
  if (cwd) {
    const root = cwd.endsWith('/') ? cwd : cwd + '/'
    if (filePath.startsWith(root)) return filePath.slice(root.length)
  }
  // Fallback: last two path segments so there's always some context
  const parts = filePath.split('/').filter(Boolean)
  return parts.length > 1 ? parts.slice(-2).join('/') : (parts[0] ?? filePath)
}

const PROJECT_COLOR_PALETTE = [
  'oklch(0.80 0.17 75)',   // chartreuse
  'oklch(0.78 0.12 220)',  // cyan
  'oklch(0.78 0.15 45)',   // orange
  'oklch(0.75 0.17 340)',  // magenta
  'oklch(0.78 0.15 165)',  // mint
  'oklch(0.72 0.18 290)',  // violet
  'oklch(0.76 0.14 25)',   // red-orange
  'oklch(0.78 0.10 250)',  // periwinkle
  'oklch(0.76 0.17 145)',  // green
  'oklch(0.78 0.14 310)',  // purple
  'oklch(0.80 0.16 55)',   // amber
  'oklch(0.74 0.15 200)',  // blue-cyan
]

/** Derive a consistent OKLCH color for a project name via hash. */
export function projectColor(name: string): string {
  if (!name) return PROJECT_COLOR_PALETTE[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return PROJECT_COLOR_PALETTE[hash % PROJECT_COLOR_PALETTE.length]
}
