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
import { Button } from '@/components/ui/button'
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
import { clearChatMessages } from '@/lib/chat-storage'
import { MeetingNoteSurface } from '@/components/meeting-note-surface'
import {
  buildAssistantTranscriptSegments,
  MeetingAssistantBridge,
} from '@/components/assistant-shell-context'
import type { Meeting, ActionItem } from '@/lib/types'

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
    const newPinned = !isPinned
    setIsPinned(newPinned)
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/pin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: newPinned }),
      })
      if (!res.ok) throw new Error('Failed to update pin')
    } catch {
      setIsPinned(!newPinned)
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
        parts.push(`## Key Decisions\n${decisions.map((d) => `- ${d}`).join('\n')}`)
      }
    }
    if (actionItems.length > 0) {
      parts.push(`## Action Items\n${actionItems.map((a) => `- [${a.done ? 'x' : ' '}] ${a.task}${a.owner ? ` (${a.owner})` : ''}`).join('\n')}`)
    }
    if (followUps.length > 0) {
      parts.push(`## Follow-ups\n${followUps.map((f) => `- ${f}`).join('\n')}`)
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

  return (
    <>
      <MeetingAssistantBridge context={assistantContext} />

      <div className="flex flex-col gap-8">
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
          </div>
        </div>

        {(meeting.status === 'generating' || meeting.status === 'error') && (
          <div className="surface-utility flex items-start gap-3 px-5 py-4">
            {meeting.status === 'generating' ? (
              <Loader2 className="mt-0.5 size-4 animate-spin text-accent" />
            ) : (
              <AlertCircle className="mt-0.5 size-4 text-destructive" />
            )}
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {meeting.status === 'generating'
                  ? 'Preparing meeting metadata in the background'
                  : 'Automatic note generation hit a problem'}
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                {meeting.status === 'generating'
                  ? 'Your editor stays available while noter updates the meeting title, summary, and action items.'
                  : meeting.error_message || 'Please try again.'}
              </p>
            </div>
          </div>
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
