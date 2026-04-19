import { afterEach, describe, it, expect } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { PageShell, PageHeader } from '@/components/page-shell'

afterEach(cleanup)

describe('PageShell', () => {
  it('default variant applies max-w-6xl', () => {
    render(<PageShell data-testid="shell">content</PageShell>)
    expect(screen.getByTestId('shell').className).toContain('max-w-6xl')
  })

  it('narrow variant applies max-w-5xl', () => {
    render(
      <PageShell size="narrow" data-testid="shell">
        content
      </PageShell>
    )
    expect(screen.getByTestId('shell').className).toContain('max-w-5xl')
  })

  it('editor variant applies max-w-[45rem] and tighter gap', () => {
    render(
      <PageShell size="editor" data-testid="shell">
        content
      </PageShell>
    )
    const cls = screen.getByTestId('shell').className
    expect(cls).toContain('max-w-[45rem]')
    expect(cls).toContain('gap-6')
  })

  it('applies responsive padding tiers (px-4 sm:px-6 md:px-10)', () => {
    render(<PageShell data-testid="shell">content</PageShell>)
    const cls = screen.getByTestId('shell').className
    expect(cls).toContain('px-4')
    expect(cls).toContain('sm:px-6')
    expect(cls).toContain('md:px-10')
  })
})

describe('PageHeader', () => {
  it('renders title at softened h1 scale', () => {
    render(<PageHeader title="Templates" />)
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.textContent).toBe('Templates')
    expect(heading.className).toContain('text-xl')
    expect(heading.className).toContain('md:text-2xl')
  })

  it('renders description with narrower max-width and 13px body', () => {
    render(<PageHeader title="X" description="Some copy" />)
    expect(screen.getByText('Some copy').className).toContain('max-w-[560px]')
    expect(screen.getByText('Some copy').className).toContain('text-[13px]')
  })

  it('renders actions slot when provided', () => {
    render(<PageHeader title="X" actions={<button>Go</button>} />)
    expect(screen.getByRole('button', { name: 'Go' })).toBeDefined()
  })

  it('renders eyebrow slot when provided', () => {
    render(<PageHeader title="X" eyebrow={<a href="/back">back</a>} />)
    expect(screen.getByRole('link', { name: 'back' })).toBeDefined()
  })
})
