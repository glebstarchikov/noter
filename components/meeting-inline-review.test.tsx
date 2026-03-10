import { afterEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MeetingInlineReview } from './meeting-inline-review'

function makeDocument(text: string) {
  return {
    type: 'doc' as const,
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  }
}

describe('MeetingInlineReview', () => {
  afterEach(() => {
    cleanup()
  })

  it('accepts all changes into the proposed document', async () => {
    const onFinalizeReview = mock(() => {})
    const baseDocument = makeDocument('Original note')
    const proposedDocument = makeDocument('Improved note')

    render(
      <MeetingInlineReview
        baseDocument={baseDocument}
        proposedDocument={proposedDocument}
        summary="Improves the note"
        isSaving={false}
        saveError={null}
        onFinalizeReview={onFinalizeReview}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /accept all/i }))

    await waitFor(() => {
      expect(onFinalizeReview).toHaveBeenCalledTimes(1)
      expect(onFinalizeReview).toHaveBeenCalledWith({
        document: proposedDocument,
        outcome: 'accepted',
      })
    })
  })

  it('rejects all changes and keeps the base document', async () => {
    const onFinalizeReview = mock(() => {})
    const baseDocument = makeDocument('Original note')
    const proposedDocument = makeDocument('Improved note')

    render(
      <MeetingInlineReview
        baseDocument={baseDocument}
        proposedDocument={proposedDocument}
        summary="Improves the note"
        isSaving={false}
        saveError={null}
        onFinalizeReview={onFinalizeReview}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /reject all/i }))

    await waitFor(() => {
      expect(onFinalizeReview).toHaveBeenCalledTimes(1)
      expect(onFinalizeReview).toHaveBeenCalledWith({
        document: baseDocument,
        outcome: 'dismissed',
      })
    })
  })
})
