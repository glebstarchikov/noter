import { generateObject, NoObjectGeneratedError } from 'ai'
import { openai } from '@ai-sdk/openai'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-helpers'
import { ENHANCEMENT_MODEL } from '@/lib/ai-models'
import { hashDocumentContent } from '@/lib/document-hash'
import {
  assertSupportedEnhancementSourceDocument,
  compileDraftProposalToTiptap,
  DraftProposalValidationError,
  draftProposalSchema,
  validateDraftProposal,
} from '@/lib/draft-proposal'
import { shapeEnhancementContext } from '@/lib/enhancement-context'
import {
  ENHANCEMENT_INVALID_PROPOSAL_MESSAGE,
  ENHANCEMENT_MODEL_FAILED_MESSAGE,
  ENHANCEMENT_NO_USEFUL_CHANGES_MESSAGE,
} from '@/lib/enhancement-errors'
import { resolveMeetingTemplate } from '@/lib/note-template'
import { buildDraftProposalPrompt } from '@/lib/prompts'
import {
  hasTiptapContent,
  isTiptapDocument,
  normalizeTiptapDocument,
  tiptapToPlainText,
  type TiptapDocument,
} from '@/lib/tiptap-converter'
import type { EnhancementOutcome, EnhancementState, Meeting } from '@/lib/types'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      analytics: true,
    })
    : null

const requestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('generate'),
    mode: z.enum(['generate', 'enhance']),
    documentContent: z.unknown(),
  }),
  z.object({
    action: z.literal('complete'),
    outcome: z.enum(['accepted', 'dismissed']),
    sourceHash: z.string().trim().min(1),
    documentContent: z.unknown().optional(),
  }),
])

class EnhanceRouteError extends Error {
  code: string
  status: number
  logReason?: string
  retryUsed: boolean

  constructor(
    message: string,
    code: string,
    status: number,
    logReason?: string,
    retryUsed = false
  ) {
    super(message)
    this.name = 'EnhanceRouteError'
    this.code = code
    this.status = status
    this.logReason = logReason
    this.retryUsed = retryUsed
  }
}

function normalizeEnhancementState(value: unknown): EnhancementState {
  const state = value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {}

  return {
    lastReviewedSourceHash:
      typeof state.lastReviewedSourceHash === 'string' ? state.lastReviewedSourceHash : null,
    lastOutcome:
      state.lastOutcome === 'accepted' || state.lastOutcome === 'dismissed'
        ? state.lastOutcome
        : null,
    lastReviewedAt:
      typeof state.lastReviewedAt === 'string' ? state.lastReviewedAt : null,
    lastError:
      typeof state.lastError === 'string' ? state.lastError : null,
  }
}

function getStructuredContext(
  meeting: Pick<
    Meeting,
    'summary' | 'detailed_notes' | 'action_items' | 'key_decisions' | 'topics' | 'follow_ups'
  >
) {
  return JSON.stringify(
    {
      summary: meeting.summary ?? '',
      detailed_notes: meeting.detailed_notes ?? '',
      action_items: meeting.action_items ?? [],
      key_decisions: meeting.key_decisions ?? [],
      topics: meeting.topics ?? [],
      follow_ups: meeting.follow_ups ?? [],
    },
    null,
    2
  )
}

function logEnhancementGenerate(event: string, payload: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      scope: 'meetings.enhance.generate',
      event,
      ...payload,
    })
  )
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error'
}

function isRetryableDraftError(error: unknown) {
  return (
    NoObjectGeneratedError.isInstance(error) ||
    error instanceof DraftProposalValidationError
  )
}

