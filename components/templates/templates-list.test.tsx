import { afterEach, describe, it, expect, mock } from 'bun:test'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import type { ResolvedNoteTemplate } from '@/lib/note-template'

mock.module('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

const { TemplatesList } = await import('./templates-list')

const BUILTIN: ResolvedNoteTemplate = {
  id: 'builtin-general',
  name: 'General',
  description: 'Balanced notes for any meeting type',
  prompt: 'p',
  isBuiltin: true,
}

const CUSTOM: ResolvedNoteTemplate = {
  id: 'uuid-1',
  name: 'Product Review',
  description: 'Weekly product sync',
  prompt: 'p'.repeat(25),
  isBuiltin: false,
}

describe('TemplatesList', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders built-in and custom sections', () => {
    render(
      <TemplatesList
        templates={[BUILTIN, CUSTOM]}
        defaultTemplateId="builtin-general"
        onSetDefault={mock()}
        onDelete={mock()}
      />
    )
    expect(screen.getByText('Built-in')).toBeDefined()
    expect(screen.getByText('Your templates')).toBeDefined()
    expect(screen.getByText('General')).toBeDefined()
    expect(screen.getByText('Product Review')).toBeDefined()
  })

  it('shows filled star on default, hollow on others', () => {
    render(
      <TemplatesList
        templates={[BUILTIN, CUSTOM]}
        defaultTemplateId="builtin-general"
        onSetDefault={mock()}
        onDelete={mock()}
      />
    )
    const row = screen.getByText('General').closest('[data-slot="template-row"]')!
    expect(row.querySelector('[data-state="default"]')).toBeDefined()
  })

  it('calls onSetDefault when a hollow star is clicked', () => {
    const onSetDefault = mock()
    render(
      <TemplatesList
        templates={[BUILTIN, CUSTOM]}
        defaultTemplateId="builtin-general"
        onSetDefault={onSetDefault}
        onDelete={mock()}
      />
    )
    const starButton = screen.getByLabelText('Set Product Review as default')
    fireEvent.click(starButton)
    expect(onSetDefault).toHaveBeenCalledWith('uuid-1')
  })

  it('calls onDelete when delete button is clicked and confirmed', async () => {
    const onDelete = mock()
    render(
      <TemplatesList
        templates={[BUILTIN, CUSTOM]}
        defaultTemplateId="builtin-general"
        onSetDefault={mock()}
        onDelete={onDelete}
      />
    )
    fireEvent.click(screen.getByLabelText('Delete Product Review'))
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(onDelete).toHaveBeenCalledWith('uuid-1')
  })

  it('does not render Edit/Delete for built-ins', () => {
    render(
      <TemplatesList
        templates={[BUILTIN]}
        defaultTemplateId="builtin-general"
        onSetDefault={mock()}
        onDelete={mock()}
      />
    )
    expect(screen.queryByLabelText(/Delete General/)).toBe(null)
    expect(screen.queryByLabelText(/Edit General/)).toBe(null)
  })
})
