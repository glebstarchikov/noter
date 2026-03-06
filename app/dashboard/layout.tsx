import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { ChatBar } from '@/components/chat-bar'
import { DashboardMeetingTitleProvider } from '@/components/dashboard-meeting-title-context'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DashboardMeetingTitleProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="relative flex flex-col">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4 md:hidden">
            <SidebarTrigger className="-ml-1" />
          </header>
          <main className="flex-1 overflow-y-auto pb-16">
            {children}
          </main>
          <ChatBar />
        </SidebarInset>
      </SidebarProvider>
    </DashboardMeetingTitleProvider>
  )
}
