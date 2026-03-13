'use client'

import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="relative flex min-h-svh flex-col bg-background">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/60 bg-background/90 px-4 backdrop-blur md:hidden">
          <SidebarTrigger className="-ml-1" />
        </header>
        <main
          className="flex-1 overflow-y-auto transition-[padding-bottom] duration-200"
          style={{ paddingBottom: 'var(--floating-chatbar-offset, 0px)' }}
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
