'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { X, Sparkles, MessageSquarePlus } from 'lucide-react'
import { MeetingChat } from '@/components/meeting-chat'
import { ChatInput } from '@/components/chat-input'
import { ChatMessages } from '@/components/chat-messages'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/use-mobile'
import { useChatList } from '@/lib/chat-list-context'
import { useMeetingContext } from '@/lib/meeting-context'

const SUGGESTIONS = [
  'What decisions did I make this week?',
  'Which meetings mention hiring?',
  'Summarize blockers across all meetings.',
]

export function GlobalChatWindow() {
  const pathname = usePathname()
  const meetingContext = useMeetingContext()
  const isMobile = useIsMobile()
  const { addChat } = useChatList()

  const isSavedChatPage = pathname?.startsWith('/dashboard/chats/')
  const isMeetingPage = pathname?.startsWith('/dashboard/') && pathname.split('/').length === 3 && !!meetingContext
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [chatId, setChatId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/global-chat',
        body: chatId ? { chatId } : undefined,
      }),
    [chatId]
  )

  const { messages, sendMessage, setMessages, status, error } = useChat({
    id: chatId ?? 'global-floating-chat',
    transport,
  })

  useEffect(() => {
    if (!isOpen || !scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [isOpen, messages])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
        event.preventDefault()
        if (!isSavedChatPage) {
          setIsOpen((prev) => !prev)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSavedChatPage])

  const isLoading = status === 'submitted' || status === 'streaming'

  const handleSubmit = useCallback(() => {
    if (!input.trim() || isLoading) return
    sendMessage({ text: input.trim() })
    setInput('')
  }, [input, isLoading, sendMessage])

  const handleSendSuggestion = useCallback((suggestion: string) => {
    sendMessage({ text: suggestion })
    setInput('')
  }, [sendMessage])

  useEffect(() => {
    if (chatId || messages.length === 0) return

    const resolveChat = async () => {
      const response = await fetch('/api/chats', { cache: 'no-store' })
      if (!response.ok) return
      const payload = await response.json() as { chats?: Array<{ id: string; title: string; updated_at: string }> }
      const latest = payload.chats?.[0]
      if (latest) {
        setChatId(latest.id)
        addChat(latest)
      }
    }

    void resolveChat()
  }, [addChat, chatId, messages.length])

  if (isSavedChatPage) {
    return null
  }

  if (isMeetingPage && meetingContext && isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-40 hidden h-[520px] w-[420px] md:block">
        <MeetingChat meetingId={meetingContext.meetingId} />
      </div>
    )
  }

  const panelContent = (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-accent" />
          <div>
            <p className="text-sm font-medium text-foreground">noter AI</p>
            <p className="text-xs text-muted-foreground">All meetings</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => { setMessages([]); setChatId(null) }}>
            New Chat
          </Button>
          {chatId && (
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/dashboard/chats/${chatId}`} aria-label="Open full page chat">
                <MessageSquarePlus className="size-4" />
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} aria-label="Close chat">
            <X className="size-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4" ref={scrollRef}>
        <ChatMessages
          messages={messages}
          status={status}
          error={error}
          suggestions={SUGGESTIONS}
          emptyStateTitle="Ask across all meetings"
          emptyStateDescription="I only have summaries in this view."
          onSuggestionClick={handleSendSuggestion}
        />
      </div>
      <div className="border-t border-border px-4 py-3">
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          placeholder="Ask across meetings..."
        />
      </div>
    </div>
  )

  return (
    <>
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-lg"
        >
          <Sparkles className="size-4 text-accent" />
          Ask AI
        </button>
      ) : isMobile ? (
        <Drawer open={isOpen} onOpenChange={setIsOpen}>
          <DrawerContent className="h-[80vh] p-0">
            <DrawerTitle className="sr-only">Global AI chat</DrawerTitle>
            {panelContent}
          </DrawerContent>
        </Drawer>
      ) : (
        <div className="fixed bottom-6 right-6 z-40 h-[520px] w-[420px]">{panelContent}</div>
      )}
    </>
  )
}
