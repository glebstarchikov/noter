'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, Square, Pause, Play, RotateCcw, Loader2, Monitor, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAudioRecorder } from '@/hooks/use-audio-recorder'
import { toast } from 'sonner'
import type { MeetingStatus } from '@/lib/types'
import { ingestMeetingAudio } from '@/lib/client/meeting-ingestion'

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
    hasSystemAudio,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
  } = useAudioRecorder()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [recordSystemAudio, setRecordSystemAudio] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)

  // Create object URL for audio preview
  const previewUrl = useMemo(() => {
    if (!audioBlob) return null
    return URL.createObjectURL(audioBlob)
  }, [audioBlob])

  // Revoke preview URL on cleanup / reset
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

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
      await startRecording({ recordSystemAudio })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not start recording')
    }
  }

  const handleSubmit = async () => {
    if (!audioBlob || submittingRef.current) return
    submittingRef.current = true
    setIsSubmitting(true)
    let currentMeetingId = ''

    try {
      const { meetingId } = await ingestMeetingAudio({
        title: 'Processing...',
        audioFile: audioBlob,
        fileExtension: 'webm',
        contentType: 'audio/webm',
        audioDuration: duration,
        onProcessing,
      })

      currentMeetingId = meetingId
      router.push(`/dashboard/${meetingId}`)
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
        <div className="flex flex-col items-center gap-3">
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
          {hasSystemAudio && (
            <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1">
              <Monitor className="size-3 text-primary" />
              <span className="text-xs font-medium text-primary">System audio active</span>
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-4">
          {!isRecording && !audioBlob && (
            <Button
              onClick={handleStart}
              size="lg"
              className="size-14 rounded-full bg-accent text-accent-foreground hover:bg-accent/80"
            >
              <Mic className="size-6" />
              <span className="sr-only">Start recording</span>
            </Button>
          )}

          {isRecording && (
            <>
              <Button
                onClick={isPaused ? resumeRecording : pauseRecording}
                variant="outline"
                size="lg"
                className="size-12 rounded-full border-border"
              >
                {isPaused ? (
                  <Play className="size-5" />
                ) : (
                  <Pause className="size-5" />
                )}
                <span className="sr-only">{isPaused ? 'Resume' : 'Pause'}</span>
              </Button>
              <Button
                onClick={stopRecording}
                size="lg"
                className="size-14 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                <Square className="size-5" />
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
                className="size-12 rounded-full border-border"
              >
                <RotateCcw className="size-5" />
                <span className="sr-only">Re-record</span>
              </Button>
              <Button
                onClick={handleSubmit}
                size="lg"
                disabled={isSubmitting}
                className="rounded-lg bg-foreground px-8 text-background hover:bg-foreground/90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Processing…
                  </>
                ) : (
                  'Generate notes'
                )}
              </Button>
            </>
          )}
        </div>

        {/* Audio preview */}
        {audioBlob && !isRecording && previewUrl && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-2.5">
            <Button
              onClick={() => {
                const el = audioElementRef.current
                if (!el) return
                if (isPlaying) {
                  el.pause()
                } else {
                  el.play()
                }
              }}
              variant="ghost"
              size="sm"
              className="size-8 rounded-full p-0"
            >
              {isPlaying ? (
                <Pause className="size-3.5" />
              ) : (
                <Play className="size-3.5" />
              )}
              <span className="sr-only">{isPlaying ? 'Pause preview' : 'Play preview'}</span>
            </Button>
            <span className="text-xs text-muted-foreground">Preview recording</span>
            <audio
              ref={audioElementRef}
              src={previewUrl}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
          </div>
        )}

        {!isRecording && !audioBlob && (
          <TooltipProvider>
            <div className="flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-2">
              <Switch
                id="system-audio"
                checked={recordSystemAudio}
                onCheckedChange={setRecordSystemAudio}
                className="data-[state=checked]:bg-primary"
              />
              <Label htmlFor="system-audio" className="cursor-pointer text-sm font-medium text-foreground">
                Include system audio
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost-icon"
                    size="icon-xs"
                    className="rounded-full"
                    aria-label="What is system audio?"
                  >
                    <Info className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px] text-xs">
                  Captures audio playing on your computer (e.g., Zoom, Google Meet). You'll be asked to select a tab or screen to share.
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
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
