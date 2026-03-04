'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
  GripHorizontal,
  Copy,
  FileText,
  Pin,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
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
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { SourceManager } from '@/components/source-manager'
import { clearChatMessages } from '@/lib/chat-storage'
import type { Meeting, ActionItem } from '@/lib/types'

const DEFAULT_PANEL_HEIGHT = 360

function ScrollablePanel({
  children,
  initialHeight = DEFAULT_PANEL_HEIGHT,
}: {
  children: React.ReactNode
  initialHeight?: number
}) {
  const [height, setHeight] = useState(initialHeight)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startH = useRef(0)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    isDragging.current = true
    startY.current = e.clientY
    startH.current = height

    const onMove = (ev: PointerEvent) => {
      if (!isDragging.current) return
      const delta = ev.clientY - startY.current
      setHeight(Math.max(120, startH.current + delta))
    }

    const onUp = () => {
      isDragging.current = false
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'row-resize'
  }, [height])

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Scrollable content area */}
      <div
        className="overflow-y-auto p-6"
        style={{ height }}
      >
        {children}
      </div>

      {/* Drag handle */}
      <div
        role="separator"
        aria-label="Drag to resize"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 80 : 40
          if (e.key === 'ArrowDown') { e.preventDefault(); setHeight(h => Math.max(120, h + step)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setHeight(h => Math.max(120, h - step)) }
        }}
        className="flex h-5 cursor-row-resize items-center justify-center border-t border-border transition-colors hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <GripHorizontal className="size-3 text-muted-foreground" />
        <span className="sr-only">Use Arrow Up and Arrow Down to resize this panel.</span>
      </div>
    </div>
  )
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

export function MeetingDetail({ meeting }: { meeting: Meeting }) {
  const [actionItems, setActionItems] = useState<ActionItem[]>(meeting.action_items || [])
  const [isPinned, setIsPinned] = useState(meeting.is_pinned)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const togglePin = async () => {
    const newPinned = !isPinned
    setIsPinned(newPinned) // optimistic
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/pin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: newPinned }),
      })
      if (!res.ok) throw new Error('Failed to update pin')
    } catch {
      setIsPinned(!newPinned) // revert
      toast.error('Failed to update pin status')
    }
  }

  const keyDecisions = useMemo(() => meeting.key_decisions ?? [], [meeting.key_decisions])
  const topics = useMemo(() => meeting.topics ?? [], [meeting.topics])
  const followUps = useMemo(() => meeting.follow_ups ?? [], [meeting.follow_ups])

  const handleCopyNotes = useCallback(() => {
    const parts: string[] = []
    if (meeting.title) parts.push(`# ${meeting.title}\n`)
    if (meeting.summary) parts.push(`${meeting.summary}\n`)
    if (meeting.detailed_notes) {
      parts.push(meeting.detailed_notes)
    } else {
      if (keyDecisions.length > 0) {
        parts.push(`## Key Decisions\n${keyDecisions.map((d) => `- ${d}`).join('\n')}`)
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
  }, [meeting, actionItems, keyDecisions, followUps])

  const toggleAction = async (index: number) => {
    const previous = [...actionItems]
    const updated = [...actionItems]
    updated[index] = { ...updated[index], done: !updated[index].done }
    setActionItems(updated)

    const supabase = createClient()
    const { error } = await supabase
      .from('meetings')
      .update({ action_items: updated })
      .eq('id', meeting.id)

    if (error) {
      setActionItems(previous)
      toast.error('Failed to update action item')
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/meetings/${meeting.id}`, {
        method: 'DELETE',
      })

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-3" />
            Back to notes
          </Link>
          <h1 className="text-xl font-semibold text-foreground text-balance">
            {meeting.title}
          </h1>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
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

        <div className="flex items-center gap-2">
          {/* Pin button */}
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

          {/* Delete button with Dialog confirmation */}
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
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs — shadcn accessible tabs */}
      <Tabs defaultValue="summary">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="summary">Notes</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
        </TabsList>

        {/* Copy button — repositioned above content for better flow */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleCopyNotes}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Copy notes to clipboard"
          >
            <Copy className="size-3.5" />
            Copy notes
          </button>
        </div>

        <TabsContent value="summary">
          <ScrollablePanel>
            <div className="flex flex-col gap-6">
              {/* Executive summary */}
              {meeting.summary && (
                <p className="text-sm leading-relaxed text-muted-foreground italic">
                  {meeting.summary}
                </p>
              )}

              {/* Topics as Badges */}
              {topics.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {topics.map((topic, i) => (
                    <Badge key={i} variant="secondary" className="rounded-full">
                      {topic}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Detailed notes (markdown) or fallback to key decisions */}
              {meeting.detailed_notes ? (
                <div className="prose prose-sm dark:prose-invert max-w-none text-foreground [&>h2]:text-base [&>h2]:font-semibold [&>h2]:mt-4 [&>h2]:mb-2 [&>ul]:mb-3 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:mb-3 [&>ol]:list-decimal [&>ol]:pl-5 [&>p]:mb-2 [&>p]:leading-relaxed">
                  <ReactMarkdown>{meeting.detailed_notes}</ReactMarkdown>
                </div>
              ) : (
                <>
                  {/* Fallback for old meetings without detailed_notes */}
                  {keyDecisions.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Key Decisions</h3>
                      <div className="flex flex-col gap-2">
                        {keyDecisions.map((decision, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span className="text-sm leading-relaxed text-foreground">{decision}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {!meeting.summary && keyDecisions.length === 0 && (
                    <p className="text-sm text-muted-foreground">No notes available.</p>
                  )}
                </>
              )}
            </div>
          </ScrollablePanel>
        </TabsContent>

        <TabsContent value="actions">
          <ScrollablePanel>
            <div className="flex flex-col gap-6">
              {/* Action Items */}
              <div className="flex flex-col gap-3">
                {actionItems.length > 0 ? (
                  actionItems.map((item, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => toggleAction(i)}
                      aria-pressed={item.done}
                      className="flex items-start gap-3 rounded-lg p-2 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {item.done ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />
                      ) : (
                        <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={cn(
                            'text-sm',
                            item.done ? 'text-muted-foreground line-through' : 'text-foreground'
                          )}
                        >
                          {item.task}
                        </span>
                        {item.owner && (
                          <span className="text-xs text-muted-foreground">
                            Assigned to {item.owner}
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No action items found.</p>
                )}
              </div>

              {/* Follow-ups subsection */}
              {followUps.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-border pt-4">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Follow-ups</h3>
                  <div className="flex flex-col gap-2">
                    {followUps.map((followUp, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                        <span className="text-sm leading-relaxed text-foreground">{followUp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollablePanel>
        </TabsContent>

        <TabsContent value="transcript">
          <ScrollablePanel initialHeight={200}>
            {meeting.transcript ? (
              <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
                {meeting.transcript}
              </p>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <FileText className="size-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">No transcript available</p>
                <p className="text-xs text-muted-foreground/70">The transcript will appear here once audio has been processed.</p>
              </div>
            )}
          </ScrollablePanel>
        </TabsContent>

        <TabsContent value="sources">
          <div className="rounded-xl border border-border bg-card p-6">
            <SourceManager meetingId={meeting.id} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
