import type { MeetingStatus } from '@/lib/types'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

export const meetingStatusMeta: Record<
  MeetingStatus,
  {
    stage: 'transcribing' | 'generating' | 'done' | 'error'
    label: string
    variant: BadgeVariant
    description: string
  }
> = {
  recording: {
    stage: 'transcribing',
    label: 'Recording',
    variant: 'default',
    description: 'Capturing meeting audio in your browser',
  },
  uploading: {
    stage: 'transcribing',
    label: 'Uploading',
    variant: 'default',
    description: 'Uploading recording to secure storage',
  },
  transcribing: {
    stage: 'transcribing',
    label: 'Transcribing',
    variant: 'default',
    description: 'Converting speech to text with Whisper',
  },
  generating: {
    stage: 'generating',
    label: 'Generating',
    variant: 'default',
    description: 'AI is extracting structured notes',
  },
  done: {
    stage: 'done',
    label: 'Complete',
    variant: 'secondary',
    description: 'Your meeting notes are ready',
  },
  error: {
    stage: 'error',
    label: 'Error',
    variant: 'destructive',
    description: 'Something went wrong while processing this meeting',
  },
}

export function formatMeetingDate(dateStr: string) {
  const d = new Date(dateStr)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const h = d.getHours()
  const m = d.getMinutes()
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}, ${hour12}:${m.toString().padStart(2, '0')} ${period}`
}

