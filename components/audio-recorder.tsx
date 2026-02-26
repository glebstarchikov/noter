'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, Square, Pause, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAudioRecorder } from '@/hooks/use-audio-recorder'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const MAX_DURATION_SECONDS = 60 * 60 // 60 minutes
const WARNING_THRESHOLD = 55 * 60 // 55 minutes

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

interface Props {
  onProcessing: (state: {
    meetingId: string
    step: 'transcribing' | 'generating' | 'done' | 'error'
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

  // Auto-stop at max duration
  if (isRecording && duration >= MAX_DURATION_SECONDS) {
    stopRecording()
    toast.info('Maximum recording duration reached (60 minutes).')
  }

  // Warning near max
  const isNearLimit = isRecording && duration >= WARNING_THRESHOLD && duration < MAX_DURATION_SECONDS

  const handleStart = async () => {
    try {
      await startRecording()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not start recording')
    }
  }

  const handleSubmit = async () => {
    if (!audioBlob) return
    setIsSubmitting(true)

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
          status: 'transcribing',
          audio_duration: duration,
        })
        .select('id')
        .single()

      if (insertError || !meeting) throw new Error('Failed to create meeting')

      onProcessing({ meetingId: meeting.id, step: 'transcribing' })

      // Send audio for transcription
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      formData.append('meetingId', meeting.id)

      const transcribeRes = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!transcribeRes.ok) {
        const textErr = await transcribeRes.text()
        let errorMessage = 'Transcription failed'
        try {
          const jsonErr = JSON.parse(textErr)
          errorMessage = jsonErr.error || errorMessage
        } catch {
          errorMessage = textErr || errorMessage
        }
        throw new Error(errorMessage)
      }

      const { transcript } = await transcribeRes.json()
      onProcessing({ meetingId: meeting.id, step: 'generating' })

      // Generate notes
      const notesRes = await fetch('/api/generate-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: meeting.id, transcript }),
      })

      if (!notesRes.ok) {
        const textErr = await notesRes.text()
        let errorMessage = 'Notes generation failed'
        try {
          const jsonErr = JSON.parse(textErr)
          errorMessage = jsonErr.error || errorMessage
        } catch {
          errorMessage = textErr || errorMessage
        }
        throw new Error(errorMessage)
      }

      onProcessing({ meetingId: meeting.id, step: 'done' })
      router.push(`/dashboard/${meeting.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      toast.error(message)
      onProcessing({ meetingId: '', step: 'error', error: message })
    } finally {
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
        <div className="flex items-center gap-1">
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
