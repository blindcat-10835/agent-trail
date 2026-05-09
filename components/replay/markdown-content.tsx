'use client'

import { type ReactNode, Fragment, isValidElement, cloneElement } from 'react'
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

/** Split a text string on query matches, wrap matches in <mark> */
function highlightTextNode(text: string, query: string): ReactNode[] {
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-accent/30 text-foreground rounded-sm px-0.5">{part}</mark>
      : part,
  )
}

/** Recursively walk a ReactNode tree and highlight matching text in string nodes */
function highlightNodes(nodes: ReactNode, query: string): ReactNode {
  if (!query) return nodes

  if (typeof nodes === 'string') {
    return <>{highlightTextNode(nodes, query)}</>
  }

  if (typeof nodes === 'number') return nodes

  if (Array.isArray(nodes)) {
    return nodes.map((child, i) => (
      <Fragment key={i}>{highlightNodes(child, query)}</Fragment>
    ))
  }

  if (isValidElement<Record<string, unknown>>(nodes)) {
    const children = (nodes.props as Record<string, unknown>).children as ReactNode | undefined
    if (children === undefined) return nodes
    return cloneElement(nodes, { children: highlightNodes(children, query) } as Partial<unknown>)
  }

  return nodes
}

export function MarkdownContent({ content, searchQuery, className }: MarkdownContentProps) {
  return (
    <div className={cn('md-content', className)}>
      {searchQuery
        ? highlightNodes(
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>,
            searchQuery,
          )
        : <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>}
    </div>
  )
}
