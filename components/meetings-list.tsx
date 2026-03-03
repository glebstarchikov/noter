'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Search, X, SlidersHorizontal, ArrowUpDown, AudioLines, FileUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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

export function MeetingsList({ meetings }: { meetings: Meeting[] }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<MeetingStatus | 'all'>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [showFilters, setShowFilters] = useState(false)

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

    // Sort
    result = [...result].sort((a, b) => {
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
          <AudioLines className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-base font-semibold text-foreground">No meetings yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Record a live meeting or upload an audio file to get started. AI will transcribe and extract structured notes automatically.
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 sm:flex-row">
          <Link
            href="/dashboard/new"
            className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
          >
            <Plus className="h-4 w-4" />
            New meeting
          </Link>
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
            <input
              type="text"
              role="searchbox"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, summary, or topics…"
              className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
              showFilters || hasActiveFilters
                ? 'border-accent/40 bg-accent/10 text-foreground'
                : 'border-border text-muted-foreground hover:border-border hover:text-foreground'
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {hasActiveFilters && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                {(searchQuery.trim() ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0)}
              </span>
            )}
          </button>

          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                {currentSortLabel}
              </button>
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
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
            <span className="text-xs text-muted-foreground">Status:</span>
            <div className="flex flex-wrap gap-1">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  aria-pressed={statusFilter === opt.value}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
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
              <button
                onClick={() => {
                  setSearchQuery('')
                  setStatusFilter('all')
                }}
                className="ml-auto text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Clear all
              </button>
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
          <button
            onClick={() => {
              setSearchQuery('')
              setStatusFilter('all')
            }}
            className="text-xs text-accent transition-colors hover:text-accent/80"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {filteredMeetings.map((meeting) => {
            const status = statusBadge(meeting.status)
            return (
              <Link
                key={meeting.id}
                href={`/dashboard/${meeting.id}`}
                className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-secondary"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-foreground">
                    {meeting.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(meeting.created_at)}
                  </span>
                </div>
                <Badge variant={status.variant} className="shrink-0">
                  {status.label}
                </Badge>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
