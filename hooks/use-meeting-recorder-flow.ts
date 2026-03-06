import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAudioRecorder } from '@/hooks/use-audio-recorder'
import { useMeetingUploadFlow } from '@/hooks/use-meeting-upload-flow'
import { formatDuration } from '@/lib/formatters/meeting'
import type { MeetingStatus } from '@/lib/types'

const MAX_DURATION_SECONDS = 60 * 60
const WARNING_THRESHOLD_SECONDS = 55 * 60

interface ProcessingHandler {
  (state: { meetingId: string; step: MeetingStatus; error?: string }): void
}

export function useMeetingRecorderFlow(onProcessing: ProcessingHandler) {
  const {
    isRecording,
    isPaused,
    duration,
    audioBlob,
    hasSystemAudio,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
  } = useAudioRecorder()

  const [recordSystemAudio, setRecordSystemAudio] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const { isSubmitting, submitMeetingAudio } = useMeetingUploadFlow(onProcessing)

  const previewUrl = useMemo(() => {
    if (!audioBlob) return null
    return URL.createObjectURL(audioBlob)
  }, [audioBlob])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    if (isRecording && duration >= MAX_DURATION_SECONDS) {
      stopRecording()
      toast.info('Maximum recording duration reached (60 minutes).')
    }
  }, [duration, isRecording, stopRecording])

  const handleStart = async () => {
    try {
      await startRecording({ recordSystemAudio })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not start recording')
    }
  }

  const handleSubmit = async () => {
    if (!audioBlob) return
    await submitMeetingAudio({
      audio: audioBlob,
      filename: 'recording.webm',
      contentType: 'audio/webm',
      title: 'Processing...',
      duration,
    })
  }

  return {
    isRecording,
    isPaused,
    duration,
    durationLabel: formatDuration(duration),
    isNearLimit: isRecording && duration >= WARNING_THRESHOLD_SECONDS && duration < MAX_DURATION_SECONDS,
    remainingLabel: formatDuration(Math.max(MAX_DURATION_SECONDS - duration, 0)),
    audioBlob,
    hasSystemAudio,
    isSubmitting,
    recordSystemAudio,
    setRecordSystemAudio,
    isPlaying,
    setIsPlaying,
    previewUrl,
    audioElementRef,
    handleStart,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    handleSubmit,
  }
}
