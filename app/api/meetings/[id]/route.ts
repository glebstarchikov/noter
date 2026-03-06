import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse, requireUser } from '@/lib/server/api/route-helpers'

export const maxDuration = 30

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    if (!id) {
      return errorResponse('Missing meetingId', 'INVALID_MEETING_ID', 400)
    }

    const supabase = await createClient()
    const authResult = await requireUser(supabase)
    if ('response' in authResult) {
      return authResult.response
    }
    const { user } = authResult

    const { data: meeting } = await supabase
      .from('meetings')
      .select('id, status, error_message, updated_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!meeting) {
      return errorResponse('Meeting not found', 'MEETING_NOT_FOUND', 404)
    }

    return NextResponse.json({ meeting })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch meeting'
    return errorResponse(message, 'MEETING_FETCH_FAILED', 500)
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    if (!id) {
      return errorResponse('Missing meetingId', 'INVALID_MEETING_ID', 400)
    }

    const supabase = await createClient()
    const authResult = await requireUser(supabase)
    if ('response' in authResult) {
      return authResult.response
    }
    const { user } = authResult

    const { data: meeting } = await supabase
      .from('meetings')
      .select('id, audio_url')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!meeting) {
      return errorResponse('Meeting not found', 'MEETING_NOT_FOUND', 404)
    }

    if (meeting.audio_url) {
      const { error: storageError } = await supabase.storage
        .from('meeting-audio')
        .remove([meeting.audio_url])

      if (storageError) {
        throw new Error(storageError.message)
      }
    }

    const { error: deleteError } = await supabase
      .from('meetings')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      throw new Error(deleteError.message)
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete meeting'
    return errorResponse(message, 'MEETING_DELETE_FAILED', 500)
  }
}
