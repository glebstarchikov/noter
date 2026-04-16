import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { checkRateLimit } from '@/lib/api/rate-limit'

const mockCaptureException = mock(() => {})
mock.module('@sentry/nextjs', () => ({
  captureException: mockCaptureException,
}))

function fakeRatelimit(impl: (key: string) => Promise<{ success: boolean }>) {
  return { limit: impl } as unknown as Parameters<typeof checkRateLimit>[0]
}

describe('checkRateLimit', () => {
  beforeEach(() => {
    mockCaptureException.mockClear()
  })

  test('returns true when ratelimit is null (no ratelimit configured)', async () => {
    const result = await checkRateLimit(null, 'key', 'test-route')
    expect(result).toBe(true)
  })

  test('returns true when limit() reports success', async () => {
    const rl = fakeRatelimit(async () => ({ success: true }))
    const result = await checkRateLimit(rl, 'key', 'test-route')
    expect(result).toBe(true)
  })

  test('returns false when limit() reports rate-limited', async () => {
    const rl = fakeRatelimit(async () => ({ success: false }))
    const result = await checkRateLimit(rl, 'key', 'test-route')
    expect(result).toBe(false)
  })

  test('fails open (returns true) and reports to Sentry when limit() throws', async () => {
    const rl = fakeRatelimit(async () => {
      throw new Error('Upstash unreachable')
    })
    const result = await checkRateLimit(rl, 'key', 'test-route')
    expect(result).toBe(true)
    expect(mockCaptureException).toHaveBeenCalledTimes(1)
    const calls = mockCaptureException.mock.calls as unknown[][]
    expect(calls[0]?.[1]).toMatchObject({
      tags: { route: 'test-route', phase: 'ratelimit' },
      level: 'warning',
    })
  })
})
