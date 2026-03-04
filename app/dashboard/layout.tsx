import { AppSidebar } from '@/components/app-sidebar'
import { GlobalChatWindow } from '@/components/global-chat-window'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { ChatListProvider } from '@/lib/chat-list-context'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <ChatListProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4 md:hidden">
            <SidebarTrigger className="-ml-1" />
          </header>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </SidebarInset>
        <GlobalChatWindow />
      </ChatListProvider>
    </SidebarProvider>
  )
}
