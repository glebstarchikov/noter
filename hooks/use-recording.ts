'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { readApiError } from '@/lib/meetings/meeting-pipeline'
import { toast } from 'sonner'
import { useDeepgramTranscription } from '@/hooks/use-deepgram-transcription'
import { useMediaStream } from '@/hooks/use-media-stream'
import type { RecordingPhase } from '@/components/assistant-shell-context'
import type { DiarizedSegment } from '@/lib/types'

interface UseRecordingParams {
  meetingId: string
  meetingStatus: string
  initialDiarizedTranscript: DiarizedSegment[] | null | undefined
  initialTranscript: string | null | undefined
  initialAudioDuration: number | null | undefined
}

export interface UseRecordingReturn {
  phase: RecordingPhase
  recordSystemAudio: boolean
  hasSystemAudio: boolean
  isPaused: boolean
  duration: number
  savedSegments: DiarizedSegment[]
  savedTranscript: string
  analyserNode: AnalyserNode | null
  isConnected: boolean
  liveSegments: ReturnType<typeof useDeepgramTranscription>['liveSegments']
  setRecordSystemAudio: (value: boolean) => void
  handleStartRecording: () => Promise<void>
  togglePause: () => void
  handleStop: () => Promise<void>
  resetRecordingSurface: () => void
}

export function useRecording({
  meetingId,
  meetingStatus,
  initialDiarizedTranscript,
  initialTranscript,
  initialAudioDuration,
}: UseRecordingParams): UseRecordingReturn {
  const router = useRouter()

  const [phase, setPhase] = useState<RecordingPhase>(
    meetingStatus === 'recording' ? 'setup' : 'done'
  )
  const [isPaused, setIsPaused] = useState(false)
  const [duration, setDuration] = useState(initialAudioDuration ?? 0)
  const [savedSegments, setSavedSegments] = useState<DiarizedSegment[]>(
    initialDiarizedTranscript ?? []
  )
  const [savedTranscript, setSavedTranscript] = useState(initialTranscript ?? '')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const mediaStream = useMediaStream()
  const { startTranscription, stopTranscription, isConnected, liveSegments } =
    useDeepgramTranscription()

  useEffect(() => {
    if (meetingStatus !== 'recording') {
      setPhase('done')
    }

    setSavedSegments(initialDiarizedTranscript ?? [])
    setSavedTranscript(initialTranscript ?? '')
    if (initialAudioDuration != null) {
      setDuration(initialAudioDuration)
    }
  }, [initialAudioDuration, initialDiarizedTranscript, meetingStatus, initialTranscript])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      mediaStream.stopAllStreams()
      mediaStream.closeAudioSession()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Warn before closing tab during active recording or upload
  useEffect(() => {
    if (phase !== 'recording' && phase !== 'stopping') return

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }

    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [phase])

  const resetRecordingSurface = useCallback(() => {
    mediaStream.stopAllStreams()
    mediaStream.closeAudioSession()

    setPhase('setup')
    setIsPaused(false)
    setDuration(0)
    chunksRef.current = []
    mediaRecorderRef.current = null
  }, [mediaStream])

  const handleStartRecording = useCallback(async () => {
    try {
      setIsPaused(false)
      setDuration(0)

      const acquired = await mediaStream.acquireStream()
      if (!acquired) return

      const { finalStream } = acquired

      await startTranscription(finalStream)

      const recorder = new MediaRecorder(finalStream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      })
      mediaRecorderRef.current = recorder
      chunksRef.current = []
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      })
      recorder.start(1000)

      timerRef.current = setInterval(() => {
        setDuration((value) => {
          if (value + 1 === 7200) {
            toast.warning('You have been recording for 2 hours. Consider stopping soon to avoid issues.')
          }
          return value + 1
        })
      }, 1000)
      setPhase('recording')
    } catch (error: unknown) {
      mediaStream.stopAllStreams()
      mediaRecorderRef.current = null
      mediaStream.closeAudioSession()

      toast.error(error instanceof Error ? error.message : "We couldn't access your microphone. Please check your permissions.")
    }
  }, [mediaStream, startTranscription])

  const togglePause = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder) return

    if (isPaused) {
      recorder.resume()
      mediaStream.resumeAudioContext()
      timerRef.current = setInterval(() => setDuration((value) => value + 1), 1000)
    } else {
      recorder.pause()
      mediaStream.suspendAudioContext()
      if (timerRef.current) clearInterval(timerRef.current)
    }

    setIsPaused((value) => !value)
  }, [isPaused, mediaStream])

  const handleStop = useCallback(async () => {
    setPhase('stopping')
    if (timerRef.current) clearInterval(timerRef.current)
    const supabase = createClient()
    let userId: string | null = null
    let generationStarted = false

    try {
      const recorder = mediaRecorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        await new Promise<void>((resolve) => {
          recorder.addEventListener('stop', () => resolve(), { once: true })
          recorder.stop()
        })
      }

      const segments = await stopTranscription()
      const flatTranscript = segments.map((segment) => `${segment.speaker}: ${segment.text}`).join('\n')
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })

      setSavedSegments(segments)
      setSavedTranscript(flatTranscript)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      userId = user.id

      const storagePath = `${user.id}/${meetingId}.webm`
      const maxRetries = 3
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const { error: uploadError } = await supabase.storage
          .from('meeting-audio')
          .upload(storagePath, audioBlob, { contentType: 'audio/webm', upsert: true })
        if (!uploadError) break
        if (attempt === maxRetries - 1) throw new Error(uploadError.message)
        // Exponential backoff: 1s, 2s
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
      }

      const { error: updateError } = await supabase
        .from('meetings')
        .update({
          status: 'generating',
          audio_url: storagePath,
          audio_duration: duration,
          ...(flatTranscript ? { transcript: flatTranscript } : {}),
          ...(segments.length > 0 ? { diarized_transcript: segments } : {}),
        })
        .eq('id', meetingId)
        .eq('user_id', user.id)

      if (updateError) throw new Error(updateError.message)

      generationStarted = true
      setPhase('done')

      const notesRes = await fetch('/api/generate-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId }),
      })

      if (!notesRes.ok) {
        const { message } = await readApiError(notesRes, 'Notes generation failed')
        throw new Error(message)
      }

      router.refresh()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save recording'

      if (generationStarted && userId) {
        try {
          await supabase
            .from('meetings')
            .update({
              status: 'error',
              error_message: message,
            })
            .eq('id', meetingId)
            .eq('user_id', userId)
        } catch {
          // Best effort only.
        }

        toast.error(message)
        router.refresh()
        return
      }

      toast.error(message)
      resetRecordingSurface()
    } finally {
      if (timerRef.current) clearInterval(timerRef.current)
      mediaStream.stopAllStreams()
      mediaRecorderRef.current = null
      chunksRef.current = []
      mediaStream.closeAudioSession()
      setIsPaused(false)
    }
  }, [duration, meetingId, mediaStream, resetRecordingSurface, router, stopTranscription])

  return {
    phase,
    recordSystemAudio: mediaStream.recordSystemAudio,
    hasSystemAudio: mediaStream.hasSystemAudio,
    isPaused,
    duration,
    savedSegments,
    savedTranscript,
    analyserNode: mediaStream.analyserNode,
    isConnected,
    liveSegments,
    setRecordSystemAudio: mediaStream.setRecordSystemAudio,
    handleStartRecording,
    togglePause,
    handleStop,
    resetRecordingSurface,
  }
}
