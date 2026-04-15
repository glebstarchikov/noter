import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api/api-helpers'
import { validateBody } from '@/lib/api/validate'

const updateTemplateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  prompt: z.string().trim().min(1).max(2000).optional(),
}).refine(
  (v) => v.name !== undefined || v.description !== undefined || v.prompt !== undefined,
  { message: 'At least one of name, description, or prompt must be provided' }
)

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

    const validated = await validateBody(request, updateTemplateSchema)
    if (validated instanceof Response) return validated
    const { data: body } = validated

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description
    if (body.prompt !== undefined) updates.prompt = body.prompt

    const { data, error } = await supabase
      .from('note_templates')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (error) {
      // .single() returns PGRST116 when zero rows match — that's a 404, not 500
      if (error.code === 'PGRST116') {
        return errorResponse('Template not found', 'NOT_FOUND', 404)
      }
      throw new Error(error.message)
    }

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
