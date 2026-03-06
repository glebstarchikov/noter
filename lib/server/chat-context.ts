export type ActionItemShape = {
  task: string
  owner: string | null
  done: boolean
}

export interface MeetingChatContextMeeting {
  title: string | null
  transcript: string | null
  summary: string | null
  detailed_notes: string | null
  action_items: unknown
  key_decisions: unknown
  topics: unknown
  follow_ups: unknown
}

export interface MeetingChatContextSource {
  name: string | null
  file_type: string | null
  content: string | null
}

export interface GlobalChatContextMeeting {
  id: string
  title: string | null
  summary: string | null
  action_items: unknown
  key_decisions: unknown
  topics: unknown
  follow_ups: unknown
  created_at: string
}

const MAX_TRANSCRIPT_CHARS = 300_000
const MAX_SOURCE_CONTENT_CHARS = 50_000

export const MEETING_CHAT_SYSTEM_PROMPT_TEMPLATE = `You are noter AI, a helpful meeting assistant. You have access to the full context of a meeting including its transcript, structured notes, and any external documents the user has attached.

Your job is to:
- Answer questions about what happened in the meeting
- Elaborate on specific points discussed
- Verify whether topics or actions were mentioned
- Cross-reference information from external sources with meeting content
- Provide clear, concise, and accurate answers

Rules:
- Only answer based on the provided context. If something wasn't discussed or isn't in the materials, say so honestly.
- When referencing information, mention which source it came from (transcript, notes, or a specific document name).
- Be conversational but professional. Keep answers focused and to the point.
- Format responses with markdown for readability.

Here is the full meeting context:

`

export const GLOBAL_CHAT_SYSTEM_PROMPT_TEMPLATE = `You are noter AI, a global meeting assistant. You have access to summaries, action items, key decisions, topics, and follow-ups from ALL the user's meetings.

Your job is to:
- Answer questions that span multiple meetings
- Find patterns and recurring themes across meetings
- Track action items and responsibilities across meetings
- Compare what was discussed in different meetings
- Provide a holistic view of the user's meeting activity

Rules:
- Only answer based on the provided context. If something isn't in the meeting data, say so honestly.
- When referencing information, always mention which meeting it came from (by title and date).
- Be conversational but professional. Keep answers focused and to the point.
- Format responses with markdown for readability.
- When listing items from multiple meetings, organize them by meeting for clarity.

Here is the full context from all meetings:

`

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export function isActionItemArray(value: unknown): value is ActionItemShape[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.task === 'string' &&
        (item.owner === null || typeof item.owner === 'string') &&
        typeof item.done === 'boolean'
    )
  )
}

export function serializeMeetingChatContext(
  meeting: MeetingChatContextMeeting,
  sources: MeetingChatContextSource[] | null | undefined
): string {
  const meetingTitle =
    typeof meeting.title === 'string' && meeting.title.trim().length > 0
      ? meeting.title
      : 'Untitled Meeting'
  let context = `# Meeting: ${meetingTitle}\n\n`

  if (typeof meeting.summary === 'string' && meeting.summary.length > 0) {
    context += `## Summary\n${meeting.summary}\n\n`
  }

  if (typeof meeting.detailed_notes === 'string' && meeting.detailed_notes.length > 0) {
    context += `## Detailed Notes\n${meeting.detailed_notes}\n\n`
  }

  const actionItems = isActionItemArray(meeting.action_items) ? meeting.action_items : []
  if (actionItems.length > 0) {
    context += '## Action Items\n'
    for (const item of actionItems) {
      context += `- [${item.done ? 'x' : ' '}] ${item.task}${item.owner ? ` (Owner: ${item.owner})` : ''}\n`
    }
    context += '\n'
  }

  const keyDecisions = isStringArray(meeting.key_decisions) ? meeting.key_decisions : []
  if (keyDecisions.length > 0) {
    context += '## Key Decisions\n'
    for (const decision of keyDecisions) {
      context += `- ${decision}\n`
    }
    context += '\n'
  }

  const topics = isStringArray(meeting.topics) ? meeting.topics : []
  if (topics.length > 0) {
    context += '## Topics Discussed\n'
    for (const topic of topics) {
      context += `- ${topic}\n`
    }
    context += '\n'
  }

  const followUps = isStringArray(meeting.follow_ups) ? meeting.follow_ups : []
  if (followUps.length > 0) {
    context += '## Follow-ups\n'
    for (const followUp of followUps) {
      context += `- ${followUp}\n`
    }
    context += '\n'
  }

  if (typeof meeting.transcript === 'string' && meeting.transcript.length > 0) {
    const transcript =
      meeting.transcript.length > MAX_TRANSCRIPT_CHARS
        ? `${meeting.transcript.slice(0, MAX_TRANSCRIPT_CHARS)}\n\n[Transcript truncated due to length]`
        : meeting.transcript
    context += `## Full Transcript\n${transcript}\n\n`
  }

  if (sources && sources.length > 0) {
    context += '## External Sources\n'
    for (const source of sources) {
      if (typeof source.content !== 'string' || source.content.length === 0) {
        continue
      }

      const content =
        source.content.length > MAX_SOURCE_CONTENT_CHARS
          ? `${source.content.slice(0, MAX_SOURCE_CONTENT_CHARS)}\n\n[Document truncated due to length]`
          : source.content
      const sourceName = typeof source.name === 'string' ? source.name : 'Untitled source'
      const sourceType = typeof source.file_type === 'string' ? source.file_type : 'txt'
      context += `### ${sourceName} (${sourceType})\n${content}\n\n`
    }
  }

  return context
}

export function serializeGlobalChatContext(meetings: GlobalChatContextMeeting[]): string {
  let context = `# All Meetings (${meetings.length} total)\n\n`

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

    context += `---\n## ${meetingTitle} (${createdDate})\n\n`

    if (typeof meeting.summary === 'string' && meeting.summary.length > 0) {
      context += `### Summary\n${meeting.summary}\n\n`
    }

    const actionItems = isActionItemArray(meeting.action_items) ? meeting.action_items : []
    if (actionItems.length > 0) {
      context += '### Action Items\n'
      for (const item of actionItems) {
        context += `- [${item.done ? 'x' : ' '}] ${item.task}${item.owner ? ` (Owner: ${item.owner})` : ''}\n`
      }
      context += '\n'
    }

    const keyDecisions = isStringArray(meeting.key_decisions) ? meeting.key_decisions : []
    if (keyDecisions.length > 0) {
      context += '### Key Decisions\n'
      for (const decision of keyDecisions) {
        context += `- ${decision}\n`
      }
      context += '\n'
    }

    const topics = isStringArray(meeting.topics) ? meeting.topics : []
    if (topics.length > 0) {
      context += '### Topics\n'
      for (const topic of topics) {
        context += `- ${topic}\n`
      }
      context += '\n'
    }

    const followUps = isStringArray(meeting.follow_ups) ? meeting.follow_ups : []
    if (followUps.length > 0) {
      context += '### Follow-ups\n'
      for (const followUp of followUps) {
        context += `- ${followUp}\n`
      }
      context += '\n'
    }
  }

  return context
}

export function createMeetingChatSystemPrompt(context: string): string {
  return `${MEETING_CHAT_SYSTEM_PROMPT_TEMPLATE}${context}`
}

export function createGlobalChatSystemPrompt(context: string): string {
  return `${GLOBAL_CHAT_SYSTEM_PROMPT_TEMPLATE}${context}`
}
