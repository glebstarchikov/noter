import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { ChatMessageAttachments } from './chat-message-attachments'
import type { UIMessage } from 'ai'

describe('ChatMessageAttachments', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders attachment chips from stored metadata when live file parts are not present', () => {
    const message = {
      id: 'message-1',
      role: 'user',
      parts: [{ type: 'text', text: 'See attachment' }],
      metadata: {
        attachments: [
          {
            filename: 'notes.pdf',
            mediaType: 'application/pdf',
            kind: 'document',
          },
        ],
      },
    } as UIMessage

    render(<ChatMessageAttachments message={message} />)

    expect(screen.getByText('notes.pdf')).not.toBeNull()
  })
})
