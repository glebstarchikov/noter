import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api/api-helpers'
import { validateBody } from '@/lib/api/validate'
import { FALLBACK_TEMPLATE_ID } from '@/lib/note-template'
import { updateTemplateSchema } from '@/lib/templates/template-schemas'

function isBuiltin(id: string) {
  return id.startsWith('builtin-')
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
    if (isBuiltin(id)) return errorResponse('Built-in templates are read-only', 'TEMPLATE_IS_BUILTIN', 403)

    const validated = await validateBody(request, updateTemplateSchema)
    if (validated instanceof Response) return validated
    const { data: body } = validated

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.name !== undefined) update.name = body.name
    if (body.description !== undefined) update.description = body.description ?? null
    if (body.prompt !== undefined) update.prompt = body.prompt

    const { data, error } = await supabase
      .from('note_templates')
      .update(update)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, name, description, prompt')
      .single()

    if (error || !data) {
      return errorResponse('Template not found', 'TEMPLATE_NOT_FOUND', 404)
    }

    return NextResponse.json({
      id: data.id,
      name: data.name,
      description: data.description ?? '',
      prompt: data.prompt,
      isBuiltin: false,
    })
  } catch (error) {
    Sentry.captureException(error, { tags: { route: 'templates.PATCH' } })
    return errorResponse('Failed to update template', 'TEMPLATE_UPDATE_FAILED', 500)
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
    if (isBuiltin(id)) return errorResponse('Built-in templates cannot be deleted', 'TEMPLATE_IS_BUILTIN', 403)

    const { data: prefRow } = await supabase
      .from('user_preferences')
      .select('default_template_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (prefRow?.default_template_id === id) {
      await supabase
        .from('user_preferences')
        .update({ default_template_id: FALLBACK_TEMPLATE_ID, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
    }

    const { error } = await supabase
      .from('note_templates')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      Sentry.captureException(error, { tags: { route: 'templates.DELETE' } })
      return errorResponse('Failed to delete template', 'TEMPLATE_DELETE_FAILED', 500)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    Sentry.captureException(error, { tags: { route: 'templates.DELETE' } })
    return errorResponse('Failed to delete template', 'TEMPLATE_DELETE_FAILED', 500)
  }
}
