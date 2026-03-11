import { describe, it, expect } from 'bun:test'
import {
  isTiptapDocument,
  hasTiptapContent,
  tiptapToPlainText,
  generatedNotesToTiptap,
  createEmptyTiptapDocument,
  mergeTiptapDocuments,
  legacyMeetingToTiptap,
  normalizeTiptapDocument,
  EMPTY_TIPTAP_DOCUMENT,
  type TiptapDocument,
  type GeneratedNotesDocumentInput,
} from '../tiptap-converter'
import type { Meeting } from '../types'

describe('isTiptapDocument', () => {
  it('returns true for a valid Tiptap document', () => {
    expect(isTiptapDocument({ type: 'doc', content: [] })).toBe(true)
  })

  it('returns true for EMPTY_TIPTAP_DOCUMENT', () => {
    expect(isTiptapDocument(EMPTY_TIPTAP_DOCUMENT)).toBe(true)
  })

  it('returns false for null', () => {
    expect(isTiptapDocument(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isTiptapDocument(undefined)).toBe(false)
  })

  it('returns false for a string', () => {
    expect(isTiptapDocument('not a doc')).toBe(false)
  })

  it('returns false for wrong type field', () => {
    expect(isTiptapDocument({ type: 'paragraph', content: [] })).toBe(false)
  })

  it('returns false for missing content', () => {
    expect(isTiptapDocument({ type: 'doc' })).toBe(false)
  })

  it('returns false for non-array content', () => {
    expect(isTiptapDocument({ type: 'doc', content: 'text' })).toBe(false)
  })
})

describe('hasTiptapContent', () => {
  it('returns false for a document with only an empty paragraph', () => {
    expect(hasTiptapContent({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(false)
  })

  it('returns true for a document with text content', () => {
    expect(
      hasTiptapContent({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
      })
    ).toBe(true)
  })

  it('returns true for a document with a heading', () => {
    expect(
      hasTiptapContent({
        type: 'doc',
        content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] }],
      })
    ).toBe(true)
  })

  it('returns false for empty content array', () => {
    expect(hasTiptapContent({ type: 'doc', content: [] })).toBe(false)
  })

  it('returns false for non-Tiptap input', () => {
    expect(hasTiptapContent(null)).toBe(false)
  })

  it('returns false when paragraph has empty content array', () => {
    expect(
      hasTiptapContent({ type: 'doc', content: [{ type: 'paragraph', content: [] }] })
    ).toBe(false)
  })
})

describe('tiptapToPlainText', () => {
  it('returns empty string for non-Tiptap input', () => {
    expect(tiptapToPlainText(null)).toBe('')
    expect(tiptapToPlainText('string')).toBe('')
  })

  it('extracts text from paragraphs', () => {
    const doc: TiptapDocument = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] },
      ],
    }
    expect(tiptapToPlainText(doc)).toBe('Hello world')
  })

  it('extracts text from headings', () => {
    const doc: TiptapDocument = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Body text' }] },
      ],
    }
    const text = tiptapToPlainText(doc)
    expect(text).toContain('Title')
    expect(text).toContain('Body text')
  })

  it('extracts text from bullet lists', () => {
    const doc: TiptapDocument = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 2' }] }] },
          ],
        },
      ],
    }
    const text = tiptapToPlainText(doc)
    expect(text).toContain('Item 1')
    expect(text).toContain('Item 2')
  })

  it('extracts text from task lists', () => {
    const doc: TiptapDocument = {
      type: 'doc',
      content: [
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Task A' }] }],
            },
          ],
        },
      ],
    }
    const text = tiptapToPlainText(doc)
    expect(text).toContain('Task A')
  })

  it('returns empty string for empty document', () => {
    expect(tiptapToPlainText({ type: 'doc', content: [] })).toBe('')
  })

  it('returns empty string for document with only empty paragraphs', () => {
    expect(tiptapToPlainText({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe('')
  })
})

describe('generatedNotesToTiptap', () => {
  it('creates document with summary section', () => {
    const input: GeneratedNotesDocumentInput = {
      summary: 'Meeting went well',
      detailed_notes: '',
      action_items: [],
      key_decisions: [],
      follow_ups: [],
    }
    const doc = generatedNotesToTiptap(input)
    expect(doc.type).toBe('doc')

    const text = tiptapToPlainText(doc)
    expect(text).toContain('Summary')
    expect(text).toContain('Meeting went well')
  })

  it('creates document with action items as task list', () => {
    const input: GeneratedNotesDocumentInput = {
      summary: '',
      detailed_notes: '',
      action_items: [
        { task: 'Do thing', owner: 'Alice', done: false },
        { task: 'Other thing', owner: null, done: true },
      ],
      key_decisions: [],
      follow_ups: [],
    }
    const doc = generatedNotesToTiptap(input)
    const text = tiptapToPlainText(doc)
    expect(text).toContain('Action Items')
    expect(text).toContain('Do thing')
    expect(text).toContain('Alice')
  })

  it('creates document with key decisions when no detailed notes', () => {
    const input: GeneratedNotesDocumentInput = {
      summary: '',
      detailed_notes: '',
      action_items: [],
      key_decisions: ['Use React', 'Deploy on Vercel'],
      follow_ups: [],
    }
    const doc = generatedNotesToTiptap(input)
    const text = tiptapToPlainText(doc)
    expect(text).toContain('Key Decisions')
    expect(text).toContain('Use React')
  })

  it('creates document with follow-ups', () => {
    const input: GeneratedNotesDocumentInput = {
      summary: '',
      detailed_notes: '',
      action_items: [],
      key_decisions: [],
      follow_ups: ['Check metrics next week'],
    }
    const doc = generatedNotesToTiptap(input)
    const text = tiptapToPlainText(doc)
    expect(text).toContain('Follow-ups')
    expect(text).toContain('Check metrics next week')
  })

  it('parses markdown headings in detailed notes', () => {
    const input: GeneratedNotesDocumentInput = {
      summary: '',
      detailed_notes: '## Section One\nSome text\n## Section Two\nMore text',
      action_items: [],
      key_decisions: [],
      follow_ups: [],
    }
    const doc = generatedNotesToTiptap(input)
    const text = tiptapToPlainText(doc)
    expect(text).toContain('Section One')
    expect(text).toContain('Some text')
    expect(text).toContain('Section Two')
  })

  it('parses bullet points in detailed notes', () => {
    const input: GeneratedNotesDocumentInput = {
      summary: '',
      detailed_notes: '- First item\n- Second item',
      action_items: [],
      key_decisions: [],
      follow_ups: [],
    }
    const doc = generatedNotesToTiptap(input)
    const text = tiptapToPlainText(doc)
    expect(text).toContain('First item')
    expect(text).toContain('Second item')
  })

  it('returns document with empty paragraph when all input is empty', () => {
    const input: GeneratedNotesDocumentInput = {
      summary: '',
      detailed_notes: '',
      action_items: [],
      key_decisions: [],
      follow_ups: [],
    }
    const doc = generatedNotesToTiptap(input)
    expect(doc.type).toBe('doc')
    expect(doc.content).toHaveLength(1)
    expect(doc.content[0].type).toBe('paragraph')
  })
})

describe('createEmptyTiptapDocument', () => {
  it('returns a valid empty document', () => {
    const doc = createEmptyTiptapDocument()
    expect(doc.type).toBe('doc')
    expect(doc.content).toEqual([{ type: 'paragraph' }])
  })
})

describe('mergeTiptapDocuments', () => {
  it('returns appended document when existing is not a valid Tiptap doc', () => {
    const appended: TiptapDocument = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'New' }] }],
    }
    expect(mergeTiptapDocuments(null, appended)).toEqual(appended)
    expect(mergeTiptapDocuments('invalid', appended)).toEqual(appended)
  })

  it('returns appended document when existing has empty content', () => {
    const existing: TiptapDocument = { type: 'doc', content: [] }
    const appended: TiptapDocument = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'New' }] }],
    }
    expect(mergeTiptapDocuments(existing, appended)).toEqual(appended)
  })

  it('merges two documents by concatenating content', () => {
    const existing: TiptapDocument = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Existing' }] }],
    }
    const appended: TiptapDocument = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'New' }] }],
    }
    const merged = mergeTiptapDocuments(existing, appended)
    expect(merged.content).toHaveLength(2)
    expect(tiptapToPlainText(merged)).toContain('Existing')
    expect(tiptapToPlainText(merged)).toContain('New')
  })
})

