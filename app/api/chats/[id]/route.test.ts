import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { GET, PATCH } from './route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

function mockSupabase(user: { id: string } | null) {
  const chatsSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'chat-1', title: 'T' } }),
      }),
    }),
  })

  const messageSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [] }) }),
    }),
  })

  const update = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'chat-1', title: 'Renamed' } }) }),
      }),
    }),
  })

  const from = vi.fn((table: string) => {
    if (table === 'chats') return { select: chatsSelect, update }
    return { select: messageSelect }
  })

  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from,
  } as never)
}

describe('/api/chats/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GET returns 401 unauthenticated', async () => {
    mockSupabase(null)
    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'chat-1' }) })
    expect(response.status).toBe(401)
  })

  it('PATCH updates title', async () => {
    mockSupabase({ id: 'user-1' })
    const response = await PATCH(
      new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ title: 'Renamed' }) }),
      { params: Promise.resolve({ id: 'chat-1' }) }
    )
    expect(response.status).toBe(200)
  })
})
