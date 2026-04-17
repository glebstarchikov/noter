import { describe, it, expect, beforeEach } from 'bun:test'
import {
  saveMeetingDocument,
  isDocumentSaveConflict,
  type DocumentSaveSuccess,
  type DocumentSaveConflict,
} from '../document-sync'
import type { TiptapDocument } from '../tiptap/tiptap-converter'

const testDoc: TiptapDocument = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
}

describe('saveMeetingDocument', () => {
  beforeEach(() => {
    globalThis.fetch = (() => {}) as unknown as typeof fetch
  })

  it('returns success with documentHash on 200 response', async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(JSON.stringify({ documentHash: 'abc123' }), { status: 200 })
      )) as unknown as typeof fetch

    const result = await saveMeetingDocument({
      meetingId: 'meeting-1',
      document: testDoc,
      baseHash: 'old-hash',
    })

    expect(result.ok).toBe(true)
    expect((result as DocumentSaveSuccess).documentHash).toBe('abc123')
  })

  it('falls back to baseHash when response has no documentHash', async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(JSON.stringify({}), { status: 200 })
      )) as unknown as typeof fetch

    const result = await saveMeetingDocument({
      meetingId: 'meeting-1',
      document: testDoc,
      baseHash: 'fallback-hash',
    })

    expect(result.ok).toBe(true)
    expect((result as DocumentSaveSuccess).documentHash).toBe('fallback-hash')
  })

  it('returns conflict on 409 response', async () => {
    const conflictDoc: TiptapDocument = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Conflict' }] }],
    }
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            error: 'Stale document',
            currentDocument: conflictDoc,
            currentHash: 'new-hash',
          }),
          { status: 409 }
        )
      )) as unknown as typeof fetch

    const result = await saveMeetingDocument({
      meetingId: 'meeting-1',
      document: testDoc,
      baseHash: 'old-hash',
    })

    expect(result.ok).toBe(false)
    const conflict = result as DocumentSaveConflict
    expect(conflict.code).toBe('STALE_DOCUMENT')
    expect(conflict.message).toBe('Stale document')
    expect(conflict.currentHash).toBe('new-hash')
  })

  it('uses default message on 409 without error string', async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(JSON.stringify({}), { status: 409 })
      )) as unknown as typeof fetch

    const result = await saveMeetingDocument({
      meetingId: 'meeting-1',
      document: testDoc,
      baseHash: 'old-hash',
    })

    expect(result.ok).toBe(false)
    expect((result as DocumentSaveConflict).message).toBe(
      'A newer version of this note was saved elsewhere.'
    )
  })

  it('throws on non-ok, non-409 response', async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: 'Server error' }), { status: 500 })
      )) as unknown as typeof fetch

    await expect(
      saveMeetingDocument({
        meetingId: 'meeting-1',
        document: testDoc,
        baseHash: 'old-hash',
      })
    ).rejects.toThrow('Server error')
  })

  it('throws with default message on non-ok response without error', async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(JSON.stringify({}), { status: 500 })
      )) as unknown as typeof fetch

    await expect(
      saveMeetingDocument({
        meetingId: 'meeting-1',
        document: testDoc,
        baseHash: 'old-hash',
      })
    ).rejects.toThrow('Failed to save the current note')
  })

  it('sends correct request to the right URL', async () => {
    let capturedUrl = ''
    let capturedBody = ''
    globalThis.fetch = ((url: string, init: RequestInit) => {
      capturedUrl = url
      capturedBody = init.body as string
      return Promise.resolve(
        new Response(JSON.stringify({ documentHash: 'h' }), { status: 200 })
      )
    }) as unknown as typeof fetch

    await saveMeetingDocument({
      meetingId: 'test-id',
      document: testDoc,
      baseHash: 'base',
    })

    expect(capturedUrl).toBe('/api/meetings/test-id/document')
    const body = JSON.parse(capturedBody)
    expect(body.document_content).toEqual(testDoc)
    expect(body.baseHash).toBe('base')
  })
})

describe('isDocumentSaveConflict', () => {
  it('returns true for conflict result', () => {
    const conflict: DocumentSaveConflict = {
      ok: false,
      code: 'STALE_DOCUMENT',
      message: 'Stale',
      currentDocument: { type: 'doc', content: [] },
      currentHash: 'h',
    }
    expect(isDocumentSaveConflict(conflict)).toBe(true)
  })

  it('returns false for success result', () => {
    const success: DocumentSaveSuccess = { ok: true, documentHash: 'h' }
    expect(isDocumentSaveConflict(success)).toBe(false)
  })
})
