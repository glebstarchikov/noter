import { describe, expect, it } from 'bun:test'
import {
  assertSupportedEnhancementSourceDocument,
  compileDraftProposalToTiptap,
  draftProposalLimits,
  validateDraftProposal,
} from '@/lib/notes/draft-proposal'

describe('draft proposal helpers', () => {
  it('compiles supported blocks into deterministic tiptap content', () => {
    const document = compileDraftProposalToTiptap({
      schemaVersion: 1,
      summary: 'Clarifies the note.',
      blocks: [
        { type: 'heading', level: 2, text: 'Summary' },
        { type: 'paragraph', text: 'The team aligned on next steps.' },
        { type: 'bullet_list', items: ['Share the deck', 'Confirm the date'] },
        {
          type: 'task_list',
          items: [{ text: 'Send recap', done: false, owner: 'Alice' }],
        },
      ],
    })

    expect(document).toEqual({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Summary' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'The team aligned on next steps.' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Share the deck' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Confirm the date' }],
                },
              ],
            },
          ],
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Send recap  ·  Alice' }],
                },
              ],
            },
          ],
        },
      ],
    })
  })

  it('rejects invalid block shapes and empty proposals', () => {
    expect(() =>
      validateDraftProposal({
        schemaVersion: 1,
        summary: 'x',
        blocks: [],
      })
    ).toThrow()

    expect(() =>
      compileDraftProposalToTiptap({
        schemaVersion: 1,
        summary: 'x',
        blocks: [
          {
            type: 'paragraph',
            text: ' '.repeat(5),
          },
        ],
      })
    ).toThrow()
  })

  it('rejects oversize content through schema validation', () => {
    expect(() =>
      validateDraftProposal({
        schemaVersion: 1,
        summary: 's'.repeat(draftProposalLimits.maxSummaryChars + 1),
        blocks: [
          {
            type: 'paragraph',
            text: 'Valid paragraph',
          },
        ],
      })
    ).toThrow()
  })

  it('rejects unsupported top-level source blocks for enhancement mode', () => {
    expect(() =>
      assertSupportedEnhancementSourceDocument({
        type: 'doc',
        content: [
          {
            type: 'orderedList',
            content: [],
          },
        ],
      })
    ).toThrow()
  })
})
