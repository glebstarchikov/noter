import { NextResponse } from 'next/server'
import { hashDocumentContent } from '@/lib/document-hash'
import {
  isTiptapDocument,
  normalizeTiptapDocument,
  type TiptapDocument,
} from '@/lib/tiptap/tiptap-converter'
import { errorResponse } from '@/lib/api/api-helpers'
import { normalizeEnhancementState, type ValidatedEnhanceRequest } from '@/lib/notes/enhance-validation'
import type { LlmEnhanceResult } from '@/lib/notes/enhance-llm'
import type { EnhancementOutcome, EnhancementState } from '@/lib/types'

// ── generate action: best-effort clear of a persisted lastError ──────────────

export async function clearPersistedGenerateError(
  validated: ValidatedEnhanceRequest,
): Promise<void> {
  const { meeting, supabase, userId, persistedState } = validated

  if (!persistedState.lastError) return

  const clearedState: EnhancementState = {
    ...persistedState,
    lastError: null,
  }

  try {
    await supabase
      .from('meetings')
      .update({
        enhancement_status: 'idle',
        enhancement_state: clearedState,
        updated_at: new Date().toISOString(),
      })
      .eq('id', meeting.id)
      .eq('user_id', userId)
  } catch {
    // Best effort only. The review can still proceed locally.
  }
}

// ── complete action: persist the accepted/dismissed outcome ──────────────────

export interface CompleteEnhanceResult {
  ok: true
  outcome: EnhancementOutcome
  enhancement_state: EnhancementState
  document_content: TiptapDocument
  documentHash: string
}

export async function persistCompleteResult(
  validated: ValidatedEnhanceRequest,
): Promise<Response> {
  const { meeting, supabase, userId, parsedBody } = validated

  if (parsedBody.action !== 'complete') {
    throw new Error('persistCompleteResult called with non-complete action')
  }

  const currentDocument = normalizeTiptapDocument(meeting.document_content)
  const currentHash = hashDocumentContent(currentDocument)

  if (currentHash !== parsedBody.sourceHash) {
    return errorResponse(
      'The note changed before this review was completed',
      'STALE_SOURCE_HASH',
      409
    )
  }

  let nextDocument = currentDocument
  if (parsedBody.outcome === 'accepted') {
    if (!isTiptapDocument(parsedBody.documentContent)) {
      return errorResponse(
        'Accepted reviews must include documentContent',
        'INVALID_DOCUMENT',
        400
      )
    }

    nextDocument = parsedBody.documentContent as TiptapDocument
  }

  const nextState: EnhancementState = {
    lastReviewedSourceHash: hashDocumentContent(nextDocument),
    lastOutcome: parsedBody.outcome,
    lastReviewedAt: new Date().toISOString(),
    lastError: null,
  }

  const updatePayload: Record<string, unknown> = {
    enhancement_status: 'idle',
    enhancement_state: nextState,
    updated_at: new Date().toISOString(),
  }

  if (parsedBody.outcome === 'accepted') {
    updatePayload.document_content = nextDocument
  }

  const { error: updateError } = await supabase
    .from('meetings')
    .update(updatePayload)
    .eq('id', meeting.id)
    .eq('user_id', userId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return NextResponse.json({
    ok: true,
    outcome: parsedBody.outcome as EnhancementOutcome,
    enhancement_state: nextState,
    document_content: nextDocument,
    documentHash: hashDocumentContent(nextDocument),
  })
}

// ── error state persistence (both actions) ───────────────────────────────────

export async function persistEnhancementError(
  validated: ValidatedEnhanceRequest,
  errorMessage: string,
): Promise<void> {
  const { meeting, supabase, userId, persistedState } = validated

  const failureState: EnhancementState = {
    ...persistedState,
    lastError: errorMessage,
  }

  try {
    await supabase
      .from('meetings')
      .update({
        enhancement_status: 'error',
        enhancement_state: failureState,
        updated_at: new Date().toISOString(),
      })
      .eq('id', meeting.id)
      .eq('user_id', userId)
  } catch {
    // Best effort only.
  }
}

// ── fallback error state persistence (pre-auth, no validated request) ────────

export async function persistEnhancementErrorRaw(params: {
  meetingId: string
  userId: string
  persistedState: EnhancementState | null
  errorMessage: string
  supabase: import('@supabase/supabase-js').SupabaseClient
}): Promise<void> {
  const { meetingId, userId, persistedState, errorMessage, supabase } = params

  const baseState = persistedState ?? {
    lastReviewedSourceHash: null,
    lastOutcome: null,
    lastReviewedAt: null,
    lastError: null,
  }

  const failureState: EnhancementState = {
    ...baseState,
    lastError: errorMessage,
  }

  try {
    await supabase
      .from('meetings')
      .update({
        enhancement_status: 'error',
        enhancement_state: failureState,
        updated_at: new Date().toISOString(),
      })
      .eq('id', meetingId)
      .eq('user_id', userId)
  } catch {
    // Best effort only.
  }
}
