'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { readApiError } from '@/lib/meeting-pipeline'
import { toast } from 'sonner'
import { useDeepgramTranscription } from '@/hooks/use-deepgram-transcription'
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
  const [recordSystemAudio, setRecordSystemAudio] = useState(false)
  const [hasSystemAudio, setHasSystemAudio] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [duration, setDuration] = useState(initialAudioDuration ?? 0)
  const [savedSegments, setSavedSegments] = useState<DiarizedSegment[]>(
    initialDiarizedTranscript ?? []
  )
  const [savedTranscript, setSavedTranscript] = useState(initialTranscript ?? '')
  const [analyserReady, setAnalyserReady] = useState(false)

  const streamRef = useRef<MediaStream | null>(null)
  const sourceStreamsRef = useRef<MediaStream[]>([])
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)

  const { startTranscription, stopTranscription, isConnected, liveSegments } =
    useDeepgramTranscription()

  const stopActiveStreams = useCallback(() => {
    const seenTracks = new Set<MediaStreamTrack>()

    for (const stream of [streamRef.current, ...sourceStreamsRef.current]) {
      if (!stream) continue

      for (const track of stream.getTracks()) {
        if (seenTracks.has(track)) continue
        seenTracks.add(track)
        track.stop()
      }
    }

    streamRef.current = null
    sourceStreamsRef.current = []
  }, [])

  const closeAudioSession = useCallback(() => {
    analyserRef.current = null
    setAnalyserReady(false)

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close()
    }

    audioContextRef.current = null
  }, [])

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
      stopActiveStreams()
      closeAudioSession()
    }
  }, [closeAudioSession, stopActiveStreams])

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
    stopActiveStreams()
    closeAudioSession()

    setPhase('setup')
    setHasSystemAudio(false)
    setIsPaused(false)
    setDuration(0)
    chunksRef.current = []
    mediaRecorderRef.current = null
  }, [closeAudioSession, stopActiveStreams])

  const handleStartRecording = useCallback(async () => {
    try {
      let finalStream: MediaStream
      setHasSystemAudio(false)
      setIsPaused(false)
      setDuration(0)
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      let systemStream: MediaStream | null = null

      if (recordSystemAudio) {
        try {
          systemStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          })
          const systemAudioTracks = systemStream.getAudioTracks()
          if (systemAudioTracks.length === 0) {
            systemStream.getTracks().forEach((track) => track.stop())
            micStream.getTracks().forEach((track) => track.stop())
            throw new Error('Check "Share system/tab audio" when selecting what to share.')
          }

          systemStream.getVideoTracks()[0]?.stop()
        } catch (error) {
          systemStream?.getTracks().forEach((track) => track.stop())
          micStream.getTracks().forEach((track) => track.stop())
          throw error
        }
      }

      const audioContext = new AudioContext()
      audioContextRef.current = audioContext

      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.6

      const silentMonitor = audioContext.createGain()
      silentMonitor.gain.value = 0
      analyser.connect(silentMonitor)
      silentMonitor.connect(audioContext.destination)

      if (systemStream) {
        const micSource = audioContext.createMediaStreamSource(micStream)
        const systemSource = audioContext.createMediaStreamSource(systemStream)
        const destination = audioContext.createMediaStreamDestination()

        micSource.connect(destination)
        systemSource.connect(destination)
        micSource.connect(analyser)
        systemSource.connect(analyser)

        finalStream = destination.stream
        setHasSystemAudio(true)
      } else {
        const micSource = audioContext.createMediaStreamSource(micStream)
        micSource.connect(analyser)
        finalStream = micStream
      }

      sourceStreamsRef.current = systemStream ? [micStream, systemStream] : [micStream]
      analyserRef.current = analyser
      setAnalyserReady(true)
      streamRef.current = finalStream
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
      stopActiveStreams()
      mediaRecorderRef.current = null
      closeAudioSession()

      toast.error(error instanceof Error ? error.message : "We couldn't access your microphone. Please check your permissions.")
    }
  }, [closeAudioSession, recordSystemAudio, startTranscription, stopActiveStreams])

  const togglePause = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder) return

    if (isPaused) {
      recorder.resume()
      void audioContextRef.current?.resume()
      timerRef.current = setInterval(() => setDuration((value) => value + 1), 1000)
    } else {
      recorder.pause()
      void audioContextRef.current?.suspend()
      if (timerRef.current) clearInterval(timerRef.current)
    }

    setIsPaused((value) => !value)
  }, [isPaused])

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
      stopActiveStreams()
      mediaRecorderRef.current = null
      chunksRef.current = []
      closeAudioSession()
      setIsPaused(false)
    }
  }, [closeAudioSession, duration, meetingId, resetRecordingSurface, router, stopActiveStreams, stopTranscription])

  return {
    phase,
    recordSystemAudio,
    hasSystemAudio,
    isPaused,
    duration,
    savedSegments,
    savedTranscript,
    analyserNode: analyserReady ? analyserRef.current : null,
    isConnected,
    liveSegments,
    setRecordSystemAudio,
    handleStartRecording,
    togglePause,
    handleStop,
    resetRecordingSurface,
  }
}
