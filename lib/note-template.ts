import { BUILTIN_TEMPLATES, DEFAULT_TEMPLATE_ID, getBuiltinTemplate } from '@/lib/templates'

type SupabaseTemplateClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => PromiseLike<{ data: unknown; error?: { message: string } | null }>
        }
      }
    }
  }
}

export interface ResolvedNoteTemplate {
  id: string
  name: string
  description: string
  prompt: string
  isBuiltin: boolean
}

const DEFAULT_TEMPLATE = getBuiltinTemplate(DEFAULT_TEMPLATE_ID) ?? BUILTIN_TEMPLATES[0]

export async function resolveMeetingTemplate(
  supabase: SupabaseTemplateClient,
  meeting: { template_id: string | null; user_id: string }
): Promise<ResolvedNoteTemplate> {
  if (!meeting.template_id) {
    return {
      id: DEFAULT_TEMPLATE.id,
      name: DEFAULT_TEMPLATE.name,
      description: DEFAULT_TEMPLATE.description,
      prompt: DEFAULT_TEMPLATE.prompt,
      isBuiltin: true,
    }
  }

  const builtin = getBuiltinTemplate(meeting.template_id)
  if (builtin) {
    return {
      id: builtin.id,
      name: builtin.name,
      description: builtin.description,
      prompt: builtin.prompt,
      isBuiltin: true,
    }
  }

  const { data, error } = await supabase
    .from('note_templates')
    .select('id, name, description, prompt')
    .eq('id', meeting.template_id)
    .eq('user_id', meeting.user_id)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load note template: ${error.message}`)
  }

  const template = data as {
    id: string
    name: string
    description: string | null
    prompt: string
  } | null

  if (!template) {
    return {
      id: DEFAULT_TEMPLATE.id,
      name: DEFAULT_TEMPLATE.name,
      description: DEFAULT_TEMPLATE.description,
      prompt: DEFAULT_TEMPLATE.prompt,
      isBuiltin: true,
    }
  }

  return {
    id: template.id,
    name: template.name,
    description: template.description ?? '',
    prompt: template.prompt,
    isBuiltin: false,
  }
}

export function formatTemplateContext(template: ResolvedNoteTemplate) {
  return [
    `Selected note format: ${template.name}`,
    template.description ? `Description: ${template.description}` : null,
    'Format instructions:',
    template.prompt,
  ]
    .filter(Boolean)
    .join('\n')
}
