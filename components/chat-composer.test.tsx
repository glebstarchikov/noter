import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'bun:test'
import { ChatComposer } from '@/components/chat/chat-composer'
import { createRef } from 'react'
import type { ChatComposerProps } from '@/components/chat/chat-composer'

const baseProps: ChatComposerProps = {
  input: '',
  onInputChange: () => {},
  onSubmit: () => {},
  onFocus: () => {},
  isLoading: false,
  error: undefined,
  activeScope: 'meeting',
  allowGlobalToggle: false,
  onScopeChange: () => {},
  searchEnabled: false,
  onSearchToggle: () => {},
  selectedFiles: [],
  onRemoveFile: () => {},
  onFilesSelected: () => {},
  fileInputRef: createRef<HTMLInputElement | null>(),
  inputRef: createRef<HTMLTextAreaElement | null>(),
  messagesCount: 0,
  onClearChat: () => {},
  submitDisabled: false,
}

describe('ChatComposer', () => {
  it('has no liquid-glass class names', () => {
    const { container } = render(<ChatComposer {...baseProps} />)
    expect(container.innerHTML).not.toContain('liquid-glass')
  })

  it('context chip uses card surface classes when files are selected', () => {
    const { container } = render(
      <ChatComposer
        {...baseProps}
        selectedFiles={[new File([''], 'test.pdf', { type: 'application/pdf' })]}
      />
    )
    expect(container.innerHTML).not.toContain('liquid-glass-context-chip')
  })
})
