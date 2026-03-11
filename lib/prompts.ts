import { formatTemplateContext, type ResolvedNoteTemplate } from '@/lib/note-template'
import { draftPromptSchemaExample } from '@/lib/draft-proposal'

const BASE_NOTES_GENERATION_PROMPT = `You are an expert meeting note-taker. Given a meeting transcript, produce structured notes in the following JSON format. Be concise but thorough.

{
  "title": "A short descriptive title for the meeting",
  "summary": "A 1-2 sentence executive summary of the meeting",
  "detailed_notes": "Comprehensive meeting notes in markdown format. Use ## headers for each major topic discussed. Under each header, include detailed bullet points covering: context and background, key discussion points, arguments or perspectives raised, conclusions reached, and any nuances worth capturing. These notes serve as the canonical record of the meeting and should be thorough enough that someone who missed the meeting can fully understand what happened.",
  "action_items": [
    { "task": "Description of the action item", "owner": "Person responsible or null", "done": false }
  ],
  "key_decisions": ["Decision 1", "Decision 2"],
  "topics": ["Topic 1", "Topic 2"],
  "follow_ups": ["Follow-up item 1", "Follow-up item 2"]
}

Rules:
- Extract ALL action items mentioned, even implicit ones
- Identify who is responsible for each action item when mentioned
- List key decisions that were made during the meeting
- List the main topics/themes discussed
- List any follow-ups or next steps mentioned
- The detailed_notes field should be comprehensive markdown with section headers per topic, not a repetition of the summary
- Keep language clear, professional, and concise
- Return ONLY valid JSON, nothing else`

export function buildNotesGenerationPrompt(template: ResolvedNoteTemplate) {
  return `${BASE_NOTES_GENERATION_PROMPT}

${formatTemplateContext(template)}

Use the selected note format to shape the structure, emphasis, and language of the generated metadata.`
}

export function buildDraftProposalPrompt({
  mode,
  template,
  currentDocumentText,
  structuredContext,
  transcript,
  repairFeedback,
}: {
  mode: 'generate' | 'enhance'
  template: ResolvedNoteTemplate
  currentDocumentText: string
  structuredContext: string
  transcript: string
  repairFeedback?: string | null
}) {
  const modeInstructions =
    mode === 'generate'
      ? `Create a first draft for the note editor.

The editor is currently empty. Use the selected note format as the primary structure for the draft.`
      : `Improve the existing note draft.

Preserve the user's structure and tone whenever possible. Use the selected note format only as soft guidance for missing sections or light restructuring.`

  return `You are helping draft meeting notes inside a writing editor.

Return JSON only. The response must match this exact schema:
${JSON.stringify(draftPromptSchemaExample, null, 2)}

Rules:
- Always include schemaVersion: 1.
- Return one short summary sentence under 200 characters.
- Allowed block types only: heading, paragraph, bullet_list, task_list.
- For task_list items, owner must be a string or null. Never omit owner.
- Work at the level of readable note blocks. Do not emit Tiptap JSON.
- Keep the output concise and readable.
- Do not mention that AI was used.
- Do not wrap the JSON in markdown fences.

${modeInstructions}

${formatTemplateContext(template)}

Current note draft:
${currentDocumentText || '[Empty note]'}

Structured meeting metadata:
${structuredContext}

Transcript:
${transcript}

${
    repairFeedback
      ? `Previous attempt failed this safety check:
${repairFeedback}

Return a corrected response that matches the schema exactly.`
      : ''
  }`
}
