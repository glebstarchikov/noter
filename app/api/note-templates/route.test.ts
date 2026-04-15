import { describe, it, expect, beforeAll, beforeEach, mock, jest } from 'bun:test'

mock.module('@/lib/supabase/server', () => ({
  createClient: mock(() => {}),
}))

let GET: typeof import('./route').GET
let POST: typeof import('./route').POST
let createClient: typeof import('@/lib/supabase/server').createClient

beforeAll(async () => {
  const routeModule = await import('./route')
  const supabaseModule = await import('@/lib/supabase/server')

  GET = routeModule.GET
  POST = routeModule.POST
  createClient = supabaseModule.createClient
})

function mockSupabase(user: { id: string } | null, queryResult: { data?: unknown; error?: { message: string } | null } = { data: [], error: null }) {
  const orderMock = mock(() => Promise.resolve(queryResult))
  const eqMock = mock(() => ({ order: orderMock }))
  const selectMock = mock(() => ({ eq: eqMock }))

  const insertSingleMock = mock(() => Promise.resolve(queryResult))
  const insertMock = mock(() => ({ select: () => ({ single: insertSingleMock }) }))

  const supabaseMock = {
    auth: { getUser: mock(() => Promise.resolve({ data: { user } })) },
    from: mock(() => ({
      select: selectMock,
      insert: insertMock,
    })),
  };

  (createClient as ReturnType<typeof mock>).mockResolvedValue(supabaseMock as never)
  return { insertMock }
}

describe('GET /api/note-templates', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 if user is not authenticated', async () => {
    mockSupabase(null)
    const response = await GET()
    expect(response.status).toBe(401)
    const payload = await response.json()
    expect(payload.code).toBe('UNAUTHORIZED')
  })

  it('returns list of templates', async () => {
    const templates = [
      { id: '1', name: 'Template 1', prompt: 'Prompt 1' },
      { id: '2', name: 'Template 2', prompt: 'Prompt 2' },
    ]
    mockSupabase({ id: 'user-1' }, { data: templates, error: null })

    const response = await GET()
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.templates).toEqual(templates)
  })

  it('returns empty array when no templates exist', async () => {
    mockSupabase({ id: 'user-1' }, { data: [], error: null })

    const response = await GET()
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.templates).toEqual([])
  })

  it('returns 500 on database error', async () => {
    mockSupabase({ id: 'user-1' }, { data: null, error: { message: 'DB error' } })

    const response = await GET()
    expect(response.status).toBe(500)
    const payload = await response.json()
    expect(payload.code).toBe('FETCH_FAILED')
  })
})

describe('POST /api/note-templates', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  function makeRequest(body: unknown) {
    return new Request('http://localhost/api/note-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns 401 if user is not authenticated', async () => {
    mockSupabase(null)
    const response = await POST(makeRequest({ name: 'Test', prompt: 'Do thing' }))
    expect(response.status).toBe(401)
  })

  it('returns 400 if name is missing', async () => {
    mockSupabase({ id: 'user-1' })
    const response = await POST(makeRequest({ prompt: 'Do thing' }))
    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.code).toBe('INVALID_INPUT')
  })

  it('returns 400 if name is empty string', async () => {
    mockSupabase({ id: 'user-1' })
    const response = await POST(makeRequest({ name: '   ', prompt: 'Do thing' }))
    expect(response.status).toBe(400)
  })

  it('returns 400 if prompt is missing', async () => {
    mockSupabase({ id: 'user-1' })
    const response = await POST(makeRequest({ name: 'Test' }))
    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.code).toBe('INVALID_INPUT')
  })

  it('returns 400 if prompt is empty string', async () => {
    mockSupabase({ id: 'user-1' })
    const response = await POST(makeRequest({ name: 'Test', prompt: '   ' }))
    expect(response.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    mockSupabase({ id: 'user-1' })
    const response = await POST(
      new Request('http://localhost/api/note-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      })
    )
    expect(response.status).toBe(400)
  })

  it('creates a template successfully', async () => {
    const created = { id: 'new-1', name: 'My Template', description: null, prompt: 'Do things' }
    mockSupabase({ id: 'user-1' }, { data: created, error: null })

    const response = await POST(
      makeRequest({ name: 'My Template', prompt: 'Do things' })
    )
    expect(response.status).toBe(201)
    const payload = await response.json()
    expect(payload.template).toEqual(created)
  })

  it('creates template with description', async () => {
    const created = { id: 'new-1', name: 'My Template', description: 'A desc', prompt: 'Do things' }
    mockSupabase({ id: 'user-1' }, { data: created, error: null })

    const response = await POST(
      makeRequest({ name: 'My Template', description: 'A desc', prompt: 'Do things' })
    )
    expect(response.status).toBe(201)
    const payload = await response.json()
    expect(payload.template.description).toBe('A desc')
  })
})
