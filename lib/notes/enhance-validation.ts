import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api/api-helpers'
import { isTiptapDocument } from '@/lib/tiptap/tiptap-converter'
import { resolveMeetingTemplate } from '@/lib/note-template'
import type { EnhancementState, Meeting } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export { DraftProposalValidationError } from '@/lib/notes/draft-proposal'

const ratelimit =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      analytics: true,
    })
    : null

const tiptapDocumentSchema = z.unknown().refine(
  (v) => v == null || isTiptapDocument(v),
  { message: 'documentContent must be a valid Tiptap document or omitted' }
)

const requestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('generate'),
    mode: z.enum(['generate', 'enhance']),
    documentContent: tiptapDocumentSchema,
  }),
  z.object({
    action: z.literal('complete'),
    outcome: z.enum(['accepted', 'dismissed']),
    sourceHash: z.string().trim().min(1),
    documentContent: tiptapDocumentSchema.optional(),
  }),
])

export type ParsedRequestBody = z.infer<typeof requestSchema>

export function normalizeEnhancementState(value: unknown): EnhancementState {
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

export function getStructuredContext(
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

export interface ValidatedEnhanceRequest {
  meeting: Meeting
  parsedBody: ParsedRequestBody
  supabase: SupabaseClient
  userId: string
  persistedState: EnhancementState
  template: Awaited<ReturnType<typeof resolveMeetingTemplate>>
}

export async function validateEnhanceRequest(
  request: Request,
  meetingId: string,
): Promise<ValidatedEnhanceRequest | Response> {
  const supabase = await createClient()

  const rawBody = await request.json().catch(() => null)
  const parsedBody = requestSchema.safeParse(rawBody)
  if (!parsedBody.success) {
    return errorResponse('Invalid request body', 'INVALID_REQUEST', 400)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
  }

  if (ratelimit) {
    const { success } = await ratelimit.limit(`enhance_${user.id}`)
    if (!success) {
      return errorResponse('Too Many Requests', 'RATE_LIMITED', 429)
    }
  }

  const { data: meeting } = await supabase
    .from('meetings')
    .select('id, transcript, template_id, document_content, enhancement_state, summary, detailed_notes, action_items, key_decisions, topics, follow_ups')
    .eq('id', meetingId)
    .eq('user_id', user.id)
    .single()

  if (!meeting) {
    return errorResponse('Meeting not found', 'MEETING_NOT_FOUND', 404)
  }

  if (!meeting.transcript || !meeting.transcript.trim()) {
    return errorResponse(
      'Transcript is required before generating note drafts',
      'MISSING_TRANSCRIPT',
      400
    )
  }

  const persistedState = normalizeEnhancementState(meeting.enhancement_state)

  let template: Awaited<ReturnType<typeof resolveMeetingTemplate>>
  try {
    template = await resolveMeetingTemplate(
      supabase as { from: (table: string) => any },
      {
        template_id: meeting.template_id,
        user_id: user.id,
      }
    )
  } catch (error: unknown) {
    Sentry.captureException(error, { tags: { route: 'meetings/enhance', phase: 'template-resolve' } })
    return errorResponse('Failed to resolve meeting template', 'TEMPLATE_ERROR', 500)
  }

  return {
    meeting: meeting as Meeting,
    parsedBody: parsedBody.data,
    supabase: supabase as SupabaseClient,
    userId: user.id,
    persistedState,
    template,
  }
}
