import { describe, expect, it } from 'bun:test'
import { buildGlobalChatContext } from '@/lib/chat/global-chat-context'

function makeDocument(text: string) {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  }
}

describe('buildGlobalChatContext', () => {
  it('includes note document text before structured metadata and transcript', () => {
    const context = buildGlobalChatContext([
      {
        id: 'm-1',
        title: 'Weekly sync',
        summary: 'Summary text',
        action_items: [{ task: 'Follow up', owner: 'Alice', done: false }],
        key_decisions: ['Ship on Friday'],
        topics: ['Roadmap'],
        follow_ups: ['Share deck'],
        document_content: makeDocument('Typed note from the editor'),
        transcript: 'Transcript excerpt goes here.',
        created_at: '2026-03-10T08:00:00.000Z',
      },
    ])

    expect(context).toContain('### Note\nTyped note from the editor')
    expect(context).toContain('### Summary\nSummary text')
    expect(context).toContain('### Transcript\nTranscript excerpt goes here.')
    expect(context.indexOf('### Note')).toBeLessThan(context.indexOf('### Summary'))
    expect(context.indexOf('### Summary')).toBeLessThan(context.indexOf('### Transcript'))
  })

  it('falls back to Untitled Meeting when title is missing', () => {
    const context = buildGlobalChatContext([
      {
        id: 'm-1',
        title: null,
        summary: null,
        action_items: [],
        key_decisions: [],
        topics: [],
        follow_ups: [],
        document_content: null,
        transcript: null,
        created_at: '2026-03-10T08:00:00.000Z',
      },
    ])

    expect(context).toContain('Untitled Meeting')
  })
})
