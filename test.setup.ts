import '@testing-library/jest-dom'
import { mock } from 'bun:test'

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key'
process.env.OPENAI_API_KEY = 'mock-openai-key'

// Mock next/server so unit tests don't error out on import
mock.module('next/server', () => ({
    NextResponse: {
        json: (body: any, init?: any) => new Response(JSON.stringify(body), {
            status: init?.status || 200,
            headers: { 'Content-Type': 'application/json', ...init?.headers },
        })
    },
    NextRequest: class MockNextRequest extends Request {
        nextUrl: URL
        constructor(input: string | URL, init?: RequestInit) {
            super(input, init)
            this.nextUrl = new URL(typeof input === 'string' ? input : input.toString())
        }
    },
}))
