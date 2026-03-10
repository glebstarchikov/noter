import { formatTemplateContext, type ResolvedNoteTemplate } from '@/lib/note-template'

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
}: {
  mode: 'generate' | 'enhance'
  template: ResolvedNoteTemplate
  currentDocumentText: string
  structuredContext: string
  transcript: string
}) {
  const modeInstructions =
    mode === 'generate'
      ? `Create a first draft for the note editor.

The editor is currently empty. Use the selected note format as the primary structure for the draft.`
      : `Improve the existing note draft.

Preserve the user's structure and tone whenever possible. Use the selected note format only as soft guidance for missing sections or light restructuring.`

  return `You are helping draft meeting notes inside a writing editor.

Return JSON only with this shape:
{
  "summary": "One short sentence describing what changed",
  "proposed_document_content": { "type": "doc", "content": [...] }
}

Rules:
- Return a valid Tiptap JSON document in proposed_document_content.
- Work at the level of readable note blocks like headings, paragraphs, lists, and tasks.
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
${transcript}`
}
