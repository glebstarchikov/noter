import { describe, it, expect, beforeAll, beforeEach, mock, jest } from 'bun:test'

const createClientMock = mock(() => ({}))

mock.module('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

let GET: typeof import('./route').GET
let POST: typeof import('./route').POST

beforeAll(async () => {
  const mod = await import('./route')
  GET = mod.GET
  POST = mod.POST
})

function mockSupabase(user: { id: string } | null, templatesRows: Array<{ id: string; name: string; description: string | null; prompt: string }> = [], prefRow: { default_template_id: string } | null = null) {
  const orderMock = mock(async () => ({ data: templatesRows }))
  const eqTemplatesUser = mock(() => ({ order: orderMock }))
  const selectTemplates = mock(() => ({ eq: eqTemplatesUser }))

  const maybeSinglePref = mock(async () => ({ data: prefRow }))
  const eqPrefUser = mock(() => ({ maybeSingle: maybeSinglePref }))
  const selectPref = mock(() => ({ eq: eqPrefUser }))

  const from = mock((table: string) => {
    if (table === 'note_templates') return { select: selectTemplates }
    if (table === 'user_preferences') return { select: selectPref }
    throw new Error(`Unexpected table ${table}`)
  })

  const supabase = {
    auth: { getUser: mock(async () => ({ data: { user } })) },
    from,
  }
  ;(createClientMock as typeof createClientMock & { mockResolvedValue: (v: unknown) => void })
    .mockResolvedValue(supabase as never)
  return { from }
}

describe('GET /api/templates', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockSupabase(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns merged list with default from user_preferences', async () => {
    mockSupabase(
      { id: 'user-1' },
      [{ id: 'uuid-1', name: 'Custom A', description: null, prompt: 'p'.repeat(25) }],
      { default_template_id: 'builtin-1on1' },
    )
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.defaultTemplateId).toBe('builtin-1on1')
    expect(body.templates.length).toBe(6)
    expect(body.templates.some((t: { id: string }) => t.id === 'uuid-1')).toBe(true)
  })

  it('falls back to builtin-general when user_preferences row missing', async () => {
    mockSupabase({ id: 'user-1' }, [], null)
    const res = await GET()
    const body = await res.json()
    expect(body.defaultTemplateId).toBe('builtin-general')
  })
})

describe('POST /api/templates', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  function mockInsertSuccess(user: { id: string }, row: { id: string; name: string; description: string | null; prompt: string }) {
    const singleMock = mock(async () => ({ data: row, error: null }))
    const selectMock = mock(() => ({ single: singleMock }))
    const insertMock = mock(() => ({ select: selectMock }))
    const from = mock((table: string) => {
      if (table === 'note_templates') return { insert: insertMock }
      throw new Error(`Unexpected table ${table}`)
    })
    const supabase = {
      auth: { getUser: mock(async () => ({ data: { user } })) },
      from,
    }
    ;(createClientMock as typeof createClientMock & { mockResolvedValue: (v: unknown) => void })
      .mockResolvedValue(supabase as never)
    return { insertMock }
  }

  function makeRequest(body: unknown) {
    return new Request('http://localhost/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns 401 when unauthenticated', async () => {
    mockSupabase(null)
    const res = await POST(makeRequest({ name: 'x', prompt: 'long enough prompt body here.' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when body is invalid', async () => {
    mockSupabase({ id: 'user-1' })
    const res = await POST(makeRequest({ name: '', prompt: 'short' }))
    expect(res.status).toBe(400)
  })

  it('creates a custom template and returns it', async () => {
    mockInsertSuccess(
      { id: 'user-1' },
      { id: 'uuid-new', name: 'Custom A', description: null, prompt: 'p'.repeat(25) },
    )
    const res = await POST(makeRequest({
      name: 'Custom A',
      prompt: 'p'.repeat(25),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('uuid-new')
    expect(body.isBuiltin).toBe(false)
  })
})
