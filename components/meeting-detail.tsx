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

type Tab = 'summary' | 'actions' | 'transcript' | 'sources'

const tabs: { key: Tab; label: string }[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'actions', label: 'Actions' },
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
  const h = d.getHours()
  const m = d.getMinutes()
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${weekdays[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${hour12}:${m.toString().padStart(2, '0')} ${period}`
}

export function MeetingDetail({ meeting }: { meeting: Meeting }) {
  const [activeTab, setActiveTab] = useState<Tab>('summary')
  const [actionItems, setActionItems] = useState<ActionItem[]>(meeting.action_items || [])
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const keyDecisions = meeting.key_decisions ?? []
  const topics = meeting.topics ?? []
  const followUps = meeting.follow_ups ?? []

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
    if (!confirm('Delete this meeting? This cannot be undone.')) return
    setIsDeleting(true)
    const supabase = createClient()

    // Delete related sources first (cascade should handle this via FK,
    // but we do it explicitly for safety)
    await supabase.from('meeting_sources').delete().eq('meeting_id', meeting.id)

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
            Back to notes
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
          <div className="flex flex-col gap-6">
            {/* Summary text */}
            <div>
              {meeting.summary ? (
                <p className="text-sm leading-relaxed text-foreground">
                  {meeting.summary}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No summary available.</p>
              )}
            </div>

            {/* Topics (inline tags) */}
            {topics.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Topics</h3>
                <div className="flex flex-wrap gap-2">
                  {topics.map((topic, i) => (
                    <span
                      key={i}
                      className="inline-flex rounded-full border border-border bg-secondary px-3 py-1 text-xs text-foreground"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Key Decisions */}
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
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="flex flex-col gap-6">
            {/* Action Items */}
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
