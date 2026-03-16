import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-helpers'

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
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
    }

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
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
    }

    const { data: meeting } = await supabase
      .from('meetings')
      .select('id, audio_url')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!meeting) {
      return errorResponse('Meeting not found', 'MEETING_NOT_FOUND', 404)
    }

    const { error: deleteError } = await supabase
      .from('meetings')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Meeting delete failed:', deleteError.message)
      throw new Error('Failed to delete meeting')
    }

    // Best-effort storage cleanup — orphaned files are preferable to un-deletable meetings
    if (meeting.audio_url) {
      const { error: storageError } = await supabase.storage
        .from('meeting-audio')
        .remove([meeting.audio_url])

      if (storageError) {
        console.warn(`Failed to delete audio file ${meeting.audio_url}: ${storageError.message}`)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete meeting'
    return errorResponse(message, 'MEETING_DELETE_FAILED', 500)
  }
}
