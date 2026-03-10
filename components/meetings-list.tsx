'use client'

import { useState, useMemo, useId, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, X, SlidersHorizontal, ArrowUpDown, AudioLines, Pin } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Meeting, MeetingStatus } from '@/lib/types'

type StatusMeta = { label: string; dot: 'active' | 'done' | 'error' | 'idle' }

function statusMeta(status: string): StatusMeta {
  const map: Record<string, StatusMeta> = {
    recording:   { label: 'Recording',   dot: 'active' },
    uploading:   { label: 'Uploading',   dot: 'active' },
    transcribing:{ label: 'Transcribing',dot: 'active' },
    generating:  { label: 'Generating', dot: 'active' },
    done:        { label: 'Complete',    dot: 'done'   },
    error:       { label: 'Error',       dot: 'error'  },
  }
  return map[status] ?? { label: status, dot: 'idle' }
}

function StatusDot({ status }: { status: string }) {
  const meta = statusMeta(status)
  if (meta.dot === 'active') {
    return (
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
        <span className="relative flex size-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60" />
          <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
        </span>
        {meta.label}
      </span>
    )
  }
  if (meta.dot === 'done') {
    return (
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        {meta.label}
      </span>
    )
  }
  if (meta.dot === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-[11px] text-destructive tabular-nums">
        <span className="size-1.5 rounded-full bg-destructive" />
        {meta.label}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
      <span className="size-1.5 rounded-full bg-muted-foreground/40" />
      {meta.label}
    </span>
  )
}

function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)
  const h = d.getHours()
  const m = d.getMinutes()
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  const time = `${hour12}:${m.toString().padStart(2, '0')} ${period}`
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  if (d >= todayStart) return `Today at ${time}`
  if (d >= yesterdayStart) return `Yesterday`

  const weekAgo = new Date(todayStart.getTime() - 6 * 86400000)
  if (d >= weekAgo) return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`

  const thisYear = now.getFullYear()
  if (d.getFullYear() === thisYear) return `${months[d.getMonth()]} ${d.getDate()}`

  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

const STATUS_OPTIONS: { value: MeetingStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'done', label: 'Complete' },
  { value: 'recording', label: 'Recording' },
  { value: 'transcribing', label: 'Transcribing' },
  { value: 'generating', label: 'Generating' },
  { value: 'error', label: 'Error' },
]

type SortOrder = 'newest' | 'oldest' | 'title-asc' | 'title-desc'

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title-asc', label: 'Title A → Z' },
  { value: 'title-desc', label: 'Title Z → A' },
]

export function MeetingsList({ meetings: initialMeetings }: { meetings: Meeting[] }) {
  const [meetings, setMeetings] = useState(initialMeetings)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<MeetingStatus | 'all'>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [showFilters, setShowFilters] = useState(false)
  const filtersPanelId = useId()
  const router = useRouter()
  const [, startTransition] = useTransition()

  const togglePin = async (meetingId: string, currentPinned: boolean) => {
    const newPinned = !currentPinned
    // Optimistic update
    setMeetings((prev) =>
      prev.map((m) => (m.id === meetingId ? { ...m, is_pinned: newPinned } : m))
    )
    try {
      const res = await fetch(`/api/meetings/${meetingId}/pin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: newPinned }),
      })
      if (!res.ok) throw new Error('Failed to update pin')
      startTransition(() => router.refresh())
    } catch {
      // Revert on error
      setMeetings((prev) =>
        prev.map((m) => (m.id === meetingId ? { ...m, is_pinned: currentPinned } : m))
      )
      toast.error('Failed to update pin')
    }
  }

  const filteredMeetings = useMemo(() => {
    let result = meetings

    // Text search — match against title, summary, and topics
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((m) => {
        const titleMatch = m.title?.toLowerCase().includes(q)
        const summaryMatch = m.summary?.toLowerCase().includes(q)
        const topicMatch = m.topics?.some((t) => t.toLowerCase().includes(q))
        return titleMatch || summaryMatch || topicMatch
      })
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((m) => m.status === statusFilter)
    }

    // Sort — pinned notes always come first, then apply user sort within each group
    result = [...result].sort((a, b) => {
      // Pinned first
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

    return result
  }, [meetings, searchQuery, statusFilter, sortOrder])

  const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'all'
  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sortOrder)?.label ?? 'Sort'

  if (meetings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <AudioLines className="size-8 text-muted-foreground" />
        <div className="flex flex-col gap-1.5">
          <h2 className="text-sm font-semibold text-foreground">Record your first meeting</h2>
          <p className="text-sm text-muted-foreground">
            Speak freely — noter will structure your notes
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/new">Start recording</Link>
        </Button>
        <Link
          href="/dashboard/new"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          or drop an audio file to upload
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              role="searchbox"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, summary, or topics…"
              className="w-full rounded-lg bg-card pl-9 pr-9"
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

          {/* Filter toggle */}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            aria-controls={filtersPanelId}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              showFilters || hasActiveFilters
                ? 'border-border bg-secondary text-foreground'
                : 'border-border text-muted-foreground hover:border-border hover:text-foreground'
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {hasActiveFilters && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {(searchQuery.trim() ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0)}
              </span>
            )}
          </button>

          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5 rounded-lg text-xs font-medium text-muted-foreground"
              >
                <ArrowUpDown className="size-3.5" />
                {currentSortLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
                {SORT_OPTIONS.map((opt) => (
                  <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Expanded filter row */}
        {showFilters && (
          <div id={filtersPanelId} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
            <span className="text-xs text-muted-foreground">Status:</span>
            <div className="flex flex-wrap gap-1">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  aria-pressed={statusFilter === opt.value}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    statusFilter === opt.value
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('')
                  setStatusFilter('all')
                }}
                className="ml-auto text-xs text-muted-foreground"
              >
                Clear all
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Results count */}
      {hasActiveFilters && (
        <p className="text-xs text-muted-foreground">
          {filteredMeetings.length} {filteredMeetings.length === 1 ? 'result' : 'results'}
          {searchQuery.trim() && <> for &ldquo;{searchQuery.trim()}&rdquo;</>}
        </p>
      )}

      {/* Meetings list */}
      {filteredMeetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No notes match your search
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery('')
              setStatusFilter('all')
            }}
            className="text-xs"
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="flex flex-col">
          {filteredMeetings.map((meeting) => (
            <div
              key={meeting.id}
              className="group flex min-h-[56px] items-center border-b border-border/60 last:border-b-0 transition-colors hover:bg-muted/60"
            >
              {/* Pinned indicator */}
              {meeting.is_pinned && (
                <span className="ml-4 size-1.5 shrink-0 rounded-full bg-accent" />
              )}

              <Link
                href={`/dashboard/${meeting.id}`}
                className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                {/* Relative time */}
                <span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-muted-foreground tabular-nums">
                  {formatRelativeDate(meeting.created_at)}
                </span>
                {/* Title */}
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {meeting.title}
                </span>
                {/* Status dot */}
                <StatusDot status={meeting.status} />
              </Link>

              {/* Pin button — visible on hover or when pinned */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  togglePin(meeting.id, meeting.is_pinned)
                }}
                aria-label={meeting.is_pinned ? 'Unpin note' : 'Pin note'}
                className={cn(
                  'mr-4 rounded-md p-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  meeting.is_pinned
                    ? 'text-foreground'
                    : 'text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground'
                )}
              >
                <Pin className={cn('size-3.5', meeting.is_pinned && 'fill-current')} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
