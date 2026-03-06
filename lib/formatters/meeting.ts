import type { MeetingStatus } from '@/lib/types'

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function formatMeetingDateShort(dateStr: string) {
  const d = new Date(dateStr)
  const h = d.getHours()
  const m = d.getMinutes()
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}, ${hour12}:${m.toString().padStart(2, '0')} ${period}`
}

export function formatMeetingDateLong(dateStr: string) {
  const d = new Date(dateStr)
  const h = d.getHours()
  const m = d.getMinutes()
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${hour12}:${m.toString().padStart(2, '0')} ${period}`
}

export function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function getMeetingStatusBadge(status: MeetingStatus | string): {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
} {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    recording: { label: 'Recording', variant: 'default' },
    uploading: { label: 'Uploading', variant: 'default' },
    transcribing: { label: 'Transcribing', variant: 'default' },
    generating: { label: 'Generating', variant: 'default' },
    done: { label: 'Complete', variant: 'secondary' },
    error: { label: 'Error', variant: 'destructive' },
  }
  return map[status] ?? { label: status, variant: 'outline' }
}
