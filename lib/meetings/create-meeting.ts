'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createNewMeeting() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: meeting, error } = await supabase
    .from('meetings')
    .insert({
      user_id: user.id,
      title: 'Untitled note',
      status: 'done',
    })
    .select('id')
    .single()

  if (error || !meeting) {
    throw new Error('Failed to create meeting')
  }

  redirect(`/dashboard/${meeting.id}`)
}
