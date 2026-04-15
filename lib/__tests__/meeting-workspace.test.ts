import { describe, expect, it } from 'bun:test'
import { isRecordingOriginMeeting, shouldUseProcessingView } from '@/lib/meetings/meeting-workspace'

describe('meeting workspace helpers', () => {
  it('identifies recording-origin meetings from active recording status', () => {
    expect(isRecordingOriginMeeting({
      status: 'recording',
      diarized_transcript: null,
    })).toBe(true)
  })

  it('identifies recording-origin meetings from persisted diarized transcript', () => {
    expect(isRecordingOriginMeeting({
      status: 'done',
      diarized_transcript: [{ speaker: 'Speaker 1', start: 0, end: 5, text: 'Hello' }],
    })).toBe(true)
  })

  it('keeps upload-origin notes on the processing view while they are still processing', () => {
    expect(shouldUseProcessingView({
      status: 'generating',
      diarized_transcript: null,
    })).toBe(true)
  })

  it('keeps recording-origin notes in the workspace even when metadata generation fails', () => {
    expect(shouldUseProcessingView({
      status: 'error',
      diarized_transcript: [{ speaker: 'Speaker 1', start: 0, end: 5, text: 'Hello' }],
    })).toBe(false)
  })
})
