'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
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
  Upload,
} from 'lucide-react'
import { PageHeader } from '@/components/page-shell'
import { RecordingErrorBoundary } from '@/components/recording-error-boundary'
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
import { toast } from 'sonner'
import { deleteMeeting, toggleMeetingPin, copyMeetingNotes } from '@/lib/meetings/meeting-actions'
import { useRecording } from '@/hooks/use-recording'
import { MeetingNoteSurface } from '@/components/meeting-note-surface'
import {
  buildAssistantTranscriptSegments,
  MeetingAssistantBridge,
} from '@/components/assistant-shell-context'
import type { Meeting } from '@/lib/types'
import { formatTime, formatDate, formatDuration } from '@/lib/date-formatter'

export function UnifiedMeetingPage({ meeting }: { meeting: Meeting }) {
  const router = useRouter()

  // ── Recording hook ────────────────────────────────────────────────
  const {
    phase,
    recordSystemAudio,
    hasSystemAudio,
    isPaused,
    duration,
    savedSegments,
    savedTranscript,
    analyserNode,
    isConnected,
    liveSegments,
    setRecordSystemAudio,
    handleStartRecording,
    togglePause,
    handleStop,
    resetRecordingSurface,
  } = useRecording({
    meetingId: meeting.id,
    meetingStatus: meeting.status,
    initialDiarizedTranscript: meeting.diarized_transcript,
    initialTranscript: meeting.transcript,
    initialAudioDuration: meeting.audio_duration,
  })

  // ── Local state ───────────────────────────────────────────────────
  const [isPinned, setIsPinned] = useState(meeting.is_pinned)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  useEffect(() => {
    setIsPinned(meeting.is_pinned)
  }, [meeting.is_pinned])

  // Toast when notes finish generating after recording
  const prevStatusRef = useRef(meeting.status)
  useEffect(() => {
    if (prevStatusRef.current === 'generating' && meeting.status === 'done') {
      toast.success('Your notes are ready.')
    }
    prevStatusRef.current = meeting.status
  }, [meeting.status])

  // ── Derived values ────────────────────────────────────────────────
  const showRecordingControls = meeting.status === 'recording'
  const live = showRecordingControls && (phase === 'recording' || phase === 'stopping')
  const transcriptForDrawer = savedTranscript || meeting.transcript
  const hasTranscript = Boolean(transcriptForDrawer?.trim()) || savedSegments.length > 0

  // ── Assistant bridge context ──────────────────────────────────────
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
      analyserNode,
      onToggleRecordSystemAudio: setRecordSystemAudio,
      onStartRecording: handleStartRecording,
      onTogglePause: togglePause,
      onStop: handleStop,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- analyserNode triggers recalc when analyser ref changes
    [
      analyserNode,
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

  // ── Actions ───────────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────
  return (
    <>
      <MeetingAssistantBridge context={assistantContext} />

      <div className="flex flex-col gap-8">
        {/* Zone 1 — Page header */}
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
                      <Button variant="ghost" size="icon-sm" className="shadow-none" aria-label="More actions">
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

        {/* Zone 2 — Recording controls */}
        <RecordingErrorBoundary onReset={resetRecordingSurface}>
          {/* Setup: ready to record */}
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

          {/* Active recording */}
          {showRecordingControls && phase === 'recording' && (
            <div aria-live="polite">
              <RecordingStatusBar
                isPaused={isPaused}
                isConnected={isConnected}
                hasSystemAudio={hasSystemAudio}
                durationLabel={formatTime(duration)}
                onTogglePause={togglePause}
                onStop={handleStop}
              />
            </div>
          )}

          {/* Stopping: saving recording */}
          {showRecordingControls && phase === 'stopping' && (
            <StatusPanel
              icon={<Loader2 className="animate-spin text-accent" />}
              title="Saving your recording…"
              description="Uploading audio and preparing your transcript."
            />
          )}
        </RecordingErrorBoundary>

        {/* Post-recording: quiet completion panel or record/upload actions */}
        {(phase === 'done' || !showRecordingControls) && hasTranscript && (
          <StatusPanel
            icon={<CheckCircle2 className="text-accent" />}
            title="Recording complete"
            description="Your note stays editable. Open the transcript only when you need more detail."
          />
        )}

        {(phase === 'done' || !showRecordingControls) && !hasTranscript && (
          <StatusPanel
            title="No recording yet"
            description="Record a meeting or upload an audio file to get started."
            actions={
              <div className="flex flex-wrap items-center gap-3">
                {meeting.status === 'recording' ? null : (
                  <>
                    <Button
                      size="lg"
                      className="rounded-full gap-2"
                      onClick={() => {
                        // Navigate to a fresh recording session for this meeting
                        // by reloading with recording status
                        toast.info('Start a new note with recording from the dashboard.')
                      }}
                    >
                      <Mic className="size-4" />
                      Record
                    </Button>
                    <Button
                      variant="ghost"
                      size="lg"
                      className="rounded-full gap-2"
                      onClick={() => toast('Upload audio coming soon')}
                    >
                      <Upload className="size-4" />
                      Upload audio
                    </Button>
                  </>
                )}
              </div>
            }
          />
        )}

        {/* Zone 3 — Editor (always visible) */}
        <MeetingNoteSurface
          meeting={meeting}
          transcript={transcriptForDrawer}
          isRecordingComplete={phase === 'done' || meeting.status !== 'recording'}
        />
      </div>

      {/* Delete confirmation dialog */}
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
