import { beforeAll, beforeEach, describe, expect, it, mock, jest } from 'bun:test'
import { hashDocumentContent } from '@/lib/document-hash'
import type { TiptapDocument } from '@/lib/tiptap/tiptap-converter'

mock.module('@/lib/supabase/server', () => ({
  createClient: mock(() => {}),
}))

let PATCH: typeof import('./route').PATCH
let createClient: typeof import('@/lib/supabase/server').createClient

beforeAll(async () => {
  const routeModule = await import('./route')
  const supabaseModule = await import('@/lib/supabase/server')

  PATCH = routeModule.PATCH
  createClient = supabaseModule.createClient
})

function makeDocument(text: string): TiptapDocument {
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

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/meetings/meeting-1/document', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function buildMeetingsSelect(meetingData: unknown) {
  const single = mock(() => Promise.resolve({ data: meetingData }))
  const eqUser = mock(() => ({ single }))
  const eqId = mock(() => ({ eq: eqUser }))
  return mock(() => ({ eq: eqId }))
}

function mockSupabase({
  user,
  meetingData = null,
  updateError = null,
}: {
  user: { id: string } | null
  meetingData?: unknown
  updateError?: { message: string } | null
}) {
  const updateCalls: unknown[] = []
  const updateMock = mock((payload: unknown) => {
    updateCalls.push(payload)
    const eqUser = mock(() => Promise.resolve({ error: updateError }))
    const eqId = mock(() => ({ eq: eqUser }))
    return { eq: eqId }
  })

  ;(createClient as any).mockResolvedValue({
    auth: { getUser: mock(() => Promise.resolve({ data: { user } })) },
    from: mock((table: string) => {
      if (table !== 'meetings') {
        throw new Error(`Unexpected table ${table}`)
      }

      return {
        select: buildMeetingsSelect(meetingData),
        update: updateMock,
      }
    }),
  } as never)

  return { updateCalls }
}

describe('PATCH /api/meetings/[id]/document', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 409 with current document details for stale writes', async () => {
    const currentDocument = makeDocument('Accepted reviewed note')
    mockSupabase({
      user: { id: 'user-1' },
      meetingData: {
        id: 'meeting-1',
        document_content: currentDocument,
      },
    })

    const response = await PATCH(
      makeRequest({
        document_content: makeDocument('Stale autosave payload'),
        baseHash: hashDocumentContent(makeDocument('Original note')),
      }),
      { params: Promise.resolve({ id: 'meeting-1' }) }
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: 'A newer version of this note was saved elsewhere.',
      code: 'STALE_DOCUMENT',
      currentDocument,
      currentHash: hashDocumentContent(currentDocument),
    })
  })

  it('returns ok plus the acknowledged hash on success', async () => {
    const currentDocument = makeDocument('Original note')
    const nextDocument = makeDocument('Updated local note')
    const { updateCalls } = mockSupabase({
      user: { id: 'user-1' },
      meetingData: {
        id: 'meeting-1',
        document_content: currentDocument,
      },
    })

    const response = await PATCH(
      makeRequest({
        document_content: nextDocument,
        baseHash: hashDocumentContent(currentDocument),
      }),
      { params: Promise.resolve({ id: 'meeting-1' }) }
    )

    expect(response.status).toBe(200)
    expect(updateCalls).toHaveLength(1)
    expect(updateCalls[0]).toMatchObject({
      document_content: nextDocument,
    })
    expect(await response.json()).toEqual({
      ok: true,
      documentHash: hashDocumentContent(nextDocument),
    })
  })
})
