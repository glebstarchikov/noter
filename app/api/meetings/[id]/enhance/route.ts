import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-helpers'
import { getOpenAI } from '@/lib/openai'
import { ENHANCEMENT_MODEL } from '@/lib/ai-models'
import {
  isTiptapDocument,
  legacyMeetingToTiptap,
  tiptapToPlainText,
  type TiptapDocument,
} from '@/lib/tiptap-converter'
import type { EnhancementState, EnhancementSuggestion, Meeting } from '@/lib/types'

const MAX_SUGGESTIONS = 5

const requestSchema = z.object({
  action: z.enum(['start', 'accept', 'skip']),
  suggestionId: z.string().trim().min(1).optional(),
})

const suggestionSchema = z.object({
  useful: z.boolean().optional().default(true),
  title: z.string().trim().min(1).optional().default('Suggested refinement'),
  summary: z.string().trim().optional().default(''),
  beforeExcerpt: z.string().trim().optional().default(''),
  afterExcerpt: z.string().trim().optional().default(''),
  proposed_document_content: z.object({
    type: z.literal('doc'),
    content: z.array(z.record(z.string(), z.unknown())).default([]),
  }).nullable(),
})

function getWorkingDocument(meeting: Pick<Meeting, 'document_content' | 'summary' | 'detailed_notes' | 'action_items' | 'key_decisions' | 'follow_ups'>) {
  return isTiptapDocument(meeting.document_content)
    ? meeting.document_content
    : legacyMeetingToTiptap(meeting as Meeting)
}

function getMeetingContext(meeting: Pick<Meeting, 'summary' | 'detailed_notes' | 'action_items' | 'key_decisions' | 'topics' | 'follow_ups'>) {
  return JSON.stringify({
    summary: meeting.summary ?? '',
    detailed_notes: meeting.detailed_notes ?? '',
    action_items: meeting.action_items ?? [],
    key_decisions: meeting.key_decisions ?? [],
    topics: meeting.topics ?? [],
    follow_ups: meeting.follow_ups ?? [],
  }, null, 2)
}

async function generateEnhancementSuggestion({
  transcript,
  documentContent,
  meeting,
  step,
  maxSuggestions,
}: {
  transcript: string
  documentContent: TiptapDocument
  meeting: Pick<Meeting, 'summary' | 'detailed_notes' | 'action_items' | 'key_decisions' | 'topics' | 'follow_ups'>
  step: number
  maxSuggestions: number
}): Promise<EnhancementSuggestion | null> {
  const currentDocumentText = tiptapToPlainText(documentContent)

  if (!currentDocumentText.trim()) {
    return null
  }

  const completion = await getOpenAI().chat.completions.create({
    model: process.env.AI_GATEWAY_API_KEY ? ENHANCEMENT_MODEL : 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    temperature: 0.25,
    messages: [
      {
        role: 'system',
        content: `You improve meeting notes one suggestion at a time.

Return JSON only with this shape:
{
  "useful": true,
  "title": "Short label for the suggestion",
  "summary": "One sentence explaining why this suggestion matters",
  "beforeExcerpt": "Small excerpt from the current notes that will be improved",
  "afterExcerpt": "Small excerpt showing the improved version",
  "proposed_document_content": { "type": "doc", "content": [...] }
}

Rules:
- Suggest exactly one meaningful enhancement.
- Return the entire next Tiptap JSON document in proposed_document_content.
- Decide placement yourself inside the document.
- Keep the user's tone and preserve existing content unless improving clarity or structure.
- If there is no meaningful improvement left, return {"useful": false, "proposed_document_content": null }.
- Never return markdown fences or extra text.`,
      },
      {
        role: 'user',
        content: `Enhancement step ${step} of ${maxSuggestions}.

Current notes as plain text:
${currentDocumentText}

Structured meeting metadata:
${getMeetingContext(meeting)}

Transcript:
${transcript}`,
      },
    ],
  })

  const rawContent = completion.choices[0]?.message?.content
  if (!rawContent) {
    throw new Error('No response from AI')
  }

  const parsedJson = JSON.parse(rawContent)
  const parsedSuggestion = suggestionSchema.parse(parsedJson)

  if (!parsedSuggestion.useful || !parsedSuggestion.proposed_document_content) {
    return null
  }

  if (!isTiptapDocument(parsedSuggestion.proposed_document_content)) {
    return null
  }

  const proposedText = tiptapToPlainText(parsedSuggestion.proposed_document_content)
  if (!proposedText.trim() || proposedText.trim() === currentDocumentText.trim()) {
    return null
  }

  return {
    id: crypto.randomUUID(),
    title: parsedSuggestion.title,
    summary: parsedSuggestion.summary,
    beforeExcerpt: parsedSuggestion.beforeExcerpt,
    afterExcerpt: parsedSuggestion.afterExcerpt,
    proposed_document_content: parsedSuggestion.proposed_document_content,
  }
}

