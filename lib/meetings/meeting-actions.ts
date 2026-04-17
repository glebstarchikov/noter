import { toast } from 'sonner'
import { clearChatMessages } from '@/lib/chat/chat-storage'
import { tiptapToMarkdown } from '@/lib/tiptap/tiptap-converter'
import type { ActionItem, Meeting, DiarizedSegment } from '@/lib/types'

/**
 * Deletes a meeting via the API, clears chat messages, and returns true on success.
 */
export async function deleteMeeting(meetingId: string): Promise<boolean> {
  const response = await fetch(`/api/meetings/${meetingId}`, { method: 'DELETE' })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error || 'Failed to delete note')
  }
  clearChatMessages(meetingId)
  return true
}

/**
 * Toggles the pin status of a meeting. Returns the new pinned state.
 * Throws on failure.
 */
export async function toggleMeetingPin(meetingId: string, currentPinned: boolean): Promise<boolean> {
  const newPinned = !currentPinned
  const res = await fetch(`/api/meetings/${meetingId}/pin`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pinned: newPinned }),
  })
  if (!res.ok) throw new Error('Failed to update pin')
  return newPinned
}

/**
 * Builds a markdown representation of meeting notes and copies it to the clipboard.
 */
export function copyMeetingNotes(meeting: Pick<Meeting, 'title' | 'summary' | 'detailed_notes' | 'key_decisions' | 'action_items' | 'follow_ups'>): void {
  const actionItems: ActionItem[] = meeting.action_items || []
  const followUps = meeting.follow_ups ?? []
  const parts: string[] = []

  if (meeting.title) parts.push(`# ${meeting.title}\n`)
  if (meeting.summary) parts.push(`${meeting.summary}\n`)

  if (meeting.detailed_notes) {
    parts.push(meeting.detailed_notes)
  } else {
    const decisions = meeting.key_decisions ?? []
    if (decisions.length > 0) {
      parts.push(`## Key Decisions\n${decisions.map((d) => `- ${d}`).join('\n')}`)
    }
  }

  if (actionItems.length > 0) {
    parts.push(`## Action Items\n${actionItems.map((a) => `- [${a.done ? 'x' : ' '}] ${a.task}${a.owner ? ` (${a.owner})` : ''}`).join('\n')}`)
  }

  if (followUps.length > 0) {
    parts.push(`## Follow-ups\n${followUps.map((f) => `- ${f}`).join('\n')}`)
  }

  navigator.clipboard.writeText(parts.join('\n\n')).then(() => {
    toast.success('Notes copied to clipboard')
  }).catch(() => {
    toast.error("We couldn't copy your notes. Please try again.")
  })
}

export function copyDocumentAsMarkdown(
  document: unknown,
  title: string,
): void {
  const markdown = tiptapToMarkdown(document)
  if (!markdown) {
    toast.error('Nothing to copy yet.')
    return
  }
  navigator.clipboard.writeText(`# ${title}\n\n${markdown}`).then(() => {
    toast.success('Notes copied as Markdown')
  }).catch(() => {
    toast.error("We couldn't copy your notes. Please try again.")
  })
}

export function copyTranscriptAsMarkdown(
  title: string,
  transcript: string | null,
  diarizedTranscript: DiarizedSegment[] | null,
): void {
  const lines: string[] = [`# ${title} — Transcript`, '']

  if (diarizedTranscript?.length) {
    let currentSpeaker: string | null = null
    for (const seg of diarizedTranscript) {
      if (seg.speaker !== currentSpeaker) {
        if (currentSpeaker !== null) lines.push('')
        lines.push(`**${seg.speaker}:**`)
        currentSpeaker = seg.speaker
      }
      lines.push(seg.text.trim())
    }
  } else if (transcript?.trim()) {
    lines.push(transcript.trim())
  } else {
    toast.error('No transcript to copy.')
    return
  }

  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    toast.success('Transcript copied as Markdown')
  }).catch(() => {
    toast.error("We couldn't copy the transcript. Please try again.")
  })
}
