'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { ChatBar } from '@/components/chat-bar'
import { createClient } from '@/lib/supabase/client'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [meetingTitle, setMeetingTitle] = useState<string | undefined>()

  // Fetch meeting title when on a meeting page
  useEffect(() => {
    const match = pathname.match(/^\/dashboard\/([^/]+)$/)
    if (!match) {
      setMeetingTitle(undefined)
      return
    }

    const meetingId = match[1]
    if (meetingId === 'new') {
      setMeetingTitle(undefined)
      return
    }

    const supabase = createClient()
    supabase
      .from('meetings')
      .select('title')
      .eq('id', meetingId)
      .single()
      .then(({ data }) => {
        setMeetingTitle(data?.title ?? undefined)
      })
  }, [pathname])

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="relative flex flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4 md:hidden">
          <SidebarTrigger className="-ml-1" />
        </header>
        <main className="flex-1 overflow-y-auto pb-16">
          {children}
        </main>
        <ChatBar meetingTitle={meetingTitle} />
      </SidebarInset>
    </SidebarProvider>
  )
}
