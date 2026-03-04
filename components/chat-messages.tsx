'use client'

import type { UIMessage } from 'ai'
import ReactMarkdown from 'react-markdown'
import { Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export function getMessageText(msg: UIMessage): string {
  if (!msg.parts || !Array.isArray(msg.parts)) return ''

  return msg.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('')
}

interface ChatMessagesProps {
  messages: UIMessage[]
  status: 'submitted' | 'streaming' | 'ready' | 'error'
  error: Error | undefined
  suggestions?: string[]
  emptyStateTitle?: string
  emptyStateDescription?: string
  onSuggestionClick?: (suggestion: string) => void
}

export function ChatMessages({
  messages,
  status,
  error,
  suggestions = [],
  emptyStateTitle = 'Ask anything',
  emptyStateDescription = 'I can help answer questions from your meeting context.',
  onSuggestionClick,
}: ChatMessagesProps) {
  const isLoading = status === 'streaming' || status === 'submitted'

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
            <Sparkles className="size-5 text-accent" />
          </div>
          <p className="text-sm font-medium text-foreground">{emptyStateTitle}</p>
          <p className="text-xs text-muted-foreground">{emptyStateDescription}</p>
        </div>
        {suggestions.length > 0 && (
          <div className="flex w-full flex-col gap-2">
            {suggestions.map((suggestion) => (
              <button
                type="button"
                key={suggestion}
                onClick={() => onSuggestionClick?.(suggestion)}
                disabled={isLoading}
                className="rounded-lg border border-border bg-card px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {messages.map((message) => {
        const text = getMessageText(message)
        if (!text) return null

        return (
          <div
            key={message.id}
            className={cn('flex flex-col gap-1', message.role === 'user' ? 'items-end' : 'items-start')}
          >
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {message.role === 'user' ? 'you' : 'noter AI'}
            </span>
            <div
              className={cn(
                'max-w-[90%] overflow-hidden rounded-xl px-3 py-2 text-sm leading-relaxed',
                message.role === 'user'
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-secondary text-foreground'
              )}
            >
              {message.role === 'user' ? (
                <div className="whitespace-pre-wrap">{text}</div>
              ) : (
                <div className="prose prose-sm max-w-none break-words font-sans dark:prose-invert [&>h2]:mb-1 [&>h2]:font-bold [&>h3]:mb-1 [&>h3]:font-bold [&>ol]:mb-2 [&>ol]:list-decimal [&>ol]:pl-4 [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ul]:list-disc [&>ul]:pl-4">
                  <ReactMarkdown>{text}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {isLoading && (
        <div className="flex flex-col items-start gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">noter AI</span>
          <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            <span>{status === 'streaming' ? 'Responding...' : 'Thinking...'}</span>
          </div>
        </div>
      )}

      {error && (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {error.message?.includes('429') || error.message?.includes('Too Many')
            ? "You're sending messages too quickly. Please wait a moment."
            : 'Something went wrong. Please try again.'}
        </div>
      )}
    </div>
  )
}
