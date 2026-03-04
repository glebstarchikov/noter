import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { streamText } from 'ai'
import { POST } from './route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('ai', () => ({
  streamText: vi.fn(),
  convertToModelMessages: vi.fn().mockResolvedValue([]),
  UIMessage: vi.fn(),
}))
vi.mock('@ai-sdk/openai', () => ({ createOpenAI: vi.fn().mockReturnValue(vi.fn()) }))
vi.mock('@upstash/ratelimit', () => ({ Ratelimit: vi.fn() }))
vi.mock('@upstash/redis', () => ({ Redis: { fromEnv: vi.fn() } }))

function mockSupabase(user: { id: string } | null) {
  const chatsSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'chat-1' } }) }),
    }),
  })
  const chatsInsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'chat-1' } }) }) })
  const chatsUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) }) })
  const meetingsSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: [] }) }),
      }),
    }),
  })
  const from = vi.fn((table: string) => {
    if (table === 'chats') return { select: chatsSelect, insert: chatsInsert, update: chatsUpdate }
    if (table === 'meetings') return { select: meetingsSelect }
    return { insert: vi.fn().mockResolvedValue({}) }
  })

  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from,
  } as never)
}

describe('POST /api/global-chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(streamText).mockReturnValue({
      toUIMessageStreamResponse: () => new Response('ok'),
    } as never)
  })

  it('returns 401 when unauthenticated', async () => {
    mockSupabase(null)
    const response = await POST(new Request('http://localhost', { method: 'POST', body: '{}' }))
    expect(response.status).toBe(401)
  })

  it('returns 400 for bad payload', async () => {
    mockSupabase({ id: 'user-1' })
    const response = await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ messages: 1 }) }))
    expect(response.status).toBe(400)
  })

  it('streams response for valid request', async () => {
    mockSupabase({ id: 'user-1' })
    const response = await POST(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ id: '1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
      }),
    }))

    expect(response.status).toBe(200)
  })
})
