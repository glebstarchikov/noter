import { describe, test, expect, mock } from 'bun:test'
import { checkRateLimit } from '@/lib/api/rate-limit'

function fakeRatelimit(impl: (key: string) => Promise<{ success: boolean }>) {
  return { limit: impl } as unknown as Parameters<typeof checkRateLimit>[0]
}

describe('checkRateLimit', () => {
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

  test('fails open (returns true) when limit() throws', async () => {
    const rl = fakeRatelimit(async () => {
      throw new Error('Upstash unreachable')
    })
    const result = await checkRateLimit(rl, 'key', 'test-route')
    expect(result).toBe(true)
  })
})