async function generateProposalDocument({
  mode,
  template,
  currentDocumentText,
  structuredContext,
  transcript,
}: {
  mode: 'generate' | 'enhance'
  template: Awaited<ReturnType<typeof resolveMeetingTemplate>>
  currentDocumentText: string
  structuredContext: string
  transcript: string
}) {
  let firstPassFailureReason: string | null = null

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const { object } = await generateObject({
        model: openai(ENHANCEMENT_MODEL),
        schema: draftProposalSchema,
        temperature: 0.2,
        providerOptions: {
          openai: {
            strictJsonSchema: true,
          },
        },
        prompt: buildDraftProposalPrompt({
          mode,
          template,
          currentDocumentText,
          structuredContext,
          transcript,
          repairFeedback: attempt === 2 ? firstPassFailureReason : null,
        }),
      })

      const proposal = validateDraftProposal(object)
      const proposedDocument = compileDraftProposalToTiptap(proposal)

      return {
        proposal,
        proposedDocument,
        retryUsed: attempt === 2,
        firstPassFailureReason,
      }
    } catch (error: unknown) {
      const failureReason = getErrorMessage(error)

      if (attempt === 1 && isRetryableDraftError(error)) {
        firstPassFailureReason = failureReason
        continue
      }

      if (isRetryableDraftError(error)) {
        throw new EnhanceRouteError(
          ENHANCEMENT_INVALID_PROPOSAL_MESSAGE,
          'INVALID_PROPOSAL',
          502,
          failureReason,
          true
        )
      }

      throw new EnhanceRouteError(
        ENHANCEMENT_MODEL_FAILED_MESSAGE,
        'MODEL_FAILED',
        502,
        failureReason,
        false
      )
    }
  }

  throw new EnhanceRouteError(
    ENHANCEMENT_MODEL_FAILED_MESSAGE,
    'MODEL_FAILED',
    502,
    'Draft generation exhausted unexpectedly',
    true
  )
}

