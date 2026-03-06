'use client'

import { useEffect } from 'react'
import { useDashboardMeetingTitle } from '@/components/dashboard-meeting-title-context'

export function DashboardMeetingTitleSync({
  meetingTitle,
}: {
  meetingTitle?: string
}) {
  const { setMeetingTitle } = useDashboardMeetingTitle()

  useEffect(() => {
    setMeetingTitle(meetingTitle)

    return () => {
      setMeetingTitle(undefined)
    }
  }, [meetingTitle, setMeetingTitle])

  return null
}