function buildState(state: Partial<EnhancementState>): EnhancementState {
  return {
    sessionId: state.sessionId ?? crypto.randomUUID(),
    step: state.step ?? 0,
    acceptedCount: state.acceptedCount ?? 0,
    skippedCount: state.skippedCount ?? 0,
    maxSuggestions: state.maxSuggestions ?? MAX_SUGGESTIONS,
    currentSuggestion: state.currentSuggestion ?? null,
    lastError: state.lastError ?? null,
  }
}

export const maxDuration = 60

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const supabase = await createClient()
  let userId: string | null = null

  try {
    const body = await request.json().catch(() => null)
    const parsedBody = requestSchema.safeParse(body)
    if (!parsedBody.success) {
      return errorResponse('Invalid request body', 'INVALID_REQUEST', 400)
    }

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
      return errorResponse('Transcript is required before enhancing notes', 'MISSING_TRANSCRIPT', 400)
    }

    const action = parsedBody.data.action
    const currentState = buildState(meeting.enhancement_state ?? {})
    let workingDocument = getWorkingDocument(meeting as Meeting)
    let nextState = currentState

    if (action === 'start' && meeting.enhancement_status === 'reviewing' && currentState.currentSuggestion) {
      return NextResponse.json({
        enhancement_status: meeting.enhancement_status,
        enhancement_state: currentState,
        document_content: workingDocument,
        updated_at: meeting.updated_at,
      })
    }

    if (action === 'accept' || action === 'skip') {
      if (!parsedBody.data.suggestionId || !currentState.currentSuggestion) {
        return errorResponse('No active suggestion to review', 'NO_ACTIVE_SUGGESTION', 409)
      }

      if (currentState.currentSuggestion.id !== parsedBody.data.suggestionId) {
        return errorResponse('Suggestion is out of date', 'STALE_SUGGESTION', 409)
      }

      if (action === 'accept' && isTiptapDocument(currentState.currentSuggestion.proposed_document_content)) {
        workingDocument = currentState.currentSuggestion.proposed_document_content as TiptapDocument
        nextState = buildState({
          ...currentState,
          acceptedCount: currentState.acceptedCount + 1,
          currentSuggestion: null,
          lastError: null,
        })
      } else {
        nextState = buildState({
          ...currentState,
          skippedCount: currentState.skippedCount + 1,
          currentSuggestion: null,
          lastError: null,
        })
      }
    } else {
      nextState = buildState({
        sessionId: crypto.randomUUID(),
        step: 0,
        acceptedCount: 0,
        skippedCount: 0,
        maxSuggestions: MAX_SUGGESTIONS,
        currentSuggestion: null,
        lastError: null,
      })
    }

    const processedCount = nextState.acceptedCount + nextState.skippedCount

    await supabase
      .from('meetings')
      .update({
        ...(action === 'accept' ? { document_content: workingDocument } : {}),
        enhancement_status: 'generating',
        enhancement_state: {
          ...nextState,
          currentSuggestion: null,
          step: processedCount,
          lastError: null,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)

    if (processedCount >= nextState.maxSuggestions) {
      const completedState = buildState({
        ...nextState,
        step: processedCount,
        currentSuggestion: null,
      })

      await supabase
        .from('meetings')
        .update({
          ...(action === 'accept' ? { document_content: workingDocument } : {}),
          enhancement_status: 'complete',
          enhancement_state: completedState,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id)

      return NextResponse.json({
        enhancement_status: 'complete',
        enhancement_state: completedState,
        document_content: workingDocument,
      })
    }

    const suggestion = await generateEnhancementSuggestion({
      transcript: meeting.transcript,
      documentContent: workingDocument,
      meeting,
      step: processedCount + 1,
      maxSuggestions: nextState.maxSuggestions,
    })

    if (!suggestion) {
      const completedState = buildState({
        ...nextState,
        step: processedCount,
        currentSuggestion: null,
      })

      await supabase
        .from('meetings')
        .update({
          ...(action === 'accept' ? { document_content: workingDocument } : {}),
          enhancement_status: 'complete',
          enhancement_state: completedState,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id)

      return NextResponse.json({
        enhancement_status: 'complete',
        enhancement_state: completedState,
        document_content: workingDocument,
      })
    }

    const reviewingState = buildState({
      ...nextState,
      step: processedCount + 1,
      currentSuggestion: suggestion,
      lastError: null,
    })

    await supabase
      .from('meetings')
      .update({
        ...(action === 'accept' ? { document_content: workingDocument } : {}),
        enhancement_status: 'reviewing',
        enhancement_state: reviewingState,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)

    return NextResponse.json({
      enhancement_status: 'reviewing',
      enhancement_state: reviewingState,
      document_content: workingDocument,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to enhance notes'

    if (id && userId) {
      try {
        const fallbackState = buildState({
          lastError: message,
          currentSuggestion: null,
        })

        await supabase
          .from('meetings')
          .update({
            enhancement_status: 'error',
            enhancement_state: fallbackState,
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
