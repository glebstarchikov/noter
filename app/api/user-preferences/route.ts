import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api/api-helpers'
import { validateBody } from '@/lib/api/validate'
import { BUILTIN_TEMPLATES } from '@/lib/note-template'
import { setDefaultSchema } from '@/lib/templates/template-schemas'

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)

    const validated = await validateBody(request, setDefaultSchema)
    if (validated instanceof Response) return validated
    const { default_template_id: id } = validated.data

    if (id.startsWith('builtin-')) {
      if (!BUILTIN_TEMPLATES[id]) {
        return errorResponse('Unknown built-in template', 'INVALID_DEFAULT_TEMPLATE', 400)
      }
    } else if (UUID_REGEX.test(id)) {
      const { data } = await supabase
        .from('note_templates')
        .select('id')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!data) {
        return errorResponse('Template not found or not owned by user', 'INVALID_DEFAULT_TEMPLATE', 400)
      }
    } else {
      return errorResponse('Invalid default template id', 'INVALID_DEFAULT_TEMPLATE', 400)
    }

    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: user.id,
        default_template_id: id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (error) {
      Sentry.captureException(error, { tags: { route: 'user-preferences.PATCH' } })
      return errorResponse('Failed to update preferences', 'PREFERENCES_UPDATE_FAILED', 500)
    }

    return NextResponse.json({ default_template_id: id })
  } catch (error) {
    Sentry.captureException(error, { tags: { route: 'user-preferences.PATCH' } })
    return errorResponse('Failed to update preferences', 'PREFERENCES_UPDATE_FAILED', 500)
  }
}
