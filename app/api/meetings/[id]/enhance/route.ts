import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-helpers'
import { METADATA_MODEL } from '@/lib/ai-models'
import { hashDocumentContent } from '@/lib/document-hash'
import { resolveMeetingTemplate } from '@/lib/note-template'
import { getOpenAI } from '@/lib/openai'
import { buildDraftProposalPrompt } from '@/lib/prompts'
import {
  hasTiptapContent,
  isTiptapDocument,
  normalizeTiptapDocument,
  tiptapToPlainText,
  type TiptapDocument,
} from '@/lib/tiptap-converter'
import type { EnhancementState, EnhancementOutcome, Meeting } from '@/lib/types'

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

const proposalSchema = z.object({
  summary: z.string().trim().optional().default(''),
  proposed_document_content: z.unknown(),
})

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

function getStructuredContext(meeting: Pick<Meeting, 'summary' | 'detailed_notes' | 'action_items' | 'key_decisions' | 'topics' | 'follow_ups'>) {
  return JSON.stringify({
    summary: meeting.summary ?? '',
    detailed_notes: meeting.detailed_notes ?? '',
    action_items: meeting.action_items ?? [],
    key_decisions: meeting.key_decisions ?? [],
    topics: meeting.topics ?? [],
    follow_ups: meeting.follow_ups ?? [],
  }, null, 2)
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

  try {
    const rawBody = await request.json().catch(() => null)
    const parsedBody = requestSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return errorResponse('Invalid request body', 'INVALID_REQUEST', 400)
    }

    action = parsedBody.data.action

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
    }
    userId = user.id

    const { data: meeting } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!meeting) {
      return errorResponse('Meeting not found', 'MEETING_NOT_FOUND', 404)
    }

    if (!meeting.transcript || !meeting.transcript.trim()) {
      return errorResponse('Transcript is required before generating note drafts', 'MISSING_TRANSCRIPT', 400)
    }

    persistedState = normalizeEnhancementState(meeting.enhancement_state)
    const template = await resolveMeetingTemplate(supabase as { from: (table: string) => any }, {
      template_id: meeting.template_id,
      user_id: user.id,
    })

    if (parsedBody.data.action === 'generate') {
      const sourceDocument = normalizeTiptapDocument(parsedBody.data.documentContent)
      const sourceHash = hashDocumentContent(sourceDocument)
      const currentDocumentText = tiptapToPlainText(sourceDocument).trim()

      const completion = await getOpenAI().chat.completions.create({
        model: METADATA_MODEL,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: buildDraftProposalPrompt({
              mode: parsedBody.data.mode,
              template,
              currentDocumentText,
              structuredContext: getStructuredContext(meeting as Meeting),
              transcript: meeting.transcript,
            }),
          },
        ],
      })

      const content = completion.choices[0]?.message?.content
      if (!content) {
        throw new Error('No proposal returned from AI')
      }

      const parsedProposal = proposalSchema.parse(JSON.parse(content))
      if (!isTiptapDocument(parsedProposal.proposed_document_content)) {
        throw new Error('AI returned an invalid draft proposal')
      }

      const proposedDocument = parsedProposal.proposed_document_content as TiptapDocument
      const proposedHasContent = hasTiptapContent(proposedDocument)
      const sourceHasContent = hasTiptapContent(sourceDocument)
      const proposedHash = hashDocumentContent(proposedDocument)

      if (!proposedHasContent) {
        throw new Error('AI returned an empty draft proposal')
      }

      if (sourceHash === proposedHash || (sourceHasContent && tiptapToPlainText(proposedDocument).trim() === currentDocumentText)) {
        throw new Error('No useful changes were proposed')
      }

      return NextResponse.json({
        mode: parsedBody.data.mode,
        sourceHash,
        summary: parsedProposal.summary,
        proposedDocument,
      })
    }

    const currentDocument = normalizeTiptapDocument(meeting.document_content)
    const currentHash = hashDocumentContent(currentDocument)

    if (currentHash !== parsedBody.data.sourceHash) {
      return errorResponse('The note changed before this review was completed', 'STALE_SOURCE_HASH', 409)
    }

    let nextDocument = currentDocument
    if (parsedBody.data.outcome === 'accepted') {
      if (!isTiptapDocument(parsedBody.data.documentContent)) {
        return errorResponse('Accepted reviews must include documentContent', 'INVALID_DOCUMENT', 400)
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
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to draft notes'

    if (action === 'complete' && id && userId) {
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

        await supabase
          .from('meetings')
          .update({
            enhancement_status: 'error',
            enhancement_state: failureState,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('user_id', userId)
      } catch {
        // Best effort only.
      }
    }

    return errorResponse(message, 'ENHANCEMENT_FAILED', 500)
  }
}
