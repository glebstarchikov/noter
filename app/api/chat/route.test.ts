import { POST } from './route'
import { describe, it, expect, vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'

// Mock the server client
vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(),
}))

// Mock ai-sdk and openai
vi.mock('ai', () => ({
    streamText: vi.fn(),
    convertToModelMessages: vi.fn(),
}))

vi.mock('@ai-sdk/openai', () => ({
    createOpenAI: vi.fn(),
}))

describe('POST /api/chat', () => {
    it('returns 401 Unauthorized if user is not authenticated', async () => {
        const mockSupabase = {
            auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
        }
        vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

        const request = new Request('http://localhost/api/chat', {
            method: 'POST',
            body: JSON.stringify({ meetingId: 'test-id', messages: [] }),
        })

        const response = await POST(request)
        expect(response.status).toBe(401)

        const text = await response.text()
        expect(text).toBe('Unauthorized')
    })
})
