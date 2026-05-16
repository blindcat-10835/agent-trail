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
