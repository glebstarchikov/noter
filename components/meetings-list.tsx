'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { Meeting } from '@/lib/types'

function statusLabel(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    recording: { label: 'Recording', className: 'text-accent' },
    uploading: { label: 'Uploading', className: 'text-accent' },
    transcribing: { label: 'Transcribing', className: 'text-accent' },
    generating: { label: 'Generating notes', className: 'text-accent' },
    done: { label: 'Complete', className: 'text-muted-foreground' },
    error: { label: 'Error', className: 'text-destructive' },
  }
  return map[status] || { label: status, className: 'text-muted-foreground' }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function MeetingsList({ meetings }: { meetings: Meeting[] }) {
  if (meetings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-20">
        <p className="text-sm text-muted-foreground">
          No meetings yet
        </p>
        <Link
          href="/dashboard/new"
          className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
        >
          <Plus className="h-4 w-4" />
          New meeting
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
      {meetings.map((meeting) => {
        const status = statusLabel(meeting.status)
        return (
          <Link
            key={meeting.id}
            href={`/dashboard/${meeting.id}`}
            className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-card"
          >
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">
                {meeting.title}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDate(meeting.created_at)}
              </span>
            </div>
            <span className={`text-xs ${status.className}`}>
              {status.label}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
