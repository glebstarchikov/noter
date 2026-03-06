'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

interface DashboardMeetingTitleContextValue {
  meetingTitle?: string
  setMeetingTitle: (title?: string) => void
}

const DashboardMeetingTitleContext = createContext<DashboardMeetingTitleContextValue | null>(null)

export function DashboardMeetingTitleProvider({
  children,
}: {
  children: ReactNode
}) {
  const [meetingTitle, setMeetingTitle] = useState<string | undefined>()

  const value = useMemo(
    () => ({
      meetingTitle,
      setMeetingTitle,
    }),
    [meetingTitle]
  )

  return (
    <DashboardMeetingTitleContext.Provider value={value}>
      {children}
    </DashboardMeetingTitleContext.Provider>
  )
}

export function useDashboardMeetingTitle() {
  const context = useContext(DashboardMeetingTitleContext)

  if (!context) {
    throw new Error('useDashboardMeetingTitle must be used within DashboardMeetingTitleProvider')
  }

  return context
}
