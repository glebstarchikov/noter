import { describe, it, expect, beforeAll, beforeEach, mock, jest } from 'bun:test'

const createClientMock = mock(() => ({}))

mock.module('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

let PATCH: typeof import('./route').PATCH
let DELETE: typeof import('./route').DELETE

beforeAll(async () => {
  const mod = await import('./route')
  PATCH = mod.PATCH
  DELETE = mod.DELETE
})

function baseSupabase(user: { id: string } | null) {
  const auth = { getUser: mock(async () => ({ data: { user } })) }
  return { auth }
}

function makePatchRequest(body: unknown) {
  return new Request('http://localhost/api/templates/uuid-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('PATCH /api/templates/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    ;(createClientMock as typeof createClientMock & { mockResolvedValue: (v: unknown) => void })
      .mockResolvedValue({ ...baseSupabase(null), from: mock(() => { throw new Error('unused') }) } as never)
    const res = await PATCH(makePatchRequest({ name: 'new' }), ctx('uuid-1'))
    expect(res.status).toBe(401)
  })

  it('returns 403 when id starts with builtin-', async () => {
    ;(createClientMock as typeof createClientMock & { mockResolvedValue: (v: unknown) => void })
      .mockResolvedValue({ ...baseSupabase({ id: 'user-1' }), from: mock(() => { throw new Error('unused') }) } as never)
    const res = await PATCH(makePatchRequest({ name: 'new' }), ctx('builtin-general'))
    expect(res.status).toBe(403)
  })

  it('updates custom template and returns it', async () => {
    const singleMock = mock(async () => ({
      data: { id: 'uuid-1', name: 'Updated', description: null, prompt: 'p'.repeat(25) },
      error: null,
    }))
    const selectMock = mock(() => ({ single: singleMock }))
    const eqUserMock = mock(() => ({ select: selectMock }))
    const eqIdMock = mock(() => ({ eq: eqUserMock }))
    const updateMock = mock(() => ({ eq: eqIdMock }))
    const from = mock((table: string) => {
      if (table === 'note_templates') return { update: updateMock }
      throw new Error(`Unexpected table ${table}`)
    })
    ;(createClientMock as typeof createClientMock & { mockResolvedValue: (v: unknown) => void })
      .mockResolvedValue({ ...baseSupabase({ id: 'user-1' }), from } as never)

    const res = await PATCH(makePatchRequest({ name: 'Updated' }), ctx('uuid-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Updated')
    expect(body.isBuiltin).toBe(false)
  })

  it('returns 404 when template not found or not owned', async () => {
    const singleMock = mock(async () => ({ data: null, error: null }))
    const selectMock = mock(() => ({ single: singleMock }))
    const eqUserMock = mock(() => ({ select: selectMock }))
    const eqIdMock = mock(() => ({ eq: eqUserMock }))
    const updateMock = mock(() => ({ eq: eqIdMock }))
    const from = mock(() => ({ update: updateMock }))
    ;(createClientMock as typeof createClientMock & { mockResolvedValue: (v: unknown) => void })
      .mockResolvedValue({ ...baseSupabase({ id: 'user-1' }), from } as never)

    const res = await PATCH(makePatchRequest({ name: 'New' }), ctx('uuid-404'))
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/templates/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 403 for builtin ids', async () => {
    ;(createClientMock as typeof createClientMock & { mockResolvedValue: (v: unknown) => void })
      .mockResolvedValue({ ...baseSupabase({ id: 'user-1' }), from: mock(() => { throw new Error('unused') }) } as never)
    const res = await DELETE(new Request('http://localhost/api/templates/builtin-1on1', { method: 'DELETE' }), ctx('builtin-1on1'))
    expect(res.status).toBe(403)
  })

  it('deletes custom template and resets default if it was the default', async () => {
    const maybeSingleDefault = mock(async () => ({ data: { default_template_id: 'uuid-1' } }))
    const eqUserDefault = mock(() => ({ maybeSingle: maybeSingleDefault }))
    const selectDefault = mock(() => ({ eq: eqUserDefault }))

    const deleteEqUser = mock(async () => ({ error: null }))
    const deleteEqId = mock(() => ({ eq: deleteEqUser }))
    const deleteFromTemplates = mock(() => ({ eq: deleteEqId }))

    const prefsUpdateEqUser = mock(async () => ({ error: null }))
    const prefsUpdateFn = mock(() => ({ eq: prefsUpdateEqUser }))

    const from = mock((table: string) => {
      if (table === 'user_preferences') return { select: selectDefault, update: prefsUpdateFn }
      if (table === 'note_templates') return { delete: deleteFromTemplates }
      throw new Error(`Unexpected table ${table}`)
    })
    ;(createClientMock as typeof createClientMock & { mockResolvedValue: (v: unknown) => void })
      .mockResolvedValue({ ...baseSupabase({ id: 'user-1' }), from } as never)

    const res = await DELETE(new Request('http://localhost/api/templates/uuid-1', { method: 'DELETE' }), ctx('uuid-1'))
    expect(res.status).toBe(200)
    expect(prefsUpdateFn).toHaveBeenCalled()
  })
})
