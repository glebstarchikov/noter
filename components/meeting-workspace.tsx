'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  Mic,
  Monitor,
  MoreHorizontal,
  Pin,
  Trash2,
} from 'lucide-react'
import { PageHeader } from '@/components/page-shell'
import { RecordingStatusBar } from '@/components/recording-status-bar'
import { StatusPanel } from '@/components/status-panel'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { readApiError } from '@/lib/meeting-pipeline'
import { toast } from 'sonner'
import { deleteMeeting, toggleMeetingPin, copyMeetingNotes } from '@/lib/meeting-actions'
import { useDeepgramTranscription } from '@/hooks/use-deepgram-transcription'
import { MeetingNoteSurface } from '@/components/meeting-note-surface'
import {
  buildAssistantTranscriptSegments,
  MeetingAssistantBridge,
  type RecordingPhase,
} from '@/components/assistant-shell-context'
import type { DiarizedSegment, Meeting } from '@/lib/types'
import { formatTime, formatDate, formatDuration } from '@/lib/date-formatter'

export function MeetingWorkspace({ meeting }: { meeting: Meeting }) {
  const router = useRouter()
  const [phase, setPhase] = useState<RecordingPhase>(
    meeting.status === 'recording' ? 'setup' : 'done'
  )
  const [recordSystemAudio, setRecordSystemAudio] = useState(false)
  const [hasSystemAudio, setHasSystemAudio] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [duration, setDuration] = useState(meeting.audio_duration ?? 0)
  const [savedSegments, setSavedSegments] = useState<DiarizedSegment[]>(meeting.diarized_transcript ?? [])
  const [savedTranscript, setSavedTranscript] = useState(meeting.transcript ?? '')
  const [isPinned, setIsPinned] = useState(meeting.is_pinned)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
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
    setIsPinned(meeting.is_pinned)
  }, [meeting.is_pinned])

  useEffect(() => {
    if (meeting.status !== 'recording') {
      setPhase('done')
    }

    setSavedSegments(meeting.diarized_transcript ?? [])
    setSavedTranscript(meeting.transcript ?? '')
    if (meeting.audio_duration != null) {
      setDuration(meeting.audio_duration)
    }
  }, [meeting.audio_duration, meeting.diarized_transcript, meeting.status, meeting.transcript])

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

  // Toast when notes finish generating after recording
  const prevStatusRef = useRef(meeting.status)
  useEffect(() => {
    if (prevStatusRef.current === 'generating' && meeting.status === 'done') {
      toast.success('Your notes are ready.')
    }
    prevStatusRef.current = meeting.status
  }, [meeting.status])

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

  const togglePin = async () => {
    const prev = isPinned
    setIsPinned(!prev)
    try {
      await toggleMeetingPin(meeting.id, prev)
    } catch {
      setIsPinned(prev)
      toast.error("We couldn't update this note right now. Please try again.")
    }
  }

  const handleCopyNotes = useCallback(() => {
    copyMeetingNotes(meeting)
  }, [meeting])

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteMeeting(meeting.id)
      router.push('/dashboard')
    } catch {
      toast.error("We couldn't delete this note. Please try again.")
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

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

      timerRef.current = setInterval(() => setDuration((value) => value + 1), 1000)
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

      const storagePath = `${user.id}/${meeting.id}.webm`
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
      stopActiveStreams()
      mediaRecorderRef.current = null
      chunksRef.current = []
      closeAudioSession()
      setIsPaused(false)
    }
  }, [closeAudioSession, duration, meeting.id, resetRecordingSurface, router, stopActiveStreams, stopTranscription])

  const showRecordingControls = meeting.status === 'recording'
  const live = showRecordingControls && (phase === 'recording' || phase === 'stopping')
  const transcriptForDrawer = savedTranscript || meeting.transcript
  const assistantTranscriptSegments = useMemo(
    () =>
      liveSegments.length > 0
        ? liveSegments.map((segment) => ({
            speaker: segment.speaker,
            text: segment.text,
            isFinal: segment.isFinal,
          }))
        : buildAssistantTranscriptSegments({
            transcript: transcriptForDrawer,
            diarizedTranscript: savedSegments,
          }),
    [liveSegments, savedSegments, transcriptForDrawer]
  )
  const assistantContext = useMemo(
    () => ({
      sourceId: `meeting:${meeting.id}`,
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      transcriptAvailable:
        Boolean(transcriptForDrawer?.trim()) || assistantTranscriptSegments.length > 0,
      transcriptText: transcriptForDrawer ?? '',
      transcriptSegments: assistantTranscriptSegments,
      recordingPhase: phase,
      live,
      isPaused,
      durationSeconds: duration,
      recordSystemAudio,
      hasSystemAudio,
      analyserNode: analyserRef.current,
      onToggleRecordSystemAudio: setRecordSystemAudio,
      onStartRecording: handleStartRecording,
      onTogglePause: togglePause,
      onStop: handleStop,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- analyserReady triggers recalc when analyser ref changes
    [
      analyserReady,
      assistantTranscriptSegments,
      duration,
      handleStartRecording,
      handleStop,
      hasSystemAudio,
      isPaused,
      live,
      meeting.id,
      meeting.title,
      phase,
      recordSystemAudio,
      togglePause,
      transcriptForDrawer,
    ]
  )

  return (
    <>
      <MeetingAssistantBridge context={assistantContext} />

      <div className="flex flex-col gap-8">
        <PageHeader
          eyebrow={
            <Link
              href="/dashboard"
              className="flex w-fit items-center gap-1 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="size-3" />
              Back to notes
            </Link>
          }
          title={meeting.title}
          description={
            <span className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" />
                {formatDate(meeting.created_at)}
              </span>
              {meeting.audio_duration ? (
                <span className="font-mono text-xs tabular-nums text-muted-foreground/80">
                  {formatDuration(meeting.audio_duration)}
                </span>
              ) : null}
            </span>
          }
          actions={
            <>
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon-sm" className="shadow-none" aria-label="More actions">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">More actions</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onSelect={handleCopyNotes}>
                    <Copy className="size-4" />
                    Copy notes
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={togglePin}>
                    <Pin className={cn('size-4', isPinned && 'rotate-45')} />
                    {isPinned ? 'Unpin note' : 'Pin note'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="size-4" />
                    Delete note
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
        />

        {showRecordingControls && phase === 'setup' && (
          <StatusPanel
            title="Ready to record"
            description="Press Start to begin. The live transcript will appear as you speak."
            actions={
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  className="rounded-full gap-2"
                  onClick={handleStartRecording}
                >
                  <Mic className="size-4" />
                  Start recording
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={recordSystemAudio}
                        onCheckedChange={setRecordSystemAudio}
                      />
                      <Label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Monitor className="size-3.5" />
                        System audio
                      </Label>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Also capture audio playing on your device</TooltipContent>
                </Tooltip>
              </div>
            }
          />
        )}

        {showRecordingControls && phase === 'recording' && (
          <RecordingStatusBar
            isPaused={isPaused}
            isConnected={isConnected}
            hasSystemAudio={hasSystemAudio}
            durationLabel={formatTime(duration)}
            onTogglePause={togglePause}
            onStop={handleStop}
          />
        )}

        {showRecordingControls && phase === 'stopping' && (
          <StatusPanel
            icon={<Loader2 className="animate-spin text-accent" />}
            title="Saving your recording\u2026"
            description="Uploading audio and preparing your transcript."
          />
        )}

        {(phase === 'done' || !showRecordingControls) && (
          <StatusPanel
            tone={meeting.status === 'error' ? 'destructive' : 'default'}
            icon={
              meeting.status === 'generating' ? (
                <Loader2 className="animate-spin text-accent" />
              ) : meeting.status === 'error' ? (
                <AlertCircle className="text-destructive" />
              ) : (
                <CheckCircle2 className="text-accent" />
              )
            }
            title={
              meeting.status === 'generating'
                ? 'Building your notes'
                : meeting.status === 'error'
                  ? 'Automatic note generation hit a problem'
                  : 'Recording complete'
            }
            description={
              meeting.status === 'generating' ? (
                <span className="mt-2 flex flex-col gap-2">
                  <span className="flex items-center gap-3">
                    <CheckCircle2 className="size-4 shrink-0 text-accent" />
                    <span className="text-sm font-medium text-accent">Audio saved</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <CheckCircle2 className="size-4 shrink-0 text-accent" />
                    <span className="text-sm font-medium text-accent">Transcript analyzed</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <Loader2 className="size-4 shrink-0 animate-spin text-foreground" />
                    <span className="text-sm font-semibold text-foreground">Writing your notes\u2026</span>
                  </span>
                </span>
              ) : meeting.status === 'error'
                ? meeting.error_message || 'Please try again.'
                : 'Your note stays editable. Open the transcript only when you need more detail.'
            }
          />
        )}

        <MeetingNoteSurface
          meeting={meeting}
          transcript={transcriptForDrawer}
          isRecordingComplete={phase === 'done' || meeting.status !== 'recording'}
        />
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{meeting.title}&rdquo; and its transcript and generated notes. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
