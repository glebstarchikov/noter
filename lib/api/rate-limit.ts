import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import * as Sentry from '@sentry/nextjs'

export function createRateLimiter(
  requests: number,
  window: `${number} ${'s' | 'm' | 'h'}`,
): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: true,
  })
}

/**
 * Check if a request is allowed under the given rate limit.
 *
 * - If ratelimit is null (not configured), always returns true.
 * - On successful check, returns the `success` flag from Upstash.
 * - On backend failure (network error, Upstash down, etc.), logs a warning
 *   to Sentry and returns true — fail open, because rate limiting should
 *   never cause a 500.
 */
export async function checkRateLimit(
  ratelimit: Ratelimit | null,
  key: string,
  routeTag: string,
): Promise<boolean> {
  if (!ratelimit) return true
  try {
    const { success } = await ratelimit.limit(key)
    return success
  } catch (error) {
    Sentry.captureException(error, {
      tags: { route: routeTag, phase: 'ratelimit' },
      level: 'warning',
    })
    return true
  }
}
