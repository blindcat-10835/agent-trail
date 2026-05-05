import { cn } from '@/lib/utils'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: string
}

interface ChatBubbleProps {
  message: ChatMessage
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  // Format timestamp if available
  const time = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    : ''

  // Truncate long content to prevent UI overflow
  const content = message.content.length > 500
    ? message.content.substring(0, 500) + '...'
    : message.content

  return (
    <div className={cn('flex w-full mb-3', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-3 py-2',
          isUser
            ? 'bg-accent text-background'
            : isSystem
              ? 'border border-border bg-card text-foreground'
              : 'bg-muted text-foreground'
        )}
      >
        {/* Header: role + timestamp */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
            {message.role}
          </span>
          {time && <span className="text-[10px] opacity-50">{time}</span>}
        </div>

        {/* Content */}
        <div className="text-[11px] leading-relaxed whitespace-pre-wrap break-words font-mono">
          {content}
        </div>
      </div>
    </div>
  )
}
