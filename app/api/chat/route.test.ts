import { POST } from './route'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'

// Mock the server client
vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(),
}))

// Mock ai-sdk and openai
vi.mock('ai', () => ({
    streamText: vi.fn(),
    convertToModelMessages: vi.fn().mockResolvedValue([]),
    UIMessage: vi.fn(),
}))

vi.mock('@ai-sdk/openai', () => ({
    createOpenAI: vi.fn().mockReturnValue(vi.fn()),
}))

vi.mock('@upstash/ratelimit', () => ({
    Ratelimit: vi.fn(),
}))

vi.mock('@upstash/redis', () => ({
    Redis: { fromEnv: vi.fn() },
}))

function mockSupabase(user: { id: string } | null, meetingData: any = null) {
    const mock = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
        from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: meetingData }),
                    }),
                }),
            }),
        }),
    }
    vi.mocked(createClient).mockResolvedValue(mock as any)
    return mock
}

function makeRequest(body: Record<string, unknown>) {
    return new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

describe('POST /api/chat', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns 401 Unauthorized if user is not authenticated', async () => {
        mockSupabase(null)
        const response = await POST(makeRequest({ meetingId: 'test-id', messages: [] }))
        expect(response.status).toBe(401)
        const text = await response.text()
        expect(text).toBe('Unauthorized')
    })

    it('returns 400 if meetingId is missing', async () => {
        mockSupabase({ id: 'user-1' })
        const response = await POST(makeRequest({ messages: [] }))
        expect(response.status).toBe(400)
        const text = await response.text()
        expect(text).toBe('Missing meetingId')
    })

    it('returns 404 if meeting not found or not owned by user', async () => {
        mockSupabase({ id: 'user-1' }, null)
        const response = await POST(makeRequest({ meetingId: 'bad-id', messages: [] }))
        expect(response.status).toBe(404)
        const text = await response.text()
        expect(text).toBe('Meeting not found')
    })
})
