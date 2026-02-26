'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import type { UIMessage } from 'ai'
import ReactMarkdown from 'react-markdown'
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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

export function MeetingChat({ meetingId }: { meetingId: string }) {
  const [isOpen, setIsOpen] = useState(false)
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

  const { messages, sendMessage, status, error } = useChat({ transport })

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

  return (
    <>
      {/* Floating toggle button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full shadow-lg transition-all',
          isOpen
            ? 'bg-secondary text-foreground hover:bg-secondary/80'
            : 'bg-accent text-accent-foreground hover:bg-accent/90'
        )}
        size="icon"
      >
        {isOpen ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
        <span className="sr-only">{isOpen ? 'Close chat' : 'Open meeting chat'}</span>
      </Button>

      {/* Chat panel */}
      <div
        className={cn(
          'fixed right-0 top-0 z-30 flex h-full w-full flex-col border-l border-border bg-background transition-transform duration-300 ease-in-out sm:w-[420px]',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-foreground">noter AI</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
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
                    className="rounded-lg border border-border bg-card px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground"
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
                    <span>Thinking...</span>
                  </div>
                </div>
              )}
              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  Something went wrong. Please try again.
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
              className="flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
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

      {/* Overlay backdrop on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-background/60 backdrop-blur-sm sm:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
