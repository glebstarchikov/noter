import { describe, it, expect } from 'bun:test'
import { hashDocumentContent, hashUnknownContent } from '../document-hash'
import type { TiptapDocument } from '../tiptap/tiptap-converter'

describe('hashDocumentContent', () => {
  it('returns an 8-character hex string', () => {
    const doc: TiptapDocument = { type: 'doc', content: [{ type: 'paragraph' }] }
    const hash = hashDocumentContent(doc)
    expect(hash).toMatch(/^[0-9a-f]{8}$/)
  })

  it('produces the same hash for the same document', () => {
    const doc: TiptapDocument = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
    }
    expect(hashDocumentContent(doc)).toBe(hashDocumentContent(doc))
  })

  it('produces different hashes for different documents', () => {
    const doc1: TiptapDocument = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
    }
    const doc2: TiptapDocument = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'World' }] }],
    }
    expect(hashDocumentContent(doc1)).not.toBe(hashDocumentContent(doc2))
  })

  it('produces consistent hash regardless of key order', () => {
    const doc1 = { type: 'doc' as const, content: [{ type: 'paragraph', attrs: { a: 1, b: 2 } }] }
    const doc2 = { type: 'doc' as const, content: [{ type: 'paragraph', attrs: { b: 2, a: 1 } }] }
    expect(hashDocumentContent(doc1)).toBe(hashDocumentContent(doc2))
  })
})

describe('hashUnknownContent', () => {
  it('hashes strings', () => {
    const hash = hashUnknownContent('hello')
    expect(hash).toMatch(/^[0-9a-f]{8}$/)
  })

  it('hashes numbers', () => {
    expect(hashUnknownContent(42)).toMatch(/^[0-9a-f]{8}$/)
  })

  it('hashes null', () => {
    expect(hashUnknownContent(null)).toMatch(/^[0-9a-f]{8}$/)
  })

  it('hashes undefined', () => {
    expect(hashUnknownContent(undefined)).toMatch(/^[0-9a-f]{8}$/)
  })

  it('hashes arrays', () => {
    expect(hashUnknownContent([1, 2, 3])).toMatch(/^[0-9a-f]{8}$/)
  })

  it('produces same hash for null and undefined', () => {
    expect(hashUnknownContent(null)).toBe(hashUnknownContent(undefined))
  })

  it('produces different hashes for different values', () => {
    expect(hashUnknownContent('a')).not.toBe(hashUnknownContent('b'))
  })
})
