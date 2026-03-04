import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { POST } from './route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@upstash/ratelimit', () => ({ Ratelimit: vi.fn() }))
vi.mock('@upstash/redis', () => ({ Redis: { fromEnv: vi.fn() } }))

function mockSupabase(user: { id: string } | null) {
  const meetingSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'meeting-1', title: 'Weekly' } }),
      }),
    }),
  })

  const chatsInsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'chat-1', title: 'Chat from: Weekly' } }) }),
  })

  const messagesInsert = vi.fn().mockResolvedValue({})

  const from = vi.fn((table: string) => {
    if (table === 'meetings') return { select: meetingSelect }
    if (table === 'chats') return { insert: chatsInsert }
    return { insert: messagesInsert }
  })

  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from,
  } as never)
}

describe('POST /api/chats/transfer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires auth', async () => {
    mockSupabase(null)
    const response = await POST(new Request('http://localhost', { method: 'POST', body: '{}' }))
    expect(response.status).toBe(401)
  })

  it('creates chat from meeting messages', async () => {
    mockSupabase({ id: 'user-1' })
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          meetingId: '550e8400-e29b-41d4-a716-446655440000',
          messages: [{ role: 'user', content: 'hello' }],
        }),
      })
    )
    expect(response.status).toBe(200)
  })
})
