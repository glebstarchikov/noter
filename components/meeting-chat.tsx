'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { ArrowUpRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ChatInput } from '@/components/chat-input'
import { ChatMessages, getMessageText } from '@/components/chat-messages'
import { Button } from '@/components/ui/button'
import { clearChatMessages, getChatMessages, saveChatMessages } from '@/lib/chat-storage'

const SUGGESTIONS = [
  'What were the main takeaways?',
  'Were any deadlines mentioned?',
  'Who has the most action items?',
  'Summarize the key decisions.',
]

export function MeetingChat({ meetingId }: { meetingId: string }) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: { meetingId },
      }),
    [meetingId]
  )

  const storedMessages = useMemo(() => getChatMessages(meetingId), [meetingId])
  const { messages, sendMessage, setMessages, status, error } = useChat({
    id: meetingId,
    transport,
    messages: storedMessages,
  })

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (messages.length === 0) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

    saveTimeoutRef.current = setTimeout(() => {
      saveChatMessages(meetingId, messages)
    }, 500)

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [meetingId, messages])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const isLoading = status === 'streaming' || status === 'submitted'

  const handleSubmit = useCallback(() => {
    if (!input.trim() || isLoading) return
    sendMessage({ text: input.trim() })
    setInput('')
  }, [input, isLoading, sendMessage])

  const handleClear = useCallback(() => {
    clearChatMessages(meetingId)
    setMessages([])
  }, [meetingId, setMessages])

  const handleTransfer = useCallback(async () => {
    const payload = messages
      .map((message) => ({ role: message.role, content: getMessageText(message) }))
      .filter((message) => (message.role === 'user' || message.role === 'assistant') && message.content)

    if (payload.length === 0) return

    const response = await fetch('/api/chats/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId, messages: payload }),
    })

    if (!response.ok) {
      toast.error('Could not transfer chat')
      return
    }

    const result = await response.json() as { chat?: { id: string } }
    window.dispatchEvent(new CustomEvent('chat-created'))
    toast.success('Transferred to saved chat', {
      action: {
        label: 'Open',
        onClick: () => {
          if (result.chat?.id) {
            window.location.href = `/dashboard/chats/${result.chat.id}`
          }
        },
      },
    })
  }, [meetingId, messages])

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-medium text-foreground">noter AI · This meeting</span>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" onClick={handleTransfer} aria-label="Transfer to saved chat">
              <ArrowUpRight className="size-4" />
            </Button>
          )}
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" onClick={handleClear} aria-label="Clear chat history">
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
        <ChatMessages
          messages={messages}
          status={status}
          error={error}
          suggestions={SUGGESTIONS}
          emptyStateTitle="Ask anything about this meeting"
          emptyStateDescription="I have access to this meeting transcript, notes, and sources."
          onSuggestionClick={(suggestion) => {
            setInput(suggestion)
            sendMessage({ text: suggestion })
          }}
        />
      </div>

      <div className="border-t border-border px-4 py-3">
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          placeholder="Ask about this meeting..."
        />
      </div>
    </div>
  )
}
