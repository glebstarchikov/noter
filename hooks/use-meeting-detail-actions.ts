import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { clearChatMessages } from '@/lib/chat-storage'
import type { ActionItem, Meeting } from '@/lib/types'

export function useMeetingDetailActions(meeting: Meeting) {
  const [actionItems, setActionItems] = useState<ActionItem[]>(meeting.action_items || [])
  const [isPinned, setIsPinned] = useState(meeting.is_pinned)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const keyDecisions = useMemo(() => meeting.key_decisions ?? [], [meeting.key_decisions])
  const topics = useMemo(() => meeting.topics ?? [], [meeting.topics])
  const followUps = useMemo(() => meeting.follow_ups ?? [], [meeting.follow_ups])

  const togglePin = useCallback(async () => {
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
  }, [isPinned, meeting.id])

  const handleCopyNotes = useCallback(() => {
    const parts: string[] = []
    if (meeting.title) parts.push(`# ${meeting.title}\n`)
    if (meeting.summary) parts.push(`${meeting.summary}\n`)
    if (meeting.detailed_notes) {
      parts.push(meeting.detailed_notes)
    } else if (keyDecisions.length > 0) {
      parts.push(`## Key Decisions\n${keyDecisions.map((d) => `- ${d}`).join('\n')}`)
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
  }, [actionItems, followUps, keyDecisions, meeting.detailed_notes, meeting.summary, meeting.title])

  const toggleAction = useCallback(async (index: number) => {
    const previous = actionItems
    const updated = actionItems.map((item, i) => (
      i === index ? { ...item, done: !item.done } : item
    ))
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
  }, [actionItems, meeting.id])

  const handleDelete = useCallback(async () => {
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
  }, [meeting.id, router])

  return {
    actionItems,
    isPinned,
    isDeleting,
    keyDecisions,
    topics,
    followUps,
    togglePin,
    handleCopyNotes,
    toggleAction,
    handleDelete,
  }
}
