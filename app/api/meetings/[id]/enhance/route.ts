import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { validateEnhanceRequest } from '@/lib/notes/enhance-validation'
import { runEnhanceLlm, type EnhanceRouteError } from '@/lib/notes/enhance-llm'
import {
  clearPersistedGenerateError,
  persistCompleteResult,
  persistEnhancementError,
} from '@/lib/notes/enhance-persist'
import { normalizeTiptapDocument } from '@/lib/tiptap/tiptap-converter'
import { errorResponse } from '@/lib/api/api-helpers'
import { hashDocumentContent } from '@/lib/document-hash'

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
      Sentry.captureException(error, { tags: { route: 'meetings/enhance', action: 'complete' } })
      const message = error instanceof Error ? error.message : 'Enhancement failed'
      await persistEnhancementError(validated, message)
      return errorResponse(message, 'ENHANCEMENT_FAILED', 500)
    }
  }

  // ── generate action ──────────────────────────────────────────────────────────
  try {
    const currentDocument = normalizeTiptapDocument(parsedBody.documentContent)
    const llmResult = await runEnhanceLlm(validated)

    await clearPersistedGenerateError(validated)

    return NextResponse.json({
      mode: llmResult.mode,
      sourceHash: hashDocumentContent(currentDocument),
      summary: llmResult.summary,
      proposedDocument: llmResult.proposedDocument,
    })
  } catch (error: unknown) {
    const isEnhanceError = (e: unknown): e is EnhanceRouteError =>
      e instanceof Error && (e as { code?: unknown }).code !== undefined && (e as { status?: unknown }).status !== undefined

    const message = error instanceof Error ? error.message : 'Enhancement failed'
    const code = isEnhanceError(error) ? (error as EnhanceRouteError).code : 'MODEL_FAILED'
    const status = isEnhanceError(error) ? (error as EnhanceRouteError).status : 500

    Sentry.captureException(error, { tags: { route: 'meetings/enhance', action: 'generate' } })
    await persistEnhancementError(validated, message)
    return errorResponse(message, code, status)
  }
}
