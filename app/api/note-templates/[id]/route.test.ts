import { describe, it, expect, beforeAll, beforeEach, mock, jest } from 'bun:test'

mock.module('@/lib/supabase/server', () => ({
  createClient: mock(() => {}),
}))

let PATCH: typeof import('./route').PATCH
let DELETE: typeof import('./route').DELETE
let createClient: typeof import('@/lib/supabase/server').createClient

beforeAll(async () => {
  const routeModule = await import('./route')
  const supabaseModule = await import('@/lib/supabase/server')

  PATCH = routeModule.PATCH
  DELETE = routeModule.DELETE
  createClient = supabaseModule.createClient
})

function mockSupabase(
  user: { id: string } | null,
  options: {
    updateResult?: { data?: unknown; error?: { message: string; code?: string } | null }
    deleteResult?: { error?: { message: string } | null }
  } = {}
) {
  const { updateResult = { data: null, error: null }, deleteResult = { error: null } } = options

  const updateSingleMock = mock(() => Promise.resolve(updateResult))
  const updateEqUser = mock(() => ({ select: () => ({ single: updateSingleMock }) }))
  const updateEqId = mock(() => ({ eq: updateEqUser }))
  const updateMock = mock(() => ({ eq: updateEqId }))

  const deleteEqUser = mock(() => Promise.resolve(deleteResult))
  const deleteEqId = mock(() => ({ eq: deleteEqUser }))
  const deleteMock = mock(() => ({ eq: deleteEqId }))

  const supabaseMock = {
    auth: { getUser: mock(() => Promise.resolve({ data: { user } })) },
    from: mock(() => ({
      update: updateMock,
      delete: deleteMock,
    })),
  };

  (createClient as ReturnType<typeof mock>).mockResolvedValue(supabaseMock as never)
  return { updateMock }
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('PATCH /api/note-templates/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  function makeRequest(body: unknown) {
    return new Request('http://localhost/api/note-templates/t-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns 401 if user is not authenticated', async () => {
    mockSupabase(null)
    const response = await PATCH(makeRequest({ name: 'Updated' }), makeParams('t-1'))
    expect(response.status).toBe(401)
    const payload = await response.json()
    expect(payload.code).toBe('UNAUTHORIZED')
  })

  it('returns 400 if body is invalid JSON', async () => {
    mockSupabase({ id: 'user-1' })
    const response = await PATCH(
      new Request('http://localhost/api/note-templates/t-1', {
        method: 'PATCH',
        body: 'not json',
      }),
      makeParams('t-1')
    )
    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.code).toBe('INVALID_INPUT')
  })

  it('updates a template name successfully', async () => {
    const updated = { id: 't-1', name: 'Updated Name', description: null, prompt: 'Prompt' }
    mockSupabase({ id: 'user-1' }, { updateResult: { data: updated, error: null } })

    const response = await PATCH(makeRequest({ name: 'Updated Name' }), makeParams('t-1'))
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.template).toEqual(updated)
  })

  it('returns 404 when template not found', async () => {
    mockSupabase({ id: 'user-1' }, {
      updateResult: {
        data: null,
        error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
      },
    })

    const response = await PATCH(makeRequest({ name: 'Updated' }), makeParams('nonexistent'))
    expect(response.status).toBe(404)
    const payload = await response.json()
    expect(payload.code).toBe('NOT_FOUND')
  })

  it('returns 500 on database error', async () => {
    mockSupabase({ id: 'user-1' }, {
      updateResult: { data: null, error: { message: 'DB error' } },
    })

    const response = await PATCH(makeRequest({ name: 'Updated' }), makeParams('t-1'))
    expect(response.status).toBe(500)
    const payload = await response.json()
    expect(payload.code).toBe('UPDATE_FAILED')
  })
})

describe('DELETE /api/note-templates/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 if user is not authenticated', async () => {
    mockSupabase(null)
    const request = new Request('http://localhost/api/note-templates/t-1', { method: 'DELETE' })
    const response = await DELETE(request, makeParams('t-1'))
    expect(response.status).toBe(401)
  })

  it('deletes a template successfully', async () => {
    mockSupabase({ id: 'user-1' }, { deleteResult: { error: null } })

    const request = new Request('http://localhost/api/note-templates/t-1', { method: 'DELETE' })
    const response = await DELETE(request, makeParams('t-1'))
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.ok).toBe(true)
  })

  it('returns 500 on database error', async () => {
    mockSupabase({ id: 'user-1' }, { deleteResult: { error: { message: 'DB error' } } })

    const request = new Request('http://localhost/api/note-templates/t-1', { method: 'DELETE' })
    const response = await DELETE(request, makeParams('t-1'))
    expect(response.status).toBe(500)
    const payload = await response.json()
    expect(payload.code).toBe('DELETE_FAILED')
  })
})
