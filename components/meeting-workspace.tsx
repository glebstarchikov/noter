'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Info,
  Loader2,
  Mic,
  Monitor,
  MoreHorizontal,
  Pause,
  Pin,
  Play,
  Square,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
import { clearChatMessages } from '@/lib/chat-storage'
import { toast } from 'sonner'
import { useDeepgramTranscription } from '@/hooks/use-deepgram-transcription'
import { MeetingNoteSurface } from '@/components/meeting-note-surface'
import { TranscriptDrawer } from '@/components/transcript-drawer'
import type { ActionItem, DiarizedSegment, Meeting } from '@/lib/types'

type RecordingPhase = 'setup' | 'recording' | 'stopping' | 'done'

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  const h = d.getHours()
  const m = d.getMinutes()
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${weekdays[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${hour12}:${m.toString().padStart(2, '0')} ${period}`
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}

function PageHeader({
  meeting,
  isPinned,
  onCopy,
  onTogglePin,
  onDelete,
}: {
  meeting: Meeting
  isPinned: boolean
  onCopy: () => void
  onTogglePin: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-4xl space-y-3">
        <Link
          href="/dashboard"
          className="flex w-fit items-center gap-1 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-3" />
          Back to notes
        </Link>
        <div className="space-y-2">
          <h1 className="text-[30px] font-semibold tracking-tight text-foreground text-balance">
            {meeting.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5" />
              {formatDate(meeting.created_at)}
            </span>
            {meeting.audio_duration && (
              <span className="font-mono text-xs tabular-nums text-muted-foreground/80">
                {formatDuration(meeting.audio_duration)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 self-start">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon-sm" className="shadow-none">
              <MoreHorizontal className="size-4" />
              <span className="sr-only">Open meeting actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={onCopy}>
              <Copy className="size-4" />
              Copy notes
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onTogglePin}>
              <Pin className={cn('size-4', isPinned && 'rotate-45')} />
              {isPinned ? 'Unpin note' : 'Pin note'}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={onDelete}
            >
              <Trash2 className="size-4" />
              Delete note
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

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

  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  const { startTranscription, stopTranscription, isConnected, liveSegments } =
    useDeepgramTranscription()

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

  const togglePin = async () => {
    const nextPinned = !isPinned
    setIsPinned(nextPinned)
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/pin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: nextPinned }),
      })
      if (!res.ok) throw new Error('Failed to update pin')
    } catch {
      setIsPinned(!nextPinned)
      toast.error('Failed to update pin status')
    }
  }

  const handleCopyNotes = useCallback(() => {
    const actionItems: ActionItem[] = meeting.action_items || []
    const followUps = meeting.follow_ups ?? []
    const parts: string[] = []
    if (meeting.title) parts.push(`# ${meeting.title}\n`)
    if (meeting.summary) parts.push(`${meeting.summary}\n`)
    if (meeting.detailed_notes) {
      parts.push(meeting.detailed_notes)
    } else {
      const decisions = meeting.key_decisions ?? []
      if (decisions.length > 0) {
        parts.push(`## Key Decisions\n${decisions.map((decision) => `- ${decision}`).join('\n')}`)
      }
    }
    if (actionItems.length > 0) {
      parts.push(`## Action Items\n${actionItems.map((item) => `- [${item.done ? 'x' : ' '}] ${item.task}${item.owner ? ` (${item.owner})` : ''}`).join('\n')}`)
    }
    if (followUps.length > 0) {
      parts.push(`## Follow-ups\n${followUps.map((followUp) => `- ${followUp}`).join('\n')}`)
    }

    navigator.clipboard.writeText(parts.join('\n\n')).then(() => {
      toast.success('Notes copied to clipboard')
    }).catch(() => {
      toast.error('Failed to copy notes')
    })
  }, [meeting])

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/meetings/${meeting.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || 'Failed to delete meeting')
      }
      clearChatMessages(meeting.id)
      router.push('/dashboard')
    } catch {
      toast.error('Failed to delete meeting')
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

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
  }, [duration, meeting.id, resetRecordingSurface, router, stopTranscription])

  const showRecordingControls = meeting.status === 'recording'
  const live = showRecordingControls && (phase === 'recording' || phase === 'stopping')
  const transcriptForDrawer = savedTranscript || meeting.transcript
  const transcriptSegments = liveSegments.length > 0 ? liveSegments : savedSegments

  return (
    <>
      <div className="flex flex-col gap-8">
        <PageHeader
          meeting={meeting}
          isPinned={isPinned}
          onCopy={handleCopyNotes}
          onTogglePin={togglePin}
          onDelete={() => setShowDeleteDialog(true)}
        />

        {showRecordingControls ? (
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
                ? 'Start recording when you are ready. Your note stays here while the transcript lives in the side transcript view.'
                : phase === 'done'
                  ? 'The recording is saved. noter is filling in the title, summary, and action items in the background.'
                  : isConnected
                    ? 'The transcript is streaming live into the transcript view.'
                    : 'Connecting your microphone and live transcript…'}
            </p>
          </div>
        ) : (
          <div className="surface-utility flex items-start gap-3 px-5 py-4">
            {meeting.status === 'generating' ? (
              <Loader2 className="mt-0.5 size-4 animate-spin text-accent" />
            ) : meeting.status === 'error' ? (
              <AlertCircle className="mt-0.5 size-4 text-destructive" />
            ) : (
              <CheckCircle2 className="mt-0.5 size-4 text-accent" />
            )}
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {meeting.status === 'generating'
                  ? 'Preparing meeting metadata in the background'
                  : meeting.status === 'error'
                    ? 'Automatic note generation hit a problem'
                    : 'Recording complete'}
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                {meeting.status === 'generating'
                  ? 'Your editor stays available while noter updates the meeting title, summary, and action items.'
                  : meeting.status === 'error'
                    ? meeting.error_message || 'Please try again.'
                    : 'Your note stays editable. Open the transcript only when you need more detail.'}
              </p>
            </div>
          </div>
        )}

        <MeetingNoteSurface
          meeting={meeting}
          transcript={transcriptForDrawer}
          isRecordingComplete={phase === 'done' || meeting.status !== 'recording'}
        />
      </div>

      <TranscriptDrawer
        transcript={transcriptForDrawer}
        liveSegments={transcriptSegments}
        live={live}
        alwaysVisible
        emptyMessage="Transcript will appear here once recording starts."
      />

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
