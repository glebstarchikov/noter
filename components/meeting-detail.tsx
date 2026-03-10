'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Trash2,
  Clock,
  Copy,
  Pin,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { SourceManager } from '@/components/source-manager'
import { MeetingEditor } from '@/components/meeting-editor'
import { clearChatMessages } from '@/lib/chat-storage'
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

export function MeetingDetail({ meeting }: { meeting: Meeting }) {
  const [actionItems] = useState<ActionItem[]>(meeting.action_items || [])
  const [isPinned, setIsPinned] = useState(meeting.is_pinned)
  const [isDeleting, setIsDeleting] = useState(false)
  const [transcriptExpanded, setTranscriptExpanded] = useState(false)
  const router = useRouter()

  const topics = useMemo(() => meeting.topics ?? [], [meeting.topics])
  const followUps = useMemo(() => meeting.follow_ups ?? [], [meeting.follow_ups])

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
  }, [meeting, actionItems, followUps])

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
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-3" />
            Back to notes
          </Link>
          <h1 className="text-[26px] font-semibold tracking-tight text-foreground text-balance">
            {meeting.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {formatDate(meeting.created_at)}
            </span>
            {meeting.audio_duration && (
              <span>
                {Math.floor(meeting.audio_duration / 60)}m {meeting.audio_duration % 60}s
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyNotes}
            className="gap-1.5 text-xs text-muted-foreground"
            aria-label="Copy notes to clipboard"
          >
            <Copy className="size-3.5" />
            Copy
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={togglePin}
            className={cn(
              'border-border',
              isPinned
                ? 'text-primary hover:text-primary/80'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Pin className={cn('size-4', isPinned && 'rotate-45')} />
            <span className="sr-only">{isPinned ? 'Unpin meeting' : 'Pin meeting'}</span>
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                disabled={isDeleting}
                className="border-border text-muted-foreground hover:border-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" />
                <span className="sr-only">Delete meeting</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete this meeting?</DialogTitle>
                <DialogDescription>
                  This will permanently delete &ldquo;{meeting.title}&rdquo; and all its data including sources, transcript, and action items. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Topics */}
      {topics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {topics.map((topic, i) => (
            <Badge key={i} variant="secondary" className="rounded-full">
              {topic}
            </Badge>
          ))}
        </div>
      )}

      {/* Tabs — underline style */}
      <Tabs defaultValue="notes">
        <TabsList className="w-full justify-start border-b border-border bg-transparent p-0 rounded-none h-auto gap-0">
          <TabsTrigger
            value="notes"
            className="rounded-none border-b-2 border-transparent pb-2 pt-0 px-0 mr-6 data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm font-medium text-muted-foreground data-[state=active]:text-foreground"
          >
            Notes
          </TabsTrigger>
          <TabsTrigger
            value="sources"
            className="rounded-none border-b-2 border-transparent pb-2 pt-0 px-0 data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm font-medium text-muted-foreground data-[state=active]:text-foreground"
          >
            Sources
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="mt-6">
          {/* Tiptap editor */}
          <MeetingEditor meeting={meeting} editable />

          {/* Transcript expand */}
          {meeting.transcript && (
            <div className="mt-8 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setTranscriptExpanded((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                <ChevronDown
                  className={cn('size-3.5 transition-transform', transcriptExpanded && 'rotate-180')}
                />
                Full transcript
              </button>
              {transcriptExpanded && (
                <p className="mt-3 whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground max-w-[680px]">
                  {meeting.transcript}
                </p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sources" className="mt-6">
          <SourceManager meetingId={meeting.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
