const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatTimeOfDay(d: Date): string {
  const h = d.getHours()
  const m = d.getMinutes()
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`
}

/**
 * Full date with weekday: "Sunday, January 15, 2026 at 2:30 PM"
 */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${formatTimeOfDay(d)}`
}

/**
 * Compact date without year/weekday: "Jan 15, 2:30 PM"
 */
export function formatDateCompact(dateStr: string): string {
  const d = new Date(dateStr)
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${formatTimeOfDay(d)}`
}

/**
 * Context-aware relative date:
 * - "Today at 2:30 PM"
 * - "Yesterday"
 * - "Mon Jan 15" (within last week)
 * - "Jan 15" (same year)
 * - "Jan 15, 2025" (different year)
 */
export function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)

  if (d >= todayStart) return `Today at ${formatTimeOfDay(d)}`
  if (d >= yesterdayStart) return 'Yesterday'

  const weekAgo = new Date(todayStart.getTime() - 6 * 86400000)
  if (d >= weekAgo) return `${WEEKDAYS_SHORT[d.getDay()]} ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`

  if (d.getFullYear() === now.getFullYear()) return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`

  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

/**
 * Elapsed seconds as MM:SS timer display: "01:45"
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * Audio duration in human-readable format: "5m 30s"
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}
