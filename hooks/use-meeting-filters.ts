import { useId, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Meeting, MeetingStatus } from '@/lib/types'

export type SortOrder = 'newest' | 'oldest' | 'title-asc' | 'title-desc'

export function useMeetingFilters(initialMeetings: Meeting[]) {
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
    setMeetings((prev) => prev.map((m) => (m.id === meetingId ? { ...m, is_pinned: newPinned } : m)))
    try {
      const res = await fetch(`/api/meetings/${meetingId}/pin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: newPinned }),
      })
      if (!res.ok) throw new Error('Failed to update pin')
      startTransition(() => router.refresh())
    } catch {
      setMeetings((prev) => prev.map((m) => (m.id === meetingId ? { ...m, is_pinned: currentPinned } : m)))
      toast.error('Failed to update pin')
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

    if (statusFilter !== 'all') {
      result = result.filter((m) => m.status === statusFilter)
    }

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
  }, [meetings, searchQuery, statusFilter, sortOrder])

  const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'all'

  return {
    meetings,
    filteredMeetings,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    sortOrder,
    setSortOrder,
    showFilters,
    setShowFilters,
    filtersPanelId,
    hasActiveFilters,
    togglePin,
  }
}
