'use client'

import { type ReactNode, Fragment } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

interface MarkdownContentProps {
  content: string
  searchQuery?: string
  className?: string
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightTextNode(text: string, query: string): ReactNode[] {
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-accent/30 text-foreground rounded-sm px-0.5">{part}</mark>
      : part,
  )
}

function highlightChildren(children: ReactNode, query: string): ReactNode {
  if (!query) return children

  if (typeof children === 'string') {
    return <>{highlightTextNode(children, query)}</>
  }

  if (typeof children === 'number') return children

  if (Array.isArray(children)) {
    return children.map((child, i) => (
      <Fragment key={i}>{highlightChildren(child, query)}</Fragment>
    ))
  }

  return children
}

function makeComponents(searchQuery: string | undefined) {
  if (!searchQuery) return undefined

  const highlight = (children: ReactNode) => highlightChildren(children, searchQuery)

  return {
    p({ children, ...props }: React.ComponentPropsWithoutRef<'p'> & { children?: ReactNode }) {
      return <p {...props}>{highlight(children)}</p>
    },
    li({ children, ...props }: React.ComponentPropsWithoutRef<'li'> & { children?: ReactNode }) {
      return <li {...props}>{highlight(children)}</li>
    },
    strong({ children, ...props }: React.ComponentPropsWithoutRef<'strong'> & { children?: ReactNode }) {
      return <strong {...props}>{highlight(children)}</strong>
    },
    em({ children, ...props }: React.ComponentPropsWithoutRef<'em'> & { children?: ReactNode }) {
      return <em {...props}>{highlight(children)}</em>
    },
    a({ children, ...props }: React.ComponentPropsWithoutRef<'a'> & { children?: ReactNode }) {
      return <a {...props}>{highlight(children)}</a>
    },
  }
}

export function MarkdownContent({ content, searchQuery, className }: MarkdownContentProps) {
  return (
    <div className={cn('md-content', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={makeComponents(searchQuery)}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
