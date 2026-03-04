import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { GET, DELETE } from './route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

function mockSupabase(user: { id: string } | null) {
  const select = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [{ id: '1', title: 'Chat', updated_at: 'now' }] }),
      }),
    }),
  })

  const del = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) }),
  })

  const from = vi.fn(() => ({ select, delete: del }))

  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from,
  } as never)
}

describe('/api/chats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GET requires auth', async () => {
    mockSupabase(null)
    const response = await GET()
    expect(response.status).toBe(401)
  })

  it('GET returns chats', async () => {
    mockSupabase({ id: 'user-1' })
    const response = await GET()
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.chats).toHaveLength(1)
  })

  it('DELETE validates body', async () => {
    mockSupabase({ id: 'user-1' })
    const response = await DELETE(new Request('http://localhost/api/chats', { method: 'DELETE', body: '{}' }))
    expect(response.status).toBe(400)
  })
})
