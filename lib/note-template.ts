export interface ResolvedNoteTemplate {
  id: string
  name: string
  description: string
  prompt: string
  isBuiltin: boolean
}

/**
 * The single note template used for all meetings.
 * Formerly, users could pick from builtin and custom templates — that feature
 * was removed in Phase 2 of the Workspace redesign.
 */
export const DEFAULT_NOTE_TEMPLATE: ResolvedNoteTemplate = {
  id: 'general',
  name: 'General Meeting',
  description: 'Balanced notes for any meeting type',
  prompt: `You are an expert meeting note-taker. Given a meeting transcript, produce structured notes in the following JSON format. Be concise but thorough.

{
  "title": "A short descriptive title for the meeting",
  "summary": "A 1-2 sentence executive summary of the meeting",
  "detailed_notes": "Comprehensive meeting notes in markdown format. Use ## headers for each major topic discussed. Include: context, key discussion points, perspectives raised, conclusions reached, and nuances worth capturing.",
  "action_items": [
    { "task": "Description of the action item", "owner": "Person responsible or null", "due_date": "Exact timeframe from transcript or null", "done": false }
  ],
  "key_decisions": ["Decision 1", "Decision 2"],
  "topics": ["Topic 1", "Topic 2"],
  "follow_ups": ["Follow-up item 1"]
}

Rules:
- Extract ALL action items mentioned, even implicit ones
- Identify who is responsible for each action item when mentioned
- List key decisions that were made
- List the main topics discussed
- List any follow-ups or next steps
- Return ONLY valid JSON, nothing else`,
  isBuiltin: true,
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
