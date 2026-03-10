'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Square, Pause, Play, Mic, Monitor, Info, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import type { Meeting } from '@/lib/types'

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
        className="flex items-center gap-1 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-fit"
      >
        <ArrowLeft className="size-3" />
        Back to notes
      </Link>
      <h1 className="text-[26px] font-semibold tracking-tight text-foreground">{title}</h1>
      {date && <span className="text-xs text-muted-foreground tabular-nums">{date}</span>}
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
  const [userNotes, setUserNotes] = useState('')

  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const transcriptEndRef = useRef<HTMLDivElement | null>(null)

  const { startTranscription, stopTranscription, isConnected, liveSegments } =
    useDeepgramTranscription()

  // Auto-scroll transcript to bottom as words come in
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [liveSegments])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        void audioContextRef.current.close()
      }
    }
  }, [])

  const navigateToMeeting = useCallback(() => {
    const href = `/dashboard/${meeting.id}`
    router.push(href)
    router.refresh()
  }, [meeting.id, router])

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
            systemStream.getTracks().forEach((t) => t.stop())
            micStream.getTracks().forEach((t) => t.stop())
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
        } catch (err) {
          micStream.getTracks().forEach((t) => t.stop())
          throw err
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
      recorder.addEventListener('dataavailable', (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      })
      recorder.start(1000)

      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
      setPhase('recording')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not access audio')
    }
  }

  const togglePause = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder) return
    if (isPaused) {
      recorder.resume()
      audioContextRef.current?.resume()
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
    } else {
      recorder.pause()
      audioContextRef.current?.suspend()
      if (timerRef.current) clearInterval(timerRef.current)
    }
    setIsPaused((v) => !v)
  }, [isPaused])

  const handleStop = useCallback(async () => {
    setPhase('stopping')
    if (timerRef.current) clearInterval(timerRef.current)
    const supabase = createClient()
    let userId: string | null = null
    let generationStarted = false

    try {
      // Stop blob recorder
      const recorder = mediaRecorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        await new Promise<void>((resolve) => {
          recorder.addEventListener('stop', () => resolve(), { once: true })
          recorder.stop()
        })
      }

      // Stop Deepgram and collect final segments
      const segments = await stopTranscription()
      const flatTranscript = segments.map((s) => `${s.speaker}: ${s.text}`).join('\n')
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })

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
          ...(userNotes.trim()
            ? {
                document_content: {
                  type: 'doc',
                  content: [{
                    type: 'paragraph',
                    content: [{ type: 'text', text: userNotes.trim() }],
                  }],
                },
              }
            : {}),
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

      navigateToMeeting()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save recording'

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
          // Best effort only — user should still land on the meeting error state.
        }

        toast.error(message)
        navigateToMeeting()
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
  }, [duration, meeting.id, navigateToMeeting, resetRecordingSurface, stopTranscription, userNotes])

  // ─── Done phase ───────────────────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title={meeting.title} />
        <div className="flex flex-col gap-4 py-8">
          <div className="flex items-center gap-3">
            <Loader2 className="size-5 animate-spin text-accent" />
            <span className="text-base font-semibold text-foreground">Generating your notes…</span>
          </div>
          <p className="text-sm text-muted-foreground ml-8">
            This usually takes 20–30 seconds. Hang tight.
          </p>
        </div>
      </div>
    )
  }

  // ─── Setup phase ─────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title={meeting.title} date={formatDate(meeting.created_at)} />

        <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-8 max-w-md">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-accent/10">
              <Mic className="size-4 text-accent" />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold text-foreground">Ready to record</p>
              <p className="text-xs text-muted-foreground">
                Microphone captures and transcribes in real time.
              </p>
            </div>
          </div>

          <TooltipProvider>
            <div className="flex items-center gap-3">
              <Switch
                id="system-audio"
                checked={recordSystemAudio}
                onCheckedChange={setRecordSystemAudio}
              />
              <Label htmlFor="system-audio" className="flex items-center gap-1.5 cursor-pointer text-sm text-foreground">
                <Monitor className="size-3.5 text-muted-foreground" />
                Include system audio
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost-icon" size="icon-xs" className="rounded-full" aria-label="What is system audio?">
                    <Info className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px] text-xs">
                  Captures audio from your computer (e.g., Zoom, Google Meet). You&apos;ll be asked to share a tab or screen.
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>

          <Button onClick={handleStartRecording} className="self-start gap-2">
            <Mic className="size-4" />
            Start recording
          </Button>
        </div>
      </div>
    )
  }

  // ─── Recording / stopping phase ───────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={meeting.title} />

      {/* Recording bar */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <span className="relative flex size-2 shrink-0">
          <span className={cn(
            'absolute inline-flex h-full w-full rounded-full opacity-75',
            !isPaused && phase === 'recording' ? 'animate-ping bg-accent' : 'bg-muted-foreground'
          )} />
          <span className={cn(
            'relative inline-flex size-2 rounded-full',
            !isPaused && phase === 'recording' ? 'bg-accent' : 'bg-muted-foreground/40'
          )} />
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {phase === 'stopping' ? 'Saving…' : isPaused ? 'Paused' : 'Recording'}
        </span>
        {hasSystemAudio && (
          <span className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5">
            <Monitor className="size-2.5 text-primary" />
            <span className="text-[10px] font-medium text-primary">System audio</span>
          </span>
        )}
        <span className="font-mono text-sm tabular-nums text-foreground ml-1">{formatTime(duration)}</span>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={togglePause}
          disabled={phase === 'stopping'}
          className="h-8 gap-1.5 border-border text-muted-foreground hover:text-foreground"
        >
          {isPaused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
          <span className="text-xs">{isPaused ? 'Resume' : 'Pause'}</span>
        </Button>
        <Button
          size="sm"
          onClick={handleStop}
          disabled={phase === 'stopping'}
          className="h-8 gap-1.5 bg-foreground text-background hover:bg-foreground/90"
        >
          <Square className="size-3" />
          <span className="text-xs">{phase === 'stopping' ? 'Saving…' : 'Stop'}</span>
        </Button>
      </div>

      {/* Main area: two-column on large screens */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Live transcript */}
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Live transcript
          </p>
          <div className="min-h-[320px] overflow-y-auto rounded-xl border border-border bg-card p-5 lg:min-h-[calc(100vh-220px)]">
            {liveSegments.length === 0 ? (
              <div className="flex items-center gap-2 py-1">
                {isConnected ? (
                  <>
                    <span className="relative flex size-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60" />
                      <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
                    </span>
                    <span className="text-[11px] text-muted-foreground">Listening…</span>
                  </>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Connecting…</span>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {liveSegments.map((seg, i) => (
                  <p
                    key={i}
                    className={cn(
                      'font-mono text-xs leading-relaxed',
                      seg.isFinal ? 'text-foreground' : 'text-muted-foreground/60'
                    )}
                  >
                    <span className="font-semibold">{seg.speaker}:</span>{' '}
                    {seg.text}
                  </p>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* User notes */}
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Your notes
          </p>
          <Textarea
            value={userNotes}
            onChange={(e) => setUserNotes(e.target.value)}
            placeholder="Type your own notes here…"
            className="min-h-[320px] resize-none rounded-xl text-sm lg:min-h-[calc(100vh-220px)]"
          />
        </div>
      </div>
    </div>
  )
}
