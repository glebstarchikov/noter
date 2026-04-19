import { afterEach, describe, it, expect, mock } from 'bun:test'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { TemplatePicker } from './template-picker'
import type { ResolvedNoteTemplate } from '@/lib/note-template'

mock.module('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => {
    const React = require('react')
    return React.createElement('a', { href, ...props }, children)
  },
}))

afterEach(cleanup)

const BUILTIN_GENERAL: ResolvedNoteTemplate = {
  id: 'builtin-general', name: 'General', description: 'Balanced', prompt: 'p', isBuiltin: true,
}
const BUILTIN_1ON1: ResolvedNoteTemplate = {
  id: 'builtin-1on1', name: '1:1 / Check-in', description: 'Warm', prompt: 'p', isBuiltin: true,
}
const CUSTOM: ResolvedNoteTemplate = {
  id: 'uuid-x', name: 'Product Review', description: 'Custom', prompt: 'p'.repeat(25), isBuiltin: false,
}

describe('TemplatePicker', () => {
  it('button label shows the pre-selected template name', () => {
    render(
      <TemplatePicker
        templates={[BUILTIN_GENERAL, BUILTIN_1ON1, CUSTOM]}
        selectedId="builtin-1on1"
        onChange={mock()}
        onConfirm={mock()}
      />
    )
    expect(screen.getByRole('button', { name: /1:1 \/ check-in/i })).toBeDefined()
  })

  it('clicking the main button calls onConfirm with selectedId', () => {
    const onConfirm = mock()
    render(
      <TemplatePicker
        templates={[BUILTIN_GENERAL, BUILTIN_1ON1, CUSTOM]}
        selectedId="builtin-1on1"
        onChange={mock()}
        onConfirm={onConfirm}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /create notes with/i }))
    expect(onConfirm).toHaveBeenCalledWith('builtin-1on1')
  })

  it('renders a fallback pill when templates list is empty (degraded mode)', () => {
    // Regression: when /api/templates fails or returns empty, the picker
    // previously returned null and removed the only path to AI generation.
    // Now it must render a working button that fires with builtin-general.
    const onConfirm = mock()
    render(
      <TemplatePicker
        templates={[]}
        selectedId="builtin-general"
        onChange={mock()}
        onConfirm={onConfirm}
      />
    )

    const button = screen.getByRole('button', { name: /create notes with/i })
    expect(button).toBeDefined()

    fireEvent.click(button)
    expect(onConfirm).toHaveBeenCalledWith('builtin-general')
  })
})
