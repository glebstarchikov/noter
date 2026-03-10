import { afterEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MeetingInlineReview } from './meeting-inline-review'

function makeParagraph(text: string, marks?: { type: string }[]) {
  return {
    type: 'paragraph' as const,
    content: [{ type: 'text' as const, text, marks }],
  }
}

function makeDocument(...nodes: ReturnType<typeof makeParagraph>[]) {
  return {
    type: 'doc' as const,
    content: nodes,
  }
}

describe('MeetingInlineReview', () => {
  afterEach(() => {
    cleanup()
  })

  it('requires explicit apply after accepting all changes', async () => {
    const onApplyReview = mock(() => {})
    const onCancelReview = mock(() => {})
    const baseDocument = makeDocument(makeParagraph('Original note'))
    const proposedDocument = makeDocument(makeParagraph('Improved note'))

    render(
      <MeetingInlineReview
        baseDocument={baseDocument}
        proposedDocument={proposedDocument}
        summary="Improves the note"
        isSaving={false}
        saveError={null}
        onApplyReview={onApplyReview}
        onCancelReview={onCancelReview}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /accept all/i }))

    expect(onApplyReview).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /apply reviewed changes/i }))

    await waitFor(() => {
      expect(onApplyReview).toHaveBeenCalledTimes(1)
      expect(onApplyReview).toHaveBeenCalledWith({
        document: proposedDocument,
        outcome: 'accepted',
      })
    })
  })

  it('supports dismissing a review by rejecting all changes then applying', async () => {
    const onApplyReview = mock(() => {})
    const onCancelReview = mock(() => {})
    const baseDocument = makeDocument(makeParagraph('Original note'))
    const proposedDocument = makeDocument(makeParagraph('Improved note'))

    render(
      <MeetingInlineReview
        baseDocument={baseDocument}
        proposedDocument={proposedDocument}
        summary="Improves the note"
        isSaving={false}
        saveError={null}
        onApplyReview={onApplyReview}
        onCancelReview={onCancelReview}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /reject all/i }))
    fireEvent.click(screen.getByRole('button', { name: /apply reviewed changes/i }))

    await waitFor(() => {
      expect(onApplyReview).toHaveBeenCalledWith({
        document: baseDocument,
        outcome: 'dismissed',
      })
    })
  })

  it('renders one review item per changed top-level block and preserves formatting markup', async () => {
    const onApplyReview = mock(() => {})
    const onCancelReview = mock(() => {})
    const baseDocument = {
      type: 'doc' as const,
      content: [
        {
          type: 'heading' as const,
          attrs: { level: 2 },
          content: [{ type: 'text' as const, text: 'Agenda' }],
        },
        {
          type: 'taskList' as const,
          content: [
            {
              type: 'taskItem' as const,
              attrs: { checked: false },
              content: [makeParagraph('Draft the update')],
            },
          ],
        },
      ],
    }
    const proposedDocument = {
      type: 'doc' as const,
      content: [
        {
          type: 'heading' as const,
          attrs: { level: 2 },
          content: [{ type: 'text' as const, text: 'Agenda' }],
        },
        {
          type: 'paragraph' as const,
          content: [
            {
              type: 'text' as const,
              text: 'Executive summary',
              marks: [{ type: 'bold' as const }],
            },
          ],
        },
        {
          type: 'taskList' as const,
          content: [
            {
              type: 'taskItem' as const,
              attrs: { checked: true },
              content: [makeParagraph('Draft the update')],
            },
          ],
        },
      ],
    }

    const { container } = render(
      <MeetingInlineReview
        baseDocument={baseDocument}
        proposedDocument={proposedDocument}
        summary="Adds a summary and completes the task"
        isSaving={false}
        saveError={null}
        onApplyReview={onApplyReview}
        onCancelReview={onCancelReview}
      />
    )

    expect(screen.getAllByRole('button', { name: /^accept$/i })).toHaveLength(2)
    expect(screen.getByText('Executive summary')).not.toBeNull()

    await waitFor(() => {
      expect(container.querySelector('strong')).not.toBeNull()
      expect(container.querySelector('input[type=\"checkbox\"]')).not.toBeNull()
    })
  })
})
