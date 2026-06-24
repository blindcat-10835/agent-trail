'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CopyButtonProps {
  /** Text copied to the clipboard on click. */
  text: string
  /** Extra classes merged onto the button (positioning, sizing). */
  className?: string
  /** Accessible label / tooltip; shown as 'Copied!' while in the copied state. */
  title?: string
  /** How long the copied feedback lasts, in ms. Default 2000. */
  copiedDuration?: number
  /** Stop click propagation so nested clicks don't reach e.g. a focus handler. Default true. */
  stopPropagation?: boolean
}

const DEFAULT_COPIED_DURATION = 2000

/**
 * Icon-only copy-to-clipboard button.
 *
 * Reveals on hover via `group-hover` — its nearest ancestor must carry the
 * Tailwind `group` class (e.g. a message bubble). Swaps to a `Check` icon for
 * `copiedDuration` ms after a successful copy. Clipboard failures are
 * swallowed so the button stays safe in insecure / unsupported contexts.
 *
 * Renders a `<button>` — must NOT be nested inside another `<button>` (EL-001).
 */
export function CopyButton({
  text,
  className,
  title,
  copiedDuration = DEFAULT_COPIED_DURATION,
  stopPropagation = true,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current)
      resetTimerRef.current = null
    }
  }, [])

  useEffect(() => clearResetTimer, [clearResetTimer])

  const handleCopy = useCallback(
    async (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (stopPropagation) event.stopPropagation()
      if (!text) return
      try {
        await navigator.clipboard.writeText(text)
        clearResetTimer()
        setCopied(true)
        resetTimerRef.current = setTimeout(() => {
          setCopied(false)
          resetTimerRef.current = null
        }, copiedDuration)
      } catch {
        // Ignore clipboard failures; safe to click in unsupported contexts.
      }
    },
    [clearResetTimer, copiedDuration, stopPropagation, text],
  )

  const label = copied ? 'Copied!' : (title ?? 'Copy')

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={label}
      aria-label={label}
      className={cn(
        'opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-accent flex-shrink-0',
        className,
      )}
    >
      {copied ? (
        <Check className="w-2.5 h-2.5 text-accent" />
      ) : (
        <Copy className="w-2.5 h-2.5" />
      )}
    </button>
  )
}
