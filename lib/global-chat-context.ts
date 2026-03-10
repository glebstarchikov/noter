import { tiptapToPlainText } from '@/lib/tiptap-converter'
import { isActionItemArray, isStringArray } from '@/lib/type-guards'

export const MAX_GLOBAL_CONTEXT_CHARS = 100_000
export const MAX_GLOBAL_DOCUMENT_CHARS = 2_500
export const MAX_GLOBAL_TRANSCRIPT_CHARS = 1_500

export interface GlobalChatMeetingRow {
  id: string
  title: string | null
  summary: string | null
  action_items: unknown
  key_decisions: unknown
  topics: unknown
  follow_ups: unknown
  document_content: unknown
  transcript: string | null
  created_at: string
}

function clipSection(text: string, maxChars: number) {
  if (text.length <= maxChars) {
    return text
  }

  return `${text.slice(0, maxChars)}\n\n[Truncated due to length]`
}

export function buildGlobalChatContext(
  meetings: GlobalChatMeetingRow[],
  maxContextChars = MAX_GLOBAL_CONTEXT_CHARS
) {
  let context = `# All Notes (${meetings.length} total)\n\n`
  let contextSize = 0

  for (const meeting of meetings) {
    const meetingTitle =
      typeof meeting.title === 'string' && meeting.title.trim().length > 0
        ? meeting.title
        : 'Untitled Meeting'

    const createdDate = new Date(meeting.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })

    let meetingBlock = `---\n## ${meetingTitle} (${createdDate})\n\n`

    const documentText = tiptapToPlainText(meeting.document_content).trim()
    if (documentText) {
      meetingBlock += `### Note\n${clipSection(documentText, MAX_GLOBAL_DOCUMENT_CHARS)}\n\n`
    }

    if (typeof meeting.summary === 'string' && meeting.summary.length > 0) {
      meetingBlock += `### Summary\n${meeting.summary}\n\n`
    }

    const actionItems = isActionItemArray(meeting.action_items) ? meeting.action_items : []
    if (actionItems.length > 0) {
      meetingBlock += '### Action Items\n'
      for (const item of actionItems) {
        meetingBlock += `- [${item.done ? 'x' : ' '}] ${item.task}${item.owner ? ` (Owner: ${item.owner})` : ''}\n`
      }
      meetingBlock += '\n'
    }

    const keyDecisions = isStringArray(meeting.key_decisions) ? meeting.key_decisions : []
    if (keyDecisions.length > 0) {
      meetingBlock += '### Key Decisions\n'
      for (const decision of keyDecisions) {
        meetingBlock += `- ${decision}\n`
      }
      meetingBlock += '\n'
    }

    const topics = isStringArray(meeting.topics) ? meeting.topics : []
    if (topics.length > 0) {
      meetingBlock += '### Topics\n'
      for (const topic of topics) {
        meetingBlock += `- ${topic}\n`
      }
      meetingBlock += '\n'
    }

    const followUps = isStringArray(meeting.follow_ups) ? meeting.follow_ups : []
    if (followUps.length > 0) {
      meetingBlock += '### Follow-ups\n'
      for (const followUp of followUps) {
        meetingBlock += `- ${followUp}\n`
      }
      meetingBlock += '\n'
    }

    if (typeof meeting.transcript === 'string' && meeting.transcript.trim().length > 0) {
      meetingBlock += `### Transcript\n${clipSection(meeting.transcript.trim(), MAX_GLOBAL_TRANSCRIPT_CHARS)}\n\n`
    }

    if (contextSize + meetingBlock.length > maxContextChars) {
      context += '\n\n[...additional notes truncated due to context limits]\n'
      break
    }

    context += meetingBlock
    contextSize += meetingBlock.length
  }

  return context
}
