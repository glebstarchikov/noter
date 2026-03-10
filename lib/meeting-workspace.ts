import type { Meeting, MeetingStatus } from '@/lib/types'

type MeetingWorkspaceFields = Pick<Meeting, 'status' | 'diarized_transcript'>

export function isRecordingOriginMeeting(meeting: MeetingWorkspaceFields): boolean {
  return meeting.status === 'recording' || Boolean(meeting.diarized_transcript)
}

export function shouldUseProcessingView(
  meeting: Pick<Meeting, 'status' | 'diarized_transcript'>
): boolean {
  if (isRecordingOriginMeeting(meeting)) {
    return false
  }

  return isProcessingStatus(meeting.status)
}

function isProcessingStatus(status: MeetingStatus): boolean {
  return (
    status === 'uploading' ||
    status === 'transcribing' ||
    status === 'generating' ||
    status === 'error'
  )
}
