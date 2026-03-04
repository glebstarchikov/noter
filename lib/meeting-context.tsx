'use client'

import { createContext, useContext } from 'react'

interface MeetingContextValue {
  meetingId: string
  meetingTitle: string
}

const MeetingContext = createContext<MeetingContextValue | null>(null)

export function MeetingProvider({
  children,
  meetingId,
  meetingTitle,
}: {
  children: React.ReactNode
  meetingId: string
  meetingTitle: string
}) {
  return (
    <MeetingContext.Provider value={{ meetingId, meetingTitle }}>
      {children}
    </MeetingContext.Provider>
  )
}

export function useMeetingContext() {
  return useContext(MeetingContext)
}
