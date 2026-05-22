'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

type SessionIdDisplayMode = 'full' | 'head8' | 'tail8'

export interface SessionIdCopyButtonProps extends Omit<ComponentPropsWithoutRef<'button'>, 'children'> {
  sessionId?: string | null
  displaySessionId?: string | null
  copySessionId?: string | null
  displayText?: string
  displayMode?: SessionIdDisplayMode
  iconPlacement?: 'start' | 'end'
  showCopyIconOnHover?: boolean
  stopPropagation?: boolean
  textClassName?: string
  copyIconClassName?: string
  copiedIconClassName?: string
}

function formatSessionId(sessionId: string, displayMode: SessionIdDisplayMode): string {
  switch (displayMode) {
    case 'head8':
      return sessionId.slice(0, 8)
    case 'tail8':
      return sessionId.slice(-8)
    case 'full':
    default:
      return sessionId
  }
}

export function SessionIdCopyButton({
  sessionId,
  displaySessionId,
  copySessionId,
  displayText,
  displayMode = 'full',
  iconPlacement = 'start',
  showCopyIconOnHover = false,
  stopPropagation = true,
  className,
  textClassName,
  copyIconClassName,
  copiedIconClassName,
  onClick,
  onKeyDown,
  title,
  'aria-label': ariaLabel,
  type,
  ...props
}: SessionIdCopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resolvedCopySessionId = copySessionId ?? sessionId ?? ''
  const resolvedDisplaySessionId = displaySessionId ?? resolvedCopySessionId

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current)
      resetTimerRef.current = null
    }
  }, [])

  useEffect(() => clearResetTimer, [clearResetTimer])

  const handleCopy = useCallback(async (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (stopPropagation) event.stopPropagation()
    onClick?.(event)
    if (event.defaultPrevented || !resolvedCopySessionId) return

    try {
      await navigator.clipboard.writeText(resolvedCopySessionId)
      clearResetTimer()
      setCopied(true)
      resetTimerRef.current = setTimeout(() => {
        setCopied(false)
        resetTimerRef.current = null
      }, 2000)
    } catch {
      // Ignore clipboard failures; the button remains safe to click in unsupported contexts.
    }
  }, [clearResetTimer, onClick, resolvedCopySessionId, stopPropagation])

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (stopPropagation && (event.key === 'Enter' || event.key === ' ')) {
      event.stopPropagation()
    }
    onKeyDown?.(event)
  }, [onKeyDown, stopPropagation])

  if (!resolvedCopySessionId) return null

  const label = displayText ?? formatSessionId(resolvedDisplaySessionId, displayMode)
  const buttonTitle = title ?? (copied ? 'Copied session ID' : `Copy session ID: ${resolvedCopySessionId}`)
  const buttonAriaLabel = ariaLabel ?? (copied ? 'Copied session ID' : `Copy session ID ${resolvedCopySessionId}`)

  const icon = copied ? (
    <Check className={cn('h-3 w-3 flex-shrink-0 text-accent', copiedIconClassName)} />
  ) : (
    <Copy
      className={cn(
        'h-3 w-3 flex-shrink-0',
        showCopyIconOnHover ? 'opacity-0 transition-opacity group-hover:opacity-100' : 'opacity-50',
        copyIconClassName
      )}
    />
  )

  return (
    <button
      {...props}
      type={type ?? 'button'}
      onClick={handleCopy}
      onKeyDown={handleKeyDown}
      title={buttonTitle}
      aria-label={buttonAriaLabel}
      className={cn('inline-flex items-center gap-1', showCopyIconOnHover && 'group', className)}
    >
      {iconPlacement === 'start' ? icon : null}
      <span className={textClassName}>{label}</span>
      {iconPlacement === 'end' ? icon : null}
    </button>
  )
}
