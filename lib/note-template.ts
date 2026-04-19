import type { SupabaseClient } from '@supabase/supabase-js'

export interface ResolvedNoteTemplate {
  id: string
  name: string
  description: string
  prompt: string
  isBuiltin: boolean
}

export const BUILTIN_TEMPLATES: Record<string, ResolvedNoteTemplate> = {
  'builtin-general': {
    id: 'builtin-general',
    name: 'General',
    description: 'Balanced notes for any meeting type',
    isBuiltin: true,
    prompt: `Produce balanced notes suitable for any meeting type. Distribute content evenly across all fields — no single section should dominate. Keep tone neutral and professional. Capture what was discussed, what was decided, what actions were committed, and what topics were covered without bias toward any particular meeting style. When the content genuinely doesn't fit a field (for example, no decisions were actually made), leave that field empty rather than forcing content to appear there.`,
  },
  'builtin-1on1': {
    id: 'builtin-1on1',
    name: '1:1 / Check-in',
    description: 'Warm two-person conversations — growth, feedback, blockers',
    isBuiltin: true,
    prompt: `This is a two-person check-in — a 1:1, a manager/report conversation, a founder/mentor session. Preserve the human dynamic: who raised which topic, who responded how. Emphasize growth and development topics, feedback exchanged (in both directions), blockers the person is facing, and mutual commitments. Tone should be warm, personal, and direct. Avoid corporate-speak — use the language the speakers actually used.

For action_items: each item should clearly identify which of the two people owns it. If only one person is talking more than 80% of the time, flag the conversation as asymmetric in the summary. Put any significant emotional or interpersonal observations into detailed_notes as their own section when they matter to the meaning of the conversation.`,
  },
  'builtin-team': {
    id: 'builtin-team',
    name: 'Team meeting',
    description: 'Sprint planning, standups, retros — tactical, info-dense',
    isBuiltin: true,
    prompt: `This is a team meeting — sprint planning, standup, retro, or cross-functional sync. Prioritize tactical, info-dense output over narrative. In detailed_notes, organize content by topic in agenda order reconstructed from the transcript flow. Within each topic, use structured bullets: decisions with rationale, actions with owners and due dates, blockers in their own bullet group, open questions to revisit.

For action_items: every item must have an explicit owner (name or role) and, where stated in the transcript, a due date. If no due date is mentioned, set due_date to null — do not invent deadlines.

For key_decisions: include the alternatives considered when the transcript provides them (e.g. "chose X over Y because…").

Parked topics or deferred items go into follow_ups, not action_items. Do not invent urgency.`,
  },
  'builtin-interview': {
    id: 'builtin-interview',
    name: 'Customer interview',
    description: 'Research calls — verbatim quotes, pain points, feature requests',
    isBuiltin: true,
    prompt: `This is a customer or user research interview. Your job is observational, not interpretive — report what the customer actually said, do not translate it into internal frameworks or product language.

In detailed_notes, organize by theme. When the customer says something quotable about a pain, a goal, a feature wish, or an emotional reaction, include it verbatim as a markdown blockquote:
> "Their exact words."

Emphasize pain points and feature requests in the customer's own language. Preserve sentiment — if the customer sounded frustrated, say "was frustrated by X"; if excited, say "got excited about Y".

For action_items: capture internal follow-ups WE owe them (e.g., "send pricing", "schedule demo").
For follow_ups: capture things to explore in the next conversation.
For key_decisions: usually empty — a research call rarely produces decisions. Leave it empty rather than forcing content.`,
  },
  'builtin-lecture': {
    id: 'builtin-lecture',
    name: 'Lecture / Talk',
    description: 'Educational content — thesis, concepts, examples, references',
    isBuiltin: true,
    prompt: `This is a lecture, talk, or educational content — a single speaker explaining concepts to an audience. Structure detailed_notes in the order the speaker built their argument:

1. Main thesis — the speaker's central claim, stated plainly
2. Key concepts — each one explained in the speaker's own framing
3. Examples — the illustrations the speaker used to ground each concept
4. Questions raised — any Q&A or audience challenges, with context
5. References — papers, books, people, or resources mentioned

For topics: reconstruct the speaker's actual outline in order — not a theme list, a reconstructed agenda.

For action_items: capture learning-related follow-ups only (e.g., "read paper X", "look up term Y"), not business actions.

For key_decisions: usually empty. Do not force it.

Tone: structured, faithful to the speaker's argument, preserves intellectual nuance over brevity.`,
  },
}

export const FALLBACK_TEMPLATE_ID = 'builtin-general'

/**
 * Backwards-compatible alias. Existing callers that imported DEFAULT_NOTE_TEMPLATE
 * continue to work.
 */
export const DEFAULT_NOTE_TEMPLATE: ResolvedNoteTemplate = BUILTIN_TEMPLATES[FALLBACK_TEMPLATE_ID]

/**
 * Resolve a template by ID. Built-in IDs (prefixed `builtin-`) are returned
 * directly from the in-memory map. Custom IDs are fetched from the DB under the
 * user's RLS. Any failure (missing built-in, not-found custom, empty string)
 * falls back to the general built-in.
 */
export async function resolveTemplate(
  id: string,
  userId: string,
  supabase: SupabaseClient,
): Promise<ResolvedNoteTemplate> {
  if (!id) return BUILTIN_TEMPLATES[FALLBACK_TEMPLATE_ID]

  if (id.startsWith('builtin-')) {
    return BUILTIN_TEMPLATES[id] ?? BUILTIN_TEMPLATES[FALLBACK_TEMPLATE_ID]
  }

  const { data } = await supabase
    .from('note_templates')
    .select('id, name, description, prompt')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) return BUILTIN_TEMPLATES[FALLBACK_TEMPLATE_ID]

  return {
    id: data.id,
    name: data.name,
    description: data.description ?? '',
    prompt: data.prompt,
    isBuiltin: false,
  }
}

/**
 * Pre-existing helper — kept as-is. Consumers pass a ResolvedNoteTemplate and
 * get a block of "Format instructions" text to append to the base prompt.
 */
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
