'use client'

import { useState, useMemo, useId, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search, X, SlidersHorizontal, ArrowUpDown, AudioLines, FileUp, Pin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    recording: { label: 'Recording', variant: 'default' },
    uploading: { label: 'Uploading', variant: 'default' },
    transcribing: { label: 'Transcribing', variant: 'default' },
    generating: { label: 'Generating', variant: 'default' },
    done: { label: 'Complete', variant: 'secondary' },
    error: { label: 'Error', variant: 'destructive' },
  }
  return map[status] || { label: status, variant: 'outline' as const }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const h = d.getHours()
  const m = d.getMinutes()
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}, ${hour12}:${m.toString().padStart(2, '0')} ${period}`
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
      <div className="flex flex-col items-center justify-center gap-6 rounded-xl border border-dashed border-border py-20 px-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
          <AudioLines className="size-7 text-muted-foreground" />
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-base font-semibold text-foreground">No meetings yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Record a live meeting or upload an audio file to get started. AI will transcribe and extract structured notes automatically.
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 sm:flex-row">
          <Button asChild>
            <Link href="/dashboard/new">
              <Plus className="size-4" />
              New meeting
            </Link>
          </Button>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <AudioLines className="h-3.5 w-3.5" />
            Record live
          </span>
          <span className="flex items-center gap-1.5">
            <FileUp className="h-3.5 w-3.5" />
            Upload audio
          </span>
        </div>
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
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16">
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
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {filteredMeetings.map((meeting) => {
            const status = statusBadge(meeting.status)
            return (
              <div
                key={meeting.id}
                className="group flex items-center transition-colors hover:bg-secondary"
              >
                <Link
                  href={`/dashboard/${meeting.id}`}
                  className="flex min-w-0 flex-1 flex-col gap-1 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <span className="truncate text-sm font-medium text-foreground">
                    {meeting.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(meeting.created_at)}
                  </span>
                </Link>
                <div className="flex shrink-0 items-center gap-2 pr-5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      togglePin(meeting.id, meeting.is_pinned)
                    }}
                    aria-label={meeting.is_pinned ? 'Unpin note' : 'Pin note'}
                    className={cn(
                      'rounded-md p-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      meeting.is_pinned
                        ? 'text-primary hover:bg-primary/10'
                        : 'text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-secondary hover:text-foreground'
                    )}
                  >
                    <Pin className={cn('size-3.5', meeting.is_pinned && 'rotate-45')} />
                  </button>
                  <Badge variant={status.variant} className="shrink-0">
                    {status.label}
                  </Badge>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
