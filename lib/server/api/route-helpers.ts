import { NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import type { User } from '@supabase/supabase-js'

type SupabaseAuthClient = {
  auth: {
    getUser: () => Promise<{ data: { user: User | null } }>
  }
}

export type RequireUserResult =
  | { ok: true; user: User }
  | { ok: false; response: Response }

export function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status })
}

export async function requireUser(supabase: SupabaseAuthClient): Promise<RequireUserResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, response: errorResponse('Unauthorized', 'UNAUTHORIZED', 401) }
  }

  return { ok: true, user }
}

export function createOptionalRatelimit(limit: number, window: `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }

  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(limit, window),
    analytics: true,
  })
}

export async function enforceRateLimit(
  ratelimit: Ratelimit | null,
  userId: string,
  scope: string
) {
  if (!ratelimit) {
    return null
  }

  const { success } = await ratelimit.limit(`${scope}_${userId}`)
  if (!success) {
    return errorResponse('Too Many Requests', 'RATE_LIMITED', 429)
  }

  return null
}
