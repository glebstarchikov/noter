import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { validateEnhanceRequest } from '@/lib/notes/enhance-validation'
import { runEnhanceLlm, EnhanceRouteError } from '@/lib/notes/enhance-llm'
import {
  clearPersistedGenerateError,
  persistCompleteResult,
  persistEnhancementError,
} from '@/lib/notes/enhance-persist'
import { errorResponse } from '@/lib/api/api-helpers'
import { translateToUserError } from '@/lib/notes/error-messages'
import { resolveTemplate, FALLBACK_TEMPLATE_ID } from '@/lib/note-template'

export const maxDuration = 60

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  if (!id) return errorResponse('Missing meetingId', 'INVALID_MEETING_ID', 400)

  const validated = await validateEnhanceRequest(request, id)
  if (validated instanceof Response) return validated

  const { parsedBody } = validated

  // ── complete action ──────────────────────────────────────────────────────────
  if (parsedBody.action === 'complete') {
    try {
      return await persistCompleteResult(validated)
    } catch (error: unknown) {
      const translated = translateToUserError(error)
      Sentry.captureException(error, {
        tags: { route: 'meetings/enhance', action: 'complete' },
        extra: { developerMessage: translated.developerMessage },
      })
      await persistEnhancementError(validated, translated.userMessage)
      return errorResponse(translated.userMessage, 'ENHANCEMENT_FAILED', 500)
    }
  }

  // ── generate action ──────────────────────────────────────────────────────────
  try {
    // Read user preferences to find the default template
    const { data: prefRow } = await validated.supabase
      .from('user_preferences')
      .select('default_template_id')
      .eq('user_id', validated.userId)
      .maybeSingle()

    const templateId = (parsedBody.action === 'generate' ? parsedBody.template_id : undefined)
      ?? prefRow?.default_template_id
      ?? FALLBACK_TEMPLATE_ID

    validated.template = await resolveTemplate(templateId, validated.userId, validated.supabase)

    const llmResult = await runEnhanceLlm(validated)

    await clearPersistedGenerateError(validated)

    return NextResponse.json({
      mode: llmResult.mode,
      sourceHash: llmResult.sourceHash,
      summary: llmResult.summary,
      proposedDocument: llmResult.proposedDocument,
    })
  } catch (error: unknown) {
    const isEnhanceError = error instanceof EnhanceRouteError
    // EnhanceRouteError already carries a user-friendly message; translate everything else
    const translated = isEnhanceError ? null : translateToUserError(error)
    const userMessage = isEnhanceError ? error.message : translated!.userMessage
    const developerMessage = isEnhanceError
      ? (error.logReason ?? error.message)
      : translated!.developerMessage
    const code = isEnhanceError ? error.code : 'MODEL_FAILED'
    const status = isEnhanceError ? error.status : 500

    Sentry.captureException(error, {
      tags: { route: 'meetings/enhance', action: 'generate' },
      extra: { developerMessage },
    })
    await persistEnhancementError(validated, userMessage)
    return errorResponse(userMessage, code, status)
  }
}
