'use client'

import { useState } from 'react'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { GlobalChat } from '@/components/global-chat'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isGlobalChatOpen, setIsGlobalChatOpen] = useState(false)

  return (
    <SidebarProvider>
      <AppSidebar
        onGlobalChatToggle={() => setIsGlobalChatOpen((prev) => !prev)}
        isGlobalChatOpen={isGlobalChatOpen}
      />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4 md:hidden">
          <SidebarTrigger className="-ml-1" />
        </header>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </SidebarInset>
      <GlobalChat
        isOpen={isGlobalChatOpen}
        onClose={() => setIsGlobalChatOpen(false)}
      />
    </SidebarProvider>
  )
}
