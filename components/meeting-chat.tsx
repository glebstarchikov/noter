'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import type { UIMessage } from 'ai'
import ReactMarkdown from 'react-markdown'
import {
  X,
  Send,
  Sparkles,
  Loader2,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getChatMessages, saveChatMessages, clearChatMessages } from '@/lib/chat-storage'

function getMessageText(msg: UIMessage): string {
  if (!msg.parts || !Array.isArray(msg.parts)) return ''
  return msg.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

const SUGGESTIONS = [
  'What were the main takeaways?',
  'Were any deadlines mentioned?',
  'Who has the most action items?',
  'Summarize the key decisions.',
]

interface MeetingChatProps {
  meetingId: string
  isOpen: boolean
  onClose: () => void
  variant?: 'inline' | 'floating'
}

export function MeetingChat({ meetingId, isOpen, onClose, variant = 'inline' }: MeetingChatProps) {
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

  // Persist messages to localStorage (debounced via ref to avoid excessive writes)
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
  }, [messages, meetingId])

  const handleClearChat = useCallback(() => {
    clearChatMessages(meetingId)
    setMessages([])
  }, [meetingId, setMessages])

  const isLoading = status === 'streaming' || status === 'submitted'

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSubmit = (text: string) => {
    if (!text.trim() || isLoading) return
    sendMessage({ text: text.trim() })
    setInput('')
  }

  if (!isOpen) return null

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium text-foreground">noter AI</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Clear chat history"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 px-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                <Sparkles className="h-5 w-5 text-accent" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Ask anything about this meeting
              </p>
              <p className="text-xs text-muted-foreground">
                I have access to the transcript, notes, and any attached documents.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSubmit(suggestion)}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((message) => {
              const text = getMessageText(message)
              if (!text) return null
              return (
                <div
                  key={message.id}
                  className={cn(
                    'flex flex-col gap-1',
                    message.role === 'user' ? 'items-end' : 'items-start'
                  )}
                >
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {message.role === 'user' ? 'you' : 'noter AI'}
                  </span>
                  <div
                    className={cn(
                      'max-w-[90%] rounded-xl px-3 py-2 text-sm leading-relaxed overflow-hidden',
                      message.role === 'user'
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-secondary text-foreground'
                    )}
                  >
                    {message.role === 'user' ? (
                      <div className="whitespace-pre-wrap">{text}</div>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none break-words [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:mb-2 [&>ol]:list-decimal [&>ol]:pl-4 [&>h3]:font-bold [&>h3]:mb-1 [&>h2]:font-bold [&>h2]:mb-1 font-sans">
                        <ReactMarkdown>{text}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {isLoading && (
              <div className="flex flex-col gap-1 items-start">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  noter AI
                </span>
                <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>{status === 'streaming' ? 'Responding...' : 'Thinking...'}</span>
                </div>
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
                {error.message?.includes('429') || error.message?.includes('Too Many')
                  ? "You're sending messages too quickly. Please wait a moment."
                  : 'Something went wrong. Please try again.'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border px-4 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit(input)
          }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the meeting..."
            disabled={isLoading}
            aria-label="Ask about the meeting"
            className="flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="h-9 w-9 shrink-0 bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-30"
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </div>
    </div>
  )
}
