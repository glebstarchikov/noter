'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, X, SlidersHorizontal, AudioLines, Pin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { toggleMeetingPin } from '@/lib/meetings/meeting-actions'
import type { Meeting, MeetingStatus } from '@/lib/types'

type StatusMeta = {
  label: string
  tone: 'quiet' | 'ready' | 'active' | 'error'
}

function statusMeta(status: MeetingStatus): StatusMeta {
  switch (status) {
    case 'done':
      return { label: 'Ready', tone: 'ready' }
    case 'error':
      return { label: 'Needs attention', tone: 'error' }
    case 'recording':
      return { label: 'Recording', tone: 'active' }
    case 'uploading':
    case 'transcribing':
    case 'generating':
      return { label: 'In progress', tone: 'active' }
    default:
      return { label: 'Saved', tone: 'quiet' }
  }
}

function StatusDot({ status }: { status: MeetingStatus }) {
  const meta = statusMeta(status)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs',
        meta.tone === 'ready' && 'text-muted-foreground',
        meta.tone === 'quiet' && 'text-muted-foreground',
        meta.tone === 'active' && 'text-foreground/80',
        meta.tone === 'error' && 'text-destructive'
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          meta.tone === 'ready' && 'bg-accent/80',
          meta.tone === 'quiet' && 'bg-muted-foreground/35',
          meta.tone === 'active' && 'bg-foreground/55',
          meta.tone === 'error' && 'bg-destructive'
        )}
      />
      {meta.label}
    </span>
  )
}

import { formatRelativeDate } from '@/lib/date-formatter'

const STATUS_OPTIONS: { value: MeetingStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All notes' },
  { value: 'done', label: 'Ready' },
  { value: 'recording', label: 'Recording' },
  { value: 'transcribing', label: 'In progress' },
  { value: 'error', label: 'Needs attention' },
]

type SortOrder = 'newest' | 'oldest' | 'title-asc' | 'title-desc'

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title-asc', label: 'Title A to Z' },
  { value: 'title-desc', label: 'Title Z to A' },
]

function matchesStatusFilter(status: MeetingStatus, filter: MeetingStatus | 'all') {
  if (filter === 'all') return true
  if (filter === 'transcribing') {
    return status === 'uploading' || status === 'transcribing' || status === 'generating'
  }

  return status === filter
}

export function MeetingsList({ meetings: initialMeetings }: { meetings: Meeting[] }) {
  const [meetings, setMeetings] = useState(initialMeetings)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<MeetingStatus | 'all'>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const router = useRouter()
  const [, startTransition] = useTransition()

  const togglePin = async (meetingId: string, currentPinned: boolean) => {
    setMeetings((prev) =>
      prev.map((m) => (m.id === meetingId ? { ...m, is_pinned: !currentPinned } : m))
    )

    try {
      await toggleMeetingPin(meetingId, currentPinned)
      startTransition(() => router.refresh())
    } catch {
      setMeetings((prev) =>
        prev.map((m) => (m.id === meetingId ? { ...m, is_pinned: currentPinned } : m))
      )
      toast.error("Couldn't update this note right now. Please try again.")
    }
  }

  const filteredMeetings = useMemo(() => {
    let result = meetings

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((m) => {
        const titleMatch = m.title?.toLowerCase().includes(q)
        const summaryMatch = m.summary?.toLowerCase().includes(q)
        const topicMatch = m.topics?.some((t) => t.toLowerCase().includes(q))
        return titleMatch || summaryMatch || topicMatch
      })
    }

    result = result.filter((m) => matchesStatusFilter(m.status, statusFilter))

    return [...result].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1

      switch (sortOrder) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'title-asc':
          return (a.title || '').localeCompare(b.title || '')
        case 'title-desc':
          return (b.title || '').localeCompare(a.title || '')
        default:
          return 0
      }
    })
  }, [meetings, searchQuery, sortOrder, statusFilter])

  const hasActiveControls = searchQuery.trim() !== '' || statusFilter !== 'all' || sortOrder !== 'newest'

  if (meetings.length === 0) {
    return (
      <Empty className="surface-empty">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AudioLines />
          </EmptyMedia>
          <EmptyTitle>Capture your first meeting</EmptyTitle>
          <EmptyDescription>
            Record live or upload audio and noter will turn it into clear, structured notes.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/dashboard/new">Start a meeting</Link>
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            role="searchbox"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes"
            className="h-11 rounded-2xl border-border/70 bg-card pl-10 pr-10 text-sm shadow-none"
          />
          {searchQuery && (
            <Button
              type="button"
              variant="ghost-icon"
              size="icon-xs"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-11 rounded-2xl border-border/70 bg-card px-4 text-sm text-muted-foreground shadow-none"
            >
              <SlidersHorizontal className="size-4" />
              Sort & filter
              {hasActiveControls && (
                <Badge variant="secondary" className="rounded-full">Active</Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as MeetingStatus | 'all')}
            >
              {STATUS_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Sort</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={sortOrder}
              onValueChange={(value) => setSortOrder(value as SortOrder)}
            >
              {SORT_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {filteredMeetings.length === 0 ? (
        <Empty className="surface-empty">
          <EmptyHeader>
            <EmptyTitle>No notes match this view</EmptyTitle>
            <EmptyDescription>
              Try a different search or clear the filters to see all of your meetings again.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="ghost"
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('all')
                setSortOrder('newest')
              }}
            >
              Clear filters
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="surface-document divide-y divide-border/60">
          {filteredMeetings.map((meeting) => (
            <div
              key={meeting.id}
              className="group flex items-center gap-3 px-4 py-4 transition-colors hover:bg-secondary/35"
            >
              <Link
                href={`/dashboard/${meeting.id}`}
                className="flex min-w-0 flex-1 items-start rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-foreground">
                    {meeting.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span>{formatRelativeDate(meeting.created_at)}</span>
                    <StatusDot status={meeting.status} />
                  </div>
                </div>
              </Link>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost-icon"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      togglePin(meeting.id, meeting.is_pinned)
                    }}
                    aria-label={meeting.is_pinned ? 'Unpin note' : 'Pin note'}
                    className={cn(
                      'rounded-full text-muted-foreground shadow-none',
                      meeting.is_pinned
                        ? 'text-foreground'
                        : 'hover:text-foreground'
                    )}
                  >
                    <Pin className={cn('size-3.5', meeting.is_pinned && 'fill-current')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{meeting.is_pinned ? 'Unpin note' : 'Pin note'}</TooltipContent>
              </Tooltip>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
