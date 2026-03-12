import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MeetingsList } from '@/components/meetings-list'
import { PageHeader, PageShell } from '@/components/page-shell'
import type { Meeting } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: meetings, error } = await supabase
    .from('meetings')
    .select('id, title, status, created_at, audio_duration, error_message, summary, topics, is_pinned')
    .eq('user_id', user.id)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <PageShell>
        <PageHeader
          title="Notes"
          description="Failed to load meetings. Please try refreshing the page."
        />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="Notes"
        description="Review recent meetings, jump back into a note, or start a new capture."
      />
      <MeetingsList meetings={(meetings as Meeting[]) || []} />
    </PageShell>
  )
}
