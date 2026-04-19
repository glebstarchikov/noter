import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api/api-helpers'
import { validateBody } from '@/lib/api/validate'
import { BUILTIN_TEMPLATES, FALLBACK_TEMPLATE_ID, type ResolvedNoteTemplate } from '@/lib/note-template'
import { createTemplateSchema } from '@/lib/templates/template-schemas'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)

    const [{ data: customRows }, { data: prefRow }] = await Promise.all([
      supabase
        .from('note_templates')
        .select('id, name, description, prompt')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('user_preferences')
        .select('default_template_id')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    const custom: ResolvedNoteTemplate[] = (customRows ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      prompt: row.prompt,
      isBuiltin: false,
    }))

    const templates: ResolvedNoteTemplate[] = [
      ...Object.values(BUILTIN_TEMPLATES),
      ...custom,
    ]

    return NextResponse.json({
      templates,
      defaultTemplateId: prefRow?.default_template_id ?? FALLBACK_TEMPLATE_ID,
    })
  } catch (error) {
    Sentry.captureException(error, { tags: { route: 'templates.GET' } })
    return errorResponse('Failed to load templates', 'TEMPLATES_LIST_FAILED', 500)
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)

    const validated = await validateBody(request, createTemplateSchema)
    if (validated instanceof Response) return validated
    const { data: body } = validated

    const { data, error } = await supabase
      .from('note_templates')
      .insert({
        user_id: user.id,
        name: body.name,
        description: body.description ?? null,
        prompt: body.prompt,
      })
      .select('id, name, description, prompt')
      .single()

    if (error || !data) {
      Sentry.captureException(error ?? new Error('template insert returned no data'), {
        tags: { route: 'templates.POST' },
      })
      return errorResponse('Failed to create template', 'TEMPLATE_CREATE_FAILED', 500)
    }

    return NextResponse.json({
      id: data.id,
      name: data.name,
      description: data.description ?? '',
      prompt: data.prompt,
      isBuiltin: false,
    })
  } catch (error) {
    Sentry.captureException(error, { tags: { route: 'templates.POST' } })
    return errorResponse('Failed to create template', 'TEMPLATE_CREATE_FAILED', 500)
  }
}
