import { afterEach, describe, it, expect, mock } from 'bun:test'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { TemplateEditorForm } from './template-editor-form'

afterEach(cleanup)

describe('TemplateEditorForm', () => {
  it('disables Save while fields are invalid', () => {
    render(<TemplateEditorForm onSubmit={mock()} onCancel={mock()} />)
    const save = screen.getByRole('button', { name: /save template/i })
    expect(save.hasAttribute('disabled')).toBe(true)
  })

  it('enables Save when all required fields are valid', () => {
    render(<TemplateEditorForm onSubmit={mock()} onCancel={mock()} />)
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Custom X' } })
    fireEvent.change(screen.getByLabelText(/prompt/i), { target: { value: 'p'.repeat(25) } })
    const save = screen.getByRole('button', { name: /save template/i })
    expect(save.hasAttribute('disabled')).toBe(false)
  })

  it('calls onSubmit with trimmed input', () => {
    const onSubmit = mock()
    render(<TemplateEditorForm onSubmit={onSubmit} onCancel={mock()} />)
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: '  Custom X  ' } })
    fireEvent.change(screen.getByLabelText(/prompt/i), { target: { value: 'p'.repeat(25) } })
    fireEvent.click(screen.getByRole('button', { name: /save template/i }))
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Custom X',
      description: undefined,
      prompt: 'p'.repeat(25),
    })
  })

  it('prefills from initial when editing', () => {
    render(
      <TemplateEditorForm
        onSubmit={mock()}
        onCancel={mock()}
        initial={{ name: 'Existing', description: 'desc', prompt: 'p'.repeat(25) }}
      />
    )
    expect((screen.getByLabelText(/^name$/i) as HTMLInputElement).value).toBe('Existing')
    expect((screen.getByLabelText(/description/i) as HTMLInputElement).value).toBe('desc')
  })

  it('calls onCancel when cancel clicked', () => {
    const onCancel = mock()
    render(<TemplateEditorForm onSubmit={mock()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
  })
})
