import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MeetingsList } from '@/components/meetings-list'
import type { Meeting } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: meetings, error } = await supabase
    .from('meetings')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="flex flex-col gap-6 p-6 md:p-10">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-foreground">
            Meetings
          </h1>
          <p className="text-sm text-destructive">
            Failed to load meetings. Please try refreshing the page.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">
          Meetings
        </h1>
        <p className="text-sm text-muted-foreground">
          Your recorded and uploaded meetings.
        </p>
      </div>

      <MeetingsList meetings={(meetings as Meeting[]) || []} />
    </div>
  )
}
