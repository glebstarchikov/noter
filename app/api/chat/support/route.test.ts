import { beforeAll, beforeEach, describe, expect, it, jest, mock } from 'bun:test'

const mockBuildChatModelMessages = mock(() => Promise.resolve([]))
const mockOpenai = mock((model: string) => model)

mock.module('ai', () => ({
  streamText: mock(() => {}),
}))

mock.module('@ai-sdk/openai', () => ({
  openai: mockOpenai,
}))

mock.module('@/lib/chat/chat-message-utils', () => ({
  buildChatModelMessages: mockBuildChatModelMessages,
}))

let POST: typeof import('./route').POST
let streamText: typeof import('ai').streamText

beforeAll(async () => {
  const routeModule = await import('./route')
  const aiModule = await import('ai')

  POST = routeModule.POST
  streamText = aiModule.streamText
})

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/chat/support', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/chat/support', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(streamText as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
      toUIMessageStreamResponse: () => new Response('ok', { status: 200 }),
    })
  })

  it('returns 400 for malformed payloads', async () => {
    const response = await POST(new Request('http://localhost/api/chat/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: 'Request body must be valid JSON',
      code: 'INVALID_INPUT',
    })
  })

  it('allows unauthenticated support requests and routes through OpenAI', async () => {
    const response = await POST(makeRequest({
      messages: [{ id: 'msg-1', role: 'user', parts: [{ type: 'text', text: 'How do I get started?' }] }],
    }))

    expect(response.status).toBe(200)
    expect(mockBuildChatModelMessages).toHaveBeenCalled()
    expect(mockOpenai).toHaveBeenCalledWith('gpt-5.4-mini')
  })

  it('grounds the assistant in noter-only support instructions', async () => {
    const response = await POST(makeRequest({ messages: [] }))

    expect(response.status).toBe(200)

    const call = (streamText as unknown as {
      mock: { calls: Array<[Record<string, unknown>]> }
    }).mock.calls[0][0]

    expect(call.system).toContain('You are noter support')
    expect(call.system).toContain('REFUSE everything outside this list')
    expect(call.system).toContain('Never invent pricing tiers, dates, roadmap, legal terms, or security claims')
  })
})
