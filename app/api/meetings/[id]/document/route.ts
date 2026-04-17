import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api/api-helpers'
import { validateBody } from '@/lib/api/validate'
import { hashDocumentContent } from '@/lib/document-hash'
import {
  isTiptapDocument,
  normalizeTiptapDocument,
} from '@/lib/tiptap/tiptap-converter'

const documentPatchSchema = z.object({
  document_content: z.unknown().refine(
    (v) => isTiptapDocument(v),
    { message: 'document_content must be a valid Tiptap document' }
  ),
  baseHash: z.string().trim().min(1),
})

export const maxDuration = 10

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    if (!id) return errorResponse('Missing meeting id', 'INVALID_MEETING_ID', 400)

    const validated = await validateBody(request, documentPatchSchema)
    if (validated instanceof Response) return validated
    const { data: body } = validated

    const contentSize = JSON.stringify(body.document_content).length
    if (contentSize > 2_000_000) {
      return errorResponse('Document too large (max 2 MB)', 'DOCUMENT_TOO_LARGE', 413)
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)

    const { data: meeting } = await supabase
      .from('meetings')
      .select('id, document_content')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!meeting) return errorResponse('Meeting not found', 'MEETING_NOT_FOUND', 404)

    const currentDocument = normalizeTiptapDocument(meeting.document_content)
    const currentHash = hashDocumentContent(currentDocument)

    if (body.baseHash !== currentHash) {
      return NextResponse.json(
        {
          error: 'A newer version of this note was saved elsewhere.',
          code: 'STALE_DOCUMENT',
          currentDocument,
          currentHash,
        },
        { status: 409 }
      )
    }

    const nextDocument = body.document_content
    const nextHash = hashDocumentContent(nextDocument)

    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        document_content: nextDocument,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)

    if (updateError) {
      Sentry.captureException(new Error(updateError.message))
      throw new Error('Failed to save document')
    }

    return NextResponse.json({ ok: true, documentHash: nextHash })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save document'
    return errorResponse(message, 'DOCUMENT_SAVE_FAILED', 500)
  }
}
