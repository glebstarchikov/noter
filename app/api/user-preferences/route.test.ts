import { describe, it, expect, beforeAll, beforeEach, mock, jest } from 'bun:test'

const createClientMock = mock(() => ({}))

mock.module('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

let PATCH: typeof import('./route').PATCH

beforeAll(async () => {
  const mod = await import('./route')
  PATCH = mod.PATCH
})

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/user-preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockSupabase(opts: {
  user: { id: string } | null
  customOwned?: boolean
}) {
  const customTemplateRow = opts.customOwned ? { id: 'uuid-custom' } : null
  const maybeSingleCustom = mock(async () => ({ data: customTemplateRow }))
  const eqUserTemplates = mock(() => ({ maybeSingle: maybeSingleCustom }))
  const eqIdTemplates = mock(() => ({ eq: eqUserTemplates }))
  const selectTemplates = mock(() => ({ eq: eqIdTemplates }))

  const upsertMock = mock(async () => ({ error: null }))

  const from = mock((table: string) => {
    if (table === 'note_templates') return { select: selectTemplates }
    if (table === 'user_preferences') return { upsert: upsertMock }
    throw new Error(`Unexpected table ${table}`)
  })

  const supabase = {
    auth: { getUser: mock(async () => ({ data: { user: opts.user } })) },
    from,
  }
  ;(createClientMock as typeof createClientMock & { mockResolvedValue: (v: unknown) => void })
    .mockResolvedValue(supabase as never)
  return { upsertMock }
}

describe('PATCH /api/user-preferences', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockSupabase({ user: null })
    const res = await PATCH(makeRequest({ default_template_id: 'builtin-general' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when body is invalid', async () => {
    mockSupabase({ user: { id: 'user-1' } })
    const res = await PATCH(makeRequest({ default_template_id: '' }))
    expect(res.status).toBe(400)
  })

  it('accepts a valid builtin id', async () => {
    const { upsertMock } = mockSupabase({ user: { id: 'user-1' } })
    const res = await PATCH(makeRequest({ default_template_id: 'builtin-1on1' }))
    expect(res.status).toBe(200)
    expect(upsertMock).toHaveBeenCalled()
  })

  it('rejects an unknown builtin id', async () => {
    mockSupabase({ user: { id: 'user-1' } })
    const res = await PATCH(makeRequest({ default_template_id: 'builtin-nonsense' }))
    expect(res.status).toBe(400)
  })

  it('accepts a UUID the user owns', async () => {
    const { upsertMock } = mockSupabase({ user: { id: 'user-1' }, customOwned: true })
    const res = await PATCH(makeRequest({ default_template_id: '11111111-1111-1111-1111-111111111111' }))
    expect(res.status).toBe(200)
    expect(upsertMock).toHaveBeenCalled()
  })

  it('rejects a UUID the user does not own', async () => {
    mockSupabase({ user: { id: 'user-1' }, customOwned: false })
    const res = await PATCH(makeRequest({ default_template_id: '22222222-2222-2222-2222-222222222222' }))
    expect(res.status).toBe(400)
  })
})
