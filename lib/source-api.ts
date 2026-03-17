import type { MeetingSource } from '@/lib/types'

/**
 * Fetches all sources for a given meeting.
 */
export async function fetchSources(meetingId: string): Promise<Omit<MeetingSource, 'content'>[]> {
  const res = await fetch(`/api/sources?meetingId=${meetingId}`)
  if (!res.ok) throw new Error('Failed to fetch sources')
  const data = await res.json()
  return data.sources ?? []
}

/**
 * Uploads a file as a source document for a meeting.
 * Returns the created source record.
 */
export async function uploadSource(meetingId: string, file: File): Promise<Omit<MeetingSource, 'content'>> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('meetingId', meetingId)

  const res = await fetch('/api/sources', {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const textErr = await res.text()
    let errorMessage = 'Upload failed'
    try {
      const jsonErr = JSON.parse(textErr)
      errorMessage = jsonErr.error || errorMessage
    } catch {
      errorMessage = textErr || errorMessage
    }
    throw new Error(errorMessage)
  }

  const data = await res.json()
  return data.source
}

/**
 * Deletes a source document by ID.
 */
export async function deleteSource(sourceId: string): Promise<void> {
  const res = await fetch('/api/sources', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceId }),
  })

  if (!res.ok) throw new Error('Delete failed')
}
