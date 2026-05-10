// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { MarkdownContent } from '@/components/replay/markdown-content'

afterEach(() => {
  cleanup()
})

describe('MarkdownContent search highlighting', () => {
  it('does not throw when rendering markdown with a search query', () => {
    expect(() => {
      render(<MarkdownContent content="Hello **world**" searchQuery="world" />)
    }).not.toThrow()
  })

  it('keeps markdown rendering active while searching', () => {
    const content = [
      '**hello**',
      '',
      '- list item',
      '',
      '[docs](https://example.com)',
    ].join('\n')

    render(<MarkdownContent content={content} searchQuery="hello" />)

    expect(screen.getByText('hello').tagName).toBe('MARK')
    expect(screen.getByText('hello').closest('strong')).not.toBeNull()
    expect(screen.getByText('list item').closest('li')).not.toBeNull()
    expect(screen.getByRole('link', { name: 'docs' })).toHaveAttribute(
      'href',
      'https://example.com',
    )
  })

  it('wraps matching text in paragraph, list, and strong nodes', () => {
    render(
      <MarkdownContent
        content={['find me in a paragraph', '- find me in a list', '**find me strong**'].join(
          '\n',
        )}
        searchQuery="find"
      />,
    )

    const marks = screen.getAllByText(/find/i)
    expect(marks).toHaveLength(3)
    expect(marks.every((mark) => mark.tagName === 'MARK')).toBe(true)
    expect(marks[1]?.closest('li')).not.toBeNull()
    expect(marks[2]?.closest('strong')).not.toBeNull()
  })

  it('preserves inline code nodes while searching nearby text', () => {
    render(<MarkdownContent content="Search `const value = 1` safely" searchQuery="search" />)

    expect(screen.getByText('const value = 1').tagName).toBe('CODE')
    expect(screen.getByText('Search').tagName).toBe('MARK')
  })
})
