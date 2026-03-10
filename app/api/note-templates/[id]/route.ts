import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-helpers'

export const maxDuration = 10

// PATCH — update a custom template
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)

    const body = await request.json().catch(() => null)
    if (!body) return errorResponse('Invalid body', 'INVALID_BODY', 400)

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim()
    if (typeof body.description === 'string') updates.description = body.description.trim()
    if (typeof body.prompt === 'string' && body.prompt.trim()) updates.prompt = body.prompt.trim()

    const { data, error } = await supabase
      .from('note_templates')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    if (!data) return errorResponse('Template not found', 'NOT_FOUND', 404)

    return NextResponse.json({ template: data })
  } catch (error: unknown) {
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to update template',
      'UPDATE_FAILED', 500
    )
  }
}

// DELETE — remove a custom template
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)

    const { error } = await supabase
      .from('note_templates')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to delete template',
      'DELETE_FAILED', 500
    )
  }
}
