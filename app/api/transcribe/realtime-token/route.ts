import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api/api-helpers'

export const maxDuration = 10

/**
 * Returns a Deepgram key to authenticated users for browser-based
 * WebSocket transcription.
 *
 * Security model:
 * - When DEEPGRAM_PROJECT_ID is set (production), creates a short-lived
 *   temporary key (5 min TTL, usage:write scope only) via the Deepgram
 *   Management API. The main API key never reaches the browser.
 * - When DEEPGRAM_PROJECT_ID is NOT set (local dev), falls back to
 *   returning the raw API key with a console warning.
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)

    const apiKey = process.env.DEEPGRAM_API_KEY
    if (!apiKey) return errorResponse('Deepgram not configured', 'NOT_CONFIGURED', 503)

    const projectId = process.env.DEEPGRAM_PROJECT_ID

    if (projectId) {
      // Production path: create a short-lived temporary key so the main
      // API key is never exposed to the browser.
      const res = await fetch(
        `https://api.deepgram.com/v1/projects/${projectId}/keys`,
        {
          method: 'POST',
          headers: {
            Authorization: `Token ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            comment: 'browser-session-temp',
            scopes: ['usage:write'],
            time_to_live_in_seconds: 300,
            tags: ['browser'],
          }),
        },
      )

      if (!res.ok) {
        const detail = await res.text().catch(() => 'unknown error')
        Sentry.captureException(new Error(`Deepgram temp key creation failed: ${res.status} ${detail}`))
        return errorResponse('Failed to create temporary key', 'TOKEN_CREATE_FAILED', 502)
      }

      const data = await res.json()
      return NextResponse.json({ key: data.key })
    }

    // Development fallback: return the raw key but warn about it.
    Sentry.captureMessage(
      'DEEPGRAM_PROJECT_ID is not set — returning raw API key. Set DEEPGRAM_PROJECT_ID in production to enable short-lived temporary keys.',
      {
        level: 'warning',
        tags: { route: 'transcribe/realtime-token' },
      },
    )
    return NextResponse.json({ key: apiKey })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create token'
    return errorResponse(message, 'TOKEN_CREATE_FAILED', 500)
  }
}
