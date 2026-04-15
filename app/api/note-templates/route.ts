import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api/api-helpers'
import { validateBody } from '@/lib/api/validate'

const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  prompt: z.string().trim().min(1).max(2000),
  description: z.string().trim().max(500).optional(),
})

export const maxDuration = 10

// GET — list user's custom templates
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)

    const { data, error } = await supabase
      .from('note_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) {
      Sentry.captureException(error)
      throw new Error('Failed to fetch templates')
    }
    return NextResponse.json({ templates: data ?? [] })
  } catch (error: unknown) {
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to fetch templates',
      'FETCH_FAILED', 500
    )
  }
}

// POST — create a custom template
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
      .select('*')
      .single()

    if (error) {
      Sentry.captureException(error)
      throw new Error('Failed to create template')
    }
    return NextResponse.json({ template: data }, { status: 201 })
  } catch (error: unknown) {
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to create template',
      'CREATE_FAILED', 500
    )
  }
}
