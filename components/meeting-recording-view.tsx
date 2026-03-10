'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Square, Pause, Play, Mic, Monitor, Info, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { readApiError } from '@/lib/meeting-pipeline'
import { toast } from 'sonner'
import { useDeepgramTranscription } from '@/hooks/use-deepgram-transcription'
import { MeetingEditor } from '@/components/meeting-editor'
import { TranscriptDrawer } from '@/components/transcript-drawer'
import type { Meeting, DiarizedSegment } from '@/lib/types'

type RecordingPhase = 'setup' | 'recording' | 'stopping' | 'done'

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function PageHeader({ title, date }: { title: string; date?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Link
        href="/dashboard"
        className="flex w-fit items-center gap-1 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-3" />
        Back to notes
      </Link>
      <h1 className="text-[26px] font-semibold tracking-tight text-foreground">{title}</h1>
      {date && <span className="text-sm text-muted-foreground">{date}</span>}
    </div>
  )
}

export function MeetingRecordingView({ meeting }: { meeting: Meeting }) {
  const router = useRouter()
  const [phase, setPhase] = useState<RecordingPhase>('setup')
  const [recordSystemAudio, setRecordSystemAudio] = useState(false)
  const [hasSystemAudio, setHasSystemAudio] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [duration, setDuration] = useState(0)
  const [savedSegments, setSavedSegments] = useState<DiarizedSegment[]>(meeting.diarized_transcript ?? [])
  const [savedTranscript, setSavedTranscript] = useState(meeting.transcript ?? '')

  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  const { startTranscription, stopTranscription, isConnected, liveSegments } =
    useDeepgramTranscription()

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        void audioContextRef.current.close()
      }
    }
  }, [])

  const resetRecordingSurface = useCallback(() => {
    setPhase('setup')
    setHasSystemAudio(false)
    setIsPaused(false)
    setDuration(0)
    chunksRef.current = []
    mediaRecorderRef.current = null
    streamRef.current = null
    audioContextRef.current = null
  }, [])

  const handleStartRecording = async () => {
    try {
      let finalStream: MediaStream
      setHasSystemAudio(false)
      setIsPaused(false)
      setDuration(0)
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })

      if (recordSystemAudio) {
        try {
          const systemStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          })
          const systemAudioTracks = systemStream.getAudioTracks()
          if (systemAudioTracks.length === 0) {
            systemStream.getTracks().forEach((track) => track.stop())
            micStream.getTracks().forEach((track) => track.stop())
            throw new Error('Check "Share system/tab audio" when selecting what to share.')
          }

          const audioContext = new AudioContext()
          audioContextRef.current = audioContext
          const micSource = audioContext.createMediaStreamSource(micStream)
          const systemSource = audioContext.createMediaStreamSource(systemStream)
          const destination = audioContext.createMediaStreamDestination()
          micSource.connect(destination)
          systemSource.connect(destination)
          finalStream = destination.stream

          systemStream.getVideoTracks()[0]?.stop()
          setHasSystemAudio(true)
        } catch (error) {
          micStream.getTracks().forEach((track) => track.stop())
          throw error
        }
      } else {
        finalStream = micStream
      }

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

      timerRef.current = setInterval(() => setDuration((value) => value + 1), 1000)
      setPhase('recording')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Could not access audio')
    }
  }

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

      const storagePath = `${user.id}/${meeting.id}.webm`
      const { error: uploadError } = await supabase.storage
        .from('meeting-audio')
        .upload(storagePath, audioBlob, { contentType: 'audio/webm', upsert: true })
      if (uploadError) throw new Error(uploadError.message)

      const { error: updateError } = await supabase
        .from('meetings')
        .update({
          status: 'generating',
          audio_url: storagePath,
          audio_duration: duration,
          ...(flatTranscript ? { transcript: flatTranscript } : {}),
          ...(segments.length > 0 ? { diarized_transcript: segments } : {}),
        })
        .eq('id', meeting.id)
        .eq('user_id', user.id)

      if (updateError) throw new Error(updateError.message)

      generationStarted = true
      setPhase('done')

      const notesRes = await fetch('/api/generate-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: meeting.id }),
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
            .eq('id', meeting.id)
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
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      mediaRecorderRef.current = null
      chunksRef.current = []
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        void audioContextRef.current.close()
      }
      audioContextRef.current = null
      setIsPaused(false)
    }
  }, [duration, meeting.id, readApiError, resetRecordingSurface, router, stopTranscription])

  const live = phase === 'recording' || phase === 'stopping'
  const transcriptForDrawer = savedTranscript || meeting.transcript
  const transcriptSegments = liveSegments.length > 0 ? liveSegments : savedSegments

  return (
    <>
      <div className="flex flex-col gap-8">
        <PageHeader title={meeting.title} date={formatDate(meeting.created_at)} />

        <div className="surface-utility flex flex-col gap-4 px-5 py-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3">
              <span className="relative flex size-2 shrink-0">
                <span
                  className={cn(
                    'absolute inline-flex h-full w-full rounded-full opacity-75',
                    !isPaused && phase === 'recording' ? 'animate-ping bg-accent' : 'bg-muted-foreground'
                  )}
                />
                <span
                  className={cn(
                    'relative inline-flex size-2 rounded-full',
                    !isPaused && phase === 'recording' ? 'bg-accent' : 'bg-muted-foreground/40'
                  )}
                />
              </span>
              <span className="text-sm font-medium text-foreground">
                {phase === 'stopping'
                  ? 'Saving your recording…'
                  : phase === 'done'
                    ? 'Preparing meeting metadata…'
                    : phase === 'recording'
                      ? (isPaused ? 'Paused' : 'Recording now')
                      : 'Ready to record'}
              </span>
            </div>

            {hasSystemAudio && (
              <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1">
                <Monitor className="size-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">System audio</span>
              </span>
            )}

            <span className="font-mono text-sm tabular-nums text-muted-foreground">
              {formatTime(duration)}
            </span>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {phase === 'setup' && (
                <>
                  <TooltipProvider>
                    <div className="flex items-center gap-3">
                      <Switch
                        id="system-audio"
                        checked={recordSystemAudio}
                        onCheckedChange={setRecordSystemAudio}
                      />
                      <Label htmlFor="system-audio" className="flex cursor-pointer items-center gap-1.5 text-sm text-foreground">
                        <Monitor className="size-3.5 text-muted-foreground" />
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
                          Capture audio from your computer, like Zoom or Google Meet. You&apos;ll be asked to share a tab or screen.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>

                  <Button onClick={handleStartRecording} className="gap-2">
                    <Mic className="size-4" />
                    Start recording
                  </Button>
                </>
              )}

              {phase !== 'setup' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={togglePause}
                    disabled={phase === 'stopping' || phase === 'done'}
                    className="h-8 gap-1.5 border-border text-muted-foreground hover:text-foreground"
                  >
                    {isPaused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
                    <span className="text-xs">{isPaused ? 'Resume' : 'Pause'}</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleStop}
                    disabled={phase === 'stopping' || phase === 'done'}
                    className="h-8 gap-1.5 bg-foreground text-background hover:bg-foreground/90"
                  >
                    {phase === 'stopping' || phase === 'done'
                      ? <Loader2 className="size-3.5 animate-spin" />
                      : <Square className="size-3" />}
                    <span className="text-xs">
                      {phase === 'stopping' || phase === 'done' ? 'Working…' : 'Stop'}
                    </span>
                  </Button>
                </>
              )}
            </div>
          </div>

          <p className="text-sm leading-6 text-muted-foreground">
            {phase === 'setup'
              ? 'Start recording when you are ready. Your note stays here while the transcript appears in the side transcript view.'
              : phase === 'done'
                ? 'The recording is saved. noter is filling in the title, summary, and action items in the background.'
                : isConnected
                  ? 'The transcript is streaming live into the transcript view.'
                  : 'Connecting your microphone and live transcript…'}
          </p>
        </div>

        <section className="surface-document px-6 py-7 md:px-10 md:py-10">
          <div className="mx-auto w-full max-w-4xl">
            <MeetingEditor
              key={`${meeting.id}:${meeting.updated_at}:recording`}
              meeting={meeting}
              editable
            />
          </div>
        </section>
      </div>

      <TranscriptDrawer
        transcript={transcriptForDrawer}
        liveSegments={transcriptSegments}
        live={live}
      />
    </>
  )
}
