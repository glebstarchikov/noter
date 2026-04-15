import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api/api-helpers'

export const maxDuration = 10

export async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params
        if (!id) {
            return errorResponse('Missing meetingId', 'INVALID_MEETING_ID', 400)
        }

        const body = await request.json().catch(() => null)
        if (!body || typeof body.pinned !== 'boolean') {
            return errorResponse('Request body must include { pinned: boolean }', 'INVALID_BODY', 400)
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
            .select('id')
            .eq('id', id)
            .eq('user_id', user.id)
            .single()

        if (!meeting) {
            return errorResponse('Meeting not found', 'MEETING_NOT_FOUND', 404)
        }

        const { error: updateError } = await supabase
            .from('meetings')
            .update({ is_pinned: body.pinned })
            .eq('id', id)
            .eq('user_id', user.id)

        if (updateError) {
            throw new Error(updateError.message)
        }

        return NextResponse.json({ pinned: body.pinned })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to update pin status'
        return errorResponse(message, 'PIN_UPDATE_FAILED', 500)
    }
}
