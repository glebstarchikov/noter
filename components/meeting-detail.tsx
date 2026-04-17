'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Clock,
  Copy,
  Pin,
  MoreHorizontal,
  Trash2,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/page-shell'
import { StatusPanel } from '@/components/status-panel'
import { Button } from '@/components/ui/button'
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
import { MeetingNoteSurface } from '@/components/meeting-note-surface'
import {
  buildAssistantTranscriptSegments,
  MeetingAssistantBridge,
} from '@/components/assistant-shell-context'
import type { Meeting } from '@/lib/types'
import { formatDate, formatDuration } from '@/lib/date-formatter'

export function MeetingDetail({ meeting }: { meeting: Meeting }) {
  const [isPinned, setIsPinned] = useState(meeting.is_pinned)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const router = useRouter()
  const transcriptSegments = useMemo(
    () =>
      buildAssistantTranscriptSegments({
        transcript: meeting.transcript,
        diarizedTranscript: meeting.diarized_transcript,
      }),
    [meeting.diarized_transcript, meeting.transcript]
  )
  const assistantContext = useMemo(
    () => ({
      sourceId: `meeting:${meeting.id}`,
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      transcriptAvailable: Boolean(meeting.transcript?.trim()) || transcriptSegments.length > 0,
      transcriptText: meeting.transcript ?? '',
      transcriptSegments,
      recordingPhase: 'done' as const,
      live: false,
      isPaused: false,
      durationSeconds: meeting.audio_duration ?? 0,
    }),
    [meeting.audio_duration, meeting.id, meeting.title, meeting.transcript, transcriptSegments]
  )

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

  return (
    <>
      <MeetingAssistantBridge context={assistantContext} />

      <div className="flex flex-col gap-5">
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

        {(meeting.status === 'generating' || meeting.status === 'error') && (
          <StatusPanel
            tone={meeting.status === 'error' ? 'destructive' : 'default'}
            icon={
              meeting.status === 'generating' ? (
                <Loader2 className="animate-spin text-accent" />
              ) : (
                <AlertCircle className="text-destructive" />
              )
            }
            title={
              meeting.status === 'generating'
                ? 'Preparing meeting metadata in the background'
                : 'Automatic note generation hit a problem'
            }
            description={
              meeting.status === 'generating'
                ? 'Your editor stays available while noter updates the meeting title, summary, and action items.'
                : meeting.error_message || 'Please try again.'
            }
          />
        )}

        <MeetingNoteSurface meeting={meeting} />
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
