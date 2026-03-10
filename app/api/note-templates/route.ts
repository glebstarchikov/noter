import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-helpers'

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

    if (error) throw new Error(error.message)
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

    const body = await request.json().catch(() => null)
    if (!body || typeof body.name !== 'string' || !body.name.trim()) {
      return errorResponse('name is required', 'INVALID_BODY', 400)
    }
    if (typeof body.prompt !== 'string' || !body.prompt.trim()) {
      return errorResponse('prompt is required', 'INVALID_BODY', 400)
    }

    const { data, error } = await supabase
      .from('note_templates')
      .insert({
        user_id: user.id,
        name: body.name.trim(),
        description: typeof body.description === 'string' ? body.description.trim() : null,
        prompt: body.prompt.trim(),
      })
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ template: data }, { status: 201 })
  } catch (error: unknown) {
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to create template',
      'CREATE_FAILED', 500
    )
  }
}
