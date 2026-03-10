import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-helpers'

export const maxDuration = 10

/**
 * Returns a Deepgram API key to authenticated users for browser-based
 * WebSocket transcription. Only accessible to signed-in users.
 *
 * For production hardening, set DEEPGRAM_PROJECT_ID to enable short-lived
 * temporary keys via the Deepgram Management API.
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)

    const apiKey = process.env.DEEPGRAM_API_KEY
    if (!apiKey) return errorResponse('Deepgram not configured', 'NOT_CONFIGURED', 503)

    return NextResponse.json({ key: apiKey })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create token'
    return errorResponse(message, 'TOKEN_CREATE_FAILED', 500)
  }
}
