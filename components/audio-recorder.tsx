'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, Square, Pause, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAudioRecorder } from '@/hooks/use-audio-recorder'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { MeetingStatus } from '@/lib/types'

const MAX_DURATION_SECONDS = 60 * 60 // 60 minutes
const WARNING_THRESHOLD = 55 * 60 // 55 minutes
const STATUS_POLL_INTERVAL_MS = 3_000
const STATUS_POLL_TIMEOUT_MS = 20 * 60 * 1000

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

interface Props {
  onProcessing: (state: {
    meetingId: string
    step: MeetingStatus
    error?: string
  }) => void
}

export function AudioRecorder({ onProcessing }: Props) {
  const router = useRouter()
  const {
    isRecording,
    isPaused,
    duration,
    audioBlob,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
  } = useAudioRecorder()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)

  // Auto-stop at max duration
  useEffect(() => {
    if (isRecording && duration >= MAX_DURATION_SECONDS) {
      stopRecording()
      toast.info('Maximum recording duration reached (60 minutes).')
    }
  }, [isRecording, duration, stopRecording])

  // Warning near max
  const isNearLimit = isRecording && duration >= WARNING_THRESHOLD && duration < MAX_DURATION_SECONDS

  const handleStart = async () => {
    try {
      await startRecording()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not start recording')
    }
  }

  const readApiError = async (response: Response, fallbackMessage: string) => {
    const text = await response.text()
    try {
      const parsed = JSON.parse(text)
      return {
        message: typeof parsed?.error === 'string' ? parsed.error : fallbackMessage,
        code: typeof parsed?.code === 'string' ? parsed.code : undefined,
      }
    } catch {
      return { message: text || fallbackMessage, code: undefined }
    }
  }

  const waitForMeetingCompletion = async (meetingId: string) => {
    const startedAt = Date.now()

    while (Date.now() - startedAt < STATUS_POLL_TIMEOUT_MS) {
      const statusRes = await fetch(`/api/meetings/${meetingId}`, { cache: 'no-store' })
      if (!statusRes.ok) {
        await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_INTERVAL_MS))
        continue
      }

      const payload = await statusRes.json().catch(() => null)
      const status = payload?.meeting?.status as MeetingStatus | undefined
      const errorMessage = payload?.meeting?.error_message as string | null | undefined

      if (status && ['recording', 'uploading', 'transcribing', 'generating', 'done', 'error'].includes(status)) {
        onProcessing({
          meetingId,
          step: status,
          error: status === 'error' ? errorMessage ?? undefined : undefined,
        })
      }

      if (status === 'done') {
        return
      }

      if (status === 'error') {
        throw new Error(errorMessage || 'Processing failed')
      }

      await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_INTERVAL_MS))
    }

    throw new Error('Processing timed out. Please open the meeting from dashboard and try again.')
  }

  const runLegacyPipeline = async (meetingId: string, storagePath: string) => {
    onProcessing({ meetingId, step: 'transcribing' })

    const transcribeRes = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId, storagePath }),
    })

    if (!transcribeRes.ok) {
      const { message } = await readApiError(transcribeRes, 'Transcription failed')
      throw new Error(message)
    }

    await transcribeRes.json()
    onProcessing({ meetingId, step: 'generating' })

    const notesRes = await fetch('/api/generate-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId }),
    })

    if (!notesRes.ok) {
      const { message } = await readApiError(notesRes, 'Notes generation failed')
      throw new Error(message)
    }
  }

  const handleSubmit = async () => {
    if (!audioBlob || submittingRef.current) return
    submittingRef.current = true
    setIsSubmitting(true)
    let currentMeetingId = ''

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Create meeting record
      const { data: meeting, error: insertError } = await supabase
        .from('meetings')
        .insert({
          user_id: user.id,
          title: 'Processing...',
          status: 'uploading',
          audio_duration: duration,
        })
        .select('id')
        .single()

      if (insertError || !meeting) throw new Error('Failed to create meeting')

      currentMeetingId = meeting.id
      onProcessing({ meetingId: meeting.id, step: 'uploading' })

      // Upload audio directly to Supabase Storage (avoids serverless payload limits)
      const storagePath = `${user.id}/${meeting.id}.webm`
      const { error: uploadError } = await supabase.storage
        .from('meeting-audio')
        .upload(storagePath, audioBlob, {
          contentType: 'audio/webm',
        })

      if (uploadError) throw new Error('Failed to upload audio: ' + uploadError.message)

      // Save storage path to DB
      await supabase
        .from('meetings')
        .update({ audio_url: storagePath })
        .eq('id', meeting.id)

      const processRes = await fetch(`/api/meetings/${meeting.id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!processRes.ok) {
        const processError = await readApiError(processRes, 'Failed to queue processing')
        if (processError.code === 'QUEUE_UNAVAILABLE') {
          await runLegacyPipeline(meeting.id, storagePath)
          onProcessing({ meetingId: meeting.id, step: 'done' })
          router.push(`/dashboard/${meeting.id}`)
          return
        }

        throw new Error(processError.message)
      }

      onProcessing({ meetingId: meeting.id, step: 'transcribing' })
      await waitForMeetingCompletion(meeting.id)
      onProcessing({ meetingId: meeting.id, step: 'done' })
      router.push(`/dashboard/${meeting.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      toast.error(message)
      onProcessing({ meetingId: currentMeetingId, step: 'error', error: message })
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-8 rounded-xl border border-border bg-card px-6 py-16">
      {/* Timer */}
      <div className="font-mono text-5xl font-light tracking-wider text-foreground">
        {formatTime(duration)}
      </div>

      {/* Waveform indicator */}
      {isRecording && !isPaused && (
        <div className="flex items-center gap-1" aria-hidden="true">
          {[16, 24, 32, 20, 28].map((h, i) => (
            <span
              key={i}
              className="inline-block w-1 rounded-full bg-accent"
              style={{
                height: `${h}px`,
                animation: `pulse 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
              }}
            />
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-4">
        {!isRecording && !audioBlob && (
          <Button
            onClick={handleStart}
            size="lg"
            className="h-14 w-14 rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Mic className="h-6 w-6" />
            <span className="sr-only">Start recording</span>
          </Button>
        )}

        {isRecording && (
          <>
            <Button
              onClick={isPaused ? resumeRecording : pauseRecording}
              variant="outline"
              size="lg"
              className="h-12 w-12 rounded-full border-border"
            >
              {isPaused ? (
                <Play className="h-5 w-5" />
              ) : (
                <Pause className="h-5 w-5" />
              )}
              <span className="sr-only">{isPaused ? 'Resume' : 'Pause'}</span>
            </Button>
            <Button
              onClick={stopRecording}
              size="lg"
              className="h-14 w-14 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Square className="h-5 w-5" />
              <span className="sr-only">Stop recording</span>
            </Button>
          </>
        )}

        {audioBlob && !isRecording && (
          <>
            <Button
              onClick={resetRecording}
              variant="outline"
              size="lg"
              className="h-12 w-12 rounded-full border-border"
            >
              <RotateCcw className="h-5 w-5" />
              <span className="sr-only">Re-record</span>
            </Button>
            <Button
              onClick={handleSubmit}
              size="lg"
              disabled={isSubmitting}
              className="rounded-lg bg-foreground px-8 text-background hover:bg-foreground/90"
            >
              {isSubmitting ? 'Processing...' : 'Generate notes'}
            </Button>
          </>
        )}
      </div>

      {/* Status text */}
      <p className={`text-xs ${isNearLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
        {!isRecording && !audioBlob && 'Tap to start recording'}
        {isRecording && !isPaused && !isNearLimit && 'Recording in progress...'}
        {isRecording && !isPaused && isNearLimit && `Warning: ${formatTime(MAX_DURATION_SECONDS - duration)} remaining before auto-stop`}
        {isPaused && 'Recording paused'}
        {audioBlob && !isRecording && `${formatTime(duration)} recorded - ready to process`}
      </p>
    </div>
  )
}