describe('normalizeTiptapDocument', () => {
  it('returns the value if it is a valid Tiptap document', () => {
    const doc: TiptapDocument = { type: 'doc', content: [{ type: 'paragraph' }] }
    expect(normalizeTiptapDocument(doc)).toBe(doc)
  })

  it('returns an empty document for non-Tiptap input', () => {
    const doc = normalizeTiptapDocument(null)
    expect(doc.type).toBe('doc')
    expect(doc.content).toEqual([{ type: 'paragraph' }])
  })

  it('returns an empty document for undefined', () => {
    expect(normalizeTiptapDocument(undefined)).toEqual(createEmptyTiptapDocument())
  })
})

describe('legacyMeetingToTiptap', () => {
  it('converts a meeting with all fields into a Tiptap document', () => {
    const meeting = {
      summary: 'Good meeting',
      detailed_notes: '## Topic\nDiscussed things',
      action_items: [{ task: 'Follow up', owner: 'Bob', done: false }],
      key_decisions: ['Decided X'],
      follow_ups: ['Check Y'],
    } as Meeting

    const doc = legacyMeetingToTiptap(meeting)
    expect(doc.type).toBe('doc')

    const text = tiptapToPlainText(doc)
    expect(text).toContain('Summary')
    expect(text).toContain('Good meeting')
    expect(text).toContain('Topic')
    expect(text).toContain('Follow up')
    expect(text).toContain('Check Y')
  })

  it('handles a meeting with null fields', () => {
    const meeting = {
      summary: null,
      detailed_notes: null,
      action_items: null,
      key_decisions: null,
      follow_ups: null,
    } as unknown as Meeting

    const doc = legacyMeetingToTiptap(meeting)
    expect(doc.type).toBe('doc')
    expect(doc.content.length).toBeGreaterThanOrEqual(1)
  })
})
