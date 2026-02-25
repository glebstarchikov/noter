'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { SourceManager } from '@/components/source-manager'
import type { Meeting, ActionItem } from '@/lib/types'

type Tab = 'summary' | 'actions' | 'decisions' | 'topics' | 'follow-ups' | 'transcript' | 'sources'

const tabs: { key: Tab; label: string }[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'actions', label: 'Actions' },
  { key: 'decisions', label: 'Decisions' },
  { key: 'topics', label: 'Topics' },
  { key: 'follow-ups', label: 'Follow-ups' },
  { key: 'transcript', label: 'Transcript' },
  { key: 'sources', label: 'Sources' },
]

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  const h = d.getUTCHours()
  const m = d.getUTCMinutes()
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${weekdays[d.getUTCDay()]}, ${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} at ${hour12}:${m.toString().padStart(2, '0')} ${period}`
}

export function MeetingDetail({ meeting }: { meeting: Meeting }) {
  const [activeTab, setActiveTab] = useState<Tab>('summary')
  const [actionItems, setActionItems] = useState<ActionItem[]>(meeting.action_items || [])
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const toggleAction = async (index: number) => {
    const updated = [...actionItems]
    updated[index] = { ...updated[index], done: !updated[index].done }
    setActionItems(updated)

    const supabase = createClient()
    await supabase
      .from('meetings')
      .update({ action_items: updated })
      .eq('id', meeting.id)
  }

  const handleDelete = async () => {
    if (!confirm('Delete this meeting? This cannot be undone.')) return
    setIsDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('meetings').delete().eq('id', meeting.id)
    if (error) {
      toast.error('Failed to delete meeting')
      setIsDeleting(false)
      return
    }
    router.push('/dashboard')
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to meetings
          </Link>
          <h1 className="text-xl font-semibold text-foreground text-balance">
            {meeting.title}
          </h1>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(meeting.created_at)}
            </span>
            {meeting.audio_duration && (
              <span>
                {Math.floor(meeting.audio_duration / 60)}m {meeting.audio_duration % 60}s
              </span>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          disabled={isDeleting}
          className="border-border text-muted-foreground hover:border-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Delete meeting</span>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-xl border border-border bg-card p-6">
        {activeTab === 'summary' && (
          <div className="flex flex-col gap-4">
            {meeting.summary ? (
              <p className="text-sm leading-relaxed text-foreground">
                {meeting.summary}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No summary available.</p>
            )}
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="flex flex-col gap-3">
            {actionItems.length > 0 ? (
              actionItems.map((item, i) => (
                <button
                  key={i}
                  onClick={() => toggleAction(i)}
                  className="flex items-start gap-3 rounded-lg p-2 text-left transition-colors hover:bg-secondary"
                >
                  {item.done ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
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
        )}

        {activeTab === 'decisions' && (
          <div className="flex flex-col gap-3">
            {meeting.key_decisions.length > 0 ? (
              meeting.key_decisions.map((decision, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span className="text-sm leading-relaxed text-foreground">{decision}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No key decisions found.</p>
            )}
          </div>
        )}

        {activeTab === 'topics' && (
          <div className="flex flex-wrap gap-2">
            {meeting.topics.length > 0 ? (
              meeting.topics.map((topic, i) => (
                <span
                  key={i}
                  className="inline-flex rounded-full border border-border bg-secondary px-3 py-1 text-xs text-foreground"
                >
                  {topic}
                </span>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No topics found.</p>
            )}
          </div>
        )}

        {activeTab === 'follow-ups' && (
          <div className="flex flex-col gap-3">
            {meeting.follow_ups.length > 0 ? (
              meeting.follow_ups.map((followUp, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                  <span className="text-sm leading-relaxed text-foreground">{followUp}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No follow-ups found.</p>
            )}
          </div>
        )}

        {activeTab === 'transcript' && (
          <div className="flex flex-col gap-4">
            {meeting.transcript ? (
              <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
                {meeting.transcript}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No transcript available.</p>
            )}
          </div>
        )}

        {activeTab === 'sources' && (
          <SourceManager meetingId={meeting.id} />
        )}
      </div>
    </div>
  )
}