export const maxDuration = 60

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const supabase = await createClient()
  let userId: string | null = null
  let action: 'generate' | 'complete' | null = null
  let persistedState: EnhancementState | null = null
  let meetingOwnerId: string | null = null
  let generateLogContext: Record<string, unknown> | null = null

  const persistEnhancementState = async ({
    status,
    state,
  }: {
    status: 'idle' | 'error'
    state: EnhancementState
  }) => {
    if (!id || !meetingOwnerId) return

    const { error } = await supabase
      .from('meetings')
      .update({
        enhancement_status: status,
        enhancement_state: state,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', meetingOwnerId)

    if (error) {
      throw new Error(error.message)
    }
  }

  try {
    const rawBody = await request.json().catch(() => null)
    const parsedBody = requestSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return errorResponse('Invalid request body', 'INVALID_REQUEST', 400)
    }

    action = parsedBody.data.action

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
    }
    userId = user.id

    if (ratelimit) {
      const { success } = await ratelimit.limit(`enhance_${user.id}`)
      if (!success) {
        return errorResponse('Too Many Requests', 'RATE_LIMITED', 429)
      }
    }

    const { data: meeting } = await supabase
      .from('meetings')
      .select('id, transcript, template_id, document_content, enhancement_state, summary, detailed_notes, action_items, key_decisions, topics, follow_ups')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!meeting) {
      return errorResponse('Meeting not found', 'MEETING_NOT_FOUND', 404)
    }
    meetingOwnerId = user.id

    if (!meeting.transcript || !meeting.transcript.trim()) {
      return errorResponse(
        'Transcript is required before generating note drafts',
        'MISSING_TRANSCRIPT',
        400
      )
    }

    persistedState = normalizeEnhancementState(meeting.enhancement_state)
    const template = await resolveMeetingTemplate(
      supabase as { from: (table: string) => any },
      {
        template_id: meeting.template_id,
        user_id: user.id,
      }
    )

    if (parsedBody.data.action === 'generate') {
      const sourceDocument = normalizeTiptapDocument(parsedBody.data.documentContent)
      const sourceHash = hashDocumentContent(sourceDocument)
      const currentDocumentText = tiptapToPlainText(sourceDocument).trim()
      const shapedContext = shapeEnhancementContext({
        currentDocumentText,
        structuredContext: getStructuredContext(meeting as Meeting),
        transcript: meeting.transcript,
      })

      generateLogContext = {
        meetingId: id,
        mode: parsedBody.data.mode,
        model: ENHANCEMENT_MODEL,
        currentDocumentChars: shapedContext.currentDocumentText.length,
        structuredContextChars: shapedContext.structuredContext.length,
        transcriptChars: shapedContext.transcript.length,
      }

      if (parsedBody.data.mode === 'enhance') {
        try {
          assertSupportedEnhancementSourceDocument(sourceDocument)
        } catch (error: unknown) {
          const failureReason = getErrorMessage(error)
          throw new EnhanceRouteError(
            ENHANCEMENT_INVALID_PROPOSAL_MESSAGE,
            'INVALID_PROPOSAL',
            409,
            failureReason
          )
        }
      }

      const generated = await generateProposalDocument({
        mode: parsedBody.data.mode,
        template,
        currentDocumentText: shapedContext.currentDocumentText,
        structuredContext: shapedContext.structuredContext,
        transcript: shapedContext.transcript,
      })

      const proposedHasContent = hasTiptapContent(generated.proposedDocument)
      const sourceHasContent = hasTiptapContent(sourceDocument)
      const proposedHash = hashDocumentContent(generated.proposedDocument)

      if (!proposedHasContent) {
        throw new EnhanceRouteError(
          ENHANCEMENT_INVALID_PROPOSAL_MESSAGE,
          'INVALID_PROPOSAL',
          502,
          'Compiled proposal had no content'
        )
      }

      if (
        sourceHash === proposedHash ||
        (sourceHasContent &&
          tiptapToPlainText(generated.proposedDocument).trim() === currentDocumentText)
      ) {
        throw new EnhanceRouteError(
          ENHANCEMENT_NO_USEFUL_CHANGES_MESSAGE,
          'NO_USEFUL_CHANGES',
          409,
          'Generated proposal was materially identical to the source document'
        )
      }

      if (persistedState?.lastError) {
        const clearedState: EnhancementState = {
          ...persistedState,
          lastError: null,
        }
        try {
          await persistEnhancementState({ status: 'idle', state: clearedState })
        } catch {
          // Best effort only. The review can still proceed locally.
        }
      }

      logEnhancementGenerate('success', {
        ...generateLogContext,
        retryUsed: generated.retryUsed,
        firstPassFailureReason: generated.firstPassFailureReason,
        outcomeCode: 'OK',
      })

      return NextResponse.json({
        mode: parsedBody.data.mode,
        sourceHash,
        summary: generated.proposal.summary,
        proposedDocument: generated.proposedDocument,
      })
    }

    const currentDocument = normalizeTiptapDocument(meeting.document_content)
    const currentHash = hashDocumentContent(currentDocument)

    if (currentHash !== parsedBody.data.sourceHash) {
      return errorResponse(
        'The note changed before this review was completed',
        'STALE_SOURCE_HASH',
        409
      )
    }

    let nextDocument = currentDocument
    if (parsedBody.data.outcome === 'accepted') {
      if (!isTiptapDocument(parsedBody.data.documentContent)) {
        return errorResponse(
          'Accepted reviews must include documentContent',
          'INVALID_DOCUMENT',
          400
        )
      }

      nextDocument = parsedBody.data.documentContent as TiptapDocument
    }

    const nextState: EnhancementState = {
      lastReviewedSourceHash: hashDocumentContent(nextDocument),
      lastOutcome: parsedBody.data.outcome,
      lastReviewedAt: new Date().toISOString(),
      lastError: null,
    }

    const updatePayload: Record<string, unknown> = {
      enhancement_status: 'idle',
      enhancement_state: nextState,
      updated_at: new Date().toISOString(),
    }

    if (parsedBody.data.outcome === 'accepted') {
      updatePayload.document_content = nextDocument
    }

    const { error: updateError } = await supabase
      .from('meetings')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)

    if (updateError) {
      throw new Error(updateError.message)
    }

    return NextResponse.json({
      ok: true,
      outcome: parsedBody.data.outcome as EnhancementOutcome,
      enhancement_state: nextState,
      document_content: nextDocument,
      documentHash: hashDocumentContent(nextDocument),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to draft notes'
    const code =
      error instanceof EnhanceRouteError
        ? error.code
        : action === 'generate'
          ? 'MODEL_FAILED'
          : 'ENHANCEMENT_FAILED'
    const status = error instanceof EnhanceRouteError ? error.status : 500

    if (action === 'generate' && generateLogContext) {
      logEnhancementGenerate('failed', {
        ...generateLogContext,
        retryUsed: error instanceof EnhanceRouteError ? error.retryUsed : false,
        finalReason: error instanceof EnhanceRouteError ? error.logReason ?? message : message,
        outcomeCode: code,
      })
    }

    if ((action === 'generate' || action === 'complete') && id && userId) {
      try {
        const failureState: EnhancementState = {
          ...(persistedState ?? {
            lastReviewedSourceHash: null,
            lastOutcome: null,
            lastReviewedAt: null,
            lastError: null,
          }),
          lastError: message,
        }

        await persistEnhancementState({
          status: 'error',
          state: failureState,
        })
      } catch {
        // Best effort only.
      }
    }

    return errorResponse(message, code, status)
  }
}
