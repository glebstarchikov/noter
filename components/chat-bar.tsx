'use client'

import ReactMarkdown from 'react-markdown'
import { Send, Sparkles, Loader2, Trash2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getMessageText, useChatPanelState } from '@/hooks/use-chat-panel-state'

interface ChatBarProps {
  meetingTitle?: string
}

export function ChatBar({ meetingTitle }: ChatBarProps) {
  const {
    isExpanded,
    setIsExpanded,
    input,
    setInput,
    scrollRef,
    inputRef,
    panelRef,
    isGlobal,
    messages,
    status,
    error,
    isLoading,
    isStreaming,
    suggestions,
    contextLabel,
    handleSubmit,
    handleClearChat,
  } = useChatPanelState(meetingTitle)

  return (
    <div
      ref={panelRef}
      className={cn(
        'absolute bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col',
        'backdrop-blur-xl backdrop-saturate-150',
        'border rounded-3xl overflow-hidden',
        'transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
        'bg-black/[0.03] border-black/[0.08] shadow-[0_4px_24px_-4px_oklch(0_0_0/0.08)]',
        'dark:bg-white/[0.06] dark:border-white/[0.1] dark:shadow-[0_4px_24px_-4px_oklch(0_0_0/0.4)]',
        isExpanded ? 'w-[calc(100%-2rem)] max-w-[700px] max-h-[60vh]' : 'w-[calc(100%-2rem)] max-w-[600px] max-h-[48px]',
        isStreaming && 'chat-glow-pulse',
        !isStreaming && !isExpanded && 'hover:shadow-[0_4px_28px_-4px_oklch(0.65_0.08_25/0.15)] dark:hover:shadow-[0_4px_28px_-4px_oklch(0.65_0.08_25/0.2)]',
      )}
    >
      {isExpanded && (
        <>
          <div className="flex items-center justify-between px-5 py-2.5 border-b border-black/[0.06] dark:border-white/[0.08]">
            <div className="flex items-center gap-2">
              <Sparkles className="size-3.5 text-accent" />
              <span className="text-xs font-medium text-foreground">noter AI</span>
              <span className="rounded-full bg-black/[0.06] dark:bg-white/[0.08] px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {isGlobal ? 'Global' : 'Meeting'}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              {messages.length > 0 && (
                <button type="button" onClick={handleClearChat} className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" aria-label="Clear chat">
                  <Trash2 className="size-3.5" />
                </button>
              )}
              <button type="button" onClick={() => setIsExpanded(false)} className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/[0.06] hover:text-foreground dark:hover:bg-white/[0.08]" aria-label="Collapse">
                <ChevronDown className="size-3.5" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-3" role="log" aria-live="polite">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10"><Sparkles className="size-4 text-accent" /></div>
                <p className="text-xs font-medium text-foreground">{isGlobal ? 'Ask anything across all your meetings' : 'Ask anything about this meeting'}</p>
                <p className="text-[11px] text-muted-foreground text-center max-w-xs">{isGlobal ? 'I have context from summaries, action items, and decisions.' : 'I have access to the transcript, notes, and attached documents.'}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map((message) => {
                  const text = getMessageText(message)
                  if (!text) return null
                  return (
                    <div key={message.id} className={cn('flex flex-col gap-0.5', message.role === 'user' ? 'items-end' : 'items-start')}>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{message.role === 'user' ? 'you' : 'noter AI'}</span>
                      <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed overflow-hidden', message.role === 'user' ? 'bg-accent text-accent-foreground' : 'bg-black/[0.05] dark:bg-white/[0.06] text-foreground')}>
                        {message.role === 'user' ? <div className="whitespace-pre-wrap">{text}</div> : <div className="prose prose-sm dark:prose-invert max-w-none break-words [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:mb-2 [&>ol]:list-decimal [&>ol]:pl-4 [&>h3]:font-bold [&>h3]:mb-1 [&>h2]:font-bold [&>h2]:mb-1 font-sans"><ReactMarkdown>{text}</ReactMarkdown></div>}
                      </div>
                    </div>
                  )
                })}
                {isLoading && (
                  <div className="flex flex-col gap-0.5 items-start">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">noter AI</span>
                    <div className="flex items-center gap-2 rounded-2xl bg-black/[0.05] dark:bg-white/[0.06] px-3.5 py-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" />
                      <span>{status === 'streaming' ? 'Responding...' : 'Thinking...'}</span>
                    </div>
                  </div>
                )}
                {error && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2 text-xs text-destructive" role="alert">
                    {error.message?.includes('429') || error.message?.includes('Too Many')
                      ? "You're sending messages too quickly. Please wait a moment."
                      : error.message?.includes('No meetings')
                        ? 'No meetings found yet. Create some meetings first.'
                        : 'Something went wrong. Please try again.'}
                  </div>
                )}
              </div>
            )}
          </div>

          {messages.length === 0 && (
            <div className="flex gap-1.5 overflow-x-auto px-5 pb-2 scrollbar-none">
              {suggestions.map((s) => (
                <button type="button" key={s} onClick={() => handleSubmit(s)} disabled={isLoading} className="shrink-0 rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.04] dark:bg-white/[0.05] px-3 py-1 text-[11px] text-muted-foreground whitespace-nowrap transition-colors hover:bg-black/[0.08] dark:hover:bg-white/[0.1] hover:text-foreground">
                  {s}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <div className={cn('flex items-center gap-3 h-12', isExpanded ? 'px-5 border-t border-black/[0.06] dark:border-white/[0.08]' : 'px-5')}>
        {!isExpanded && <Sparkles className="size-4 shrink-0 text-accent" />}
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(input) }} className="flex flex-1 items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            placeholder={contextLabel}
            disabled={isLoading}
            aria-label={contextLabel}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-50"
          />
          <div className="flex items-center gap-1.5">
            {!isExpanded && messages.length > 0 && <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent tabular-nums">{messages.length}</span>}
            <kbd className="hidden rounded-md border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.04] dark:bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-muted-foreground md:inline-block">⌘J</kbd>
            <button type="submit" disabled={!input.trim() || isLoading} className="shrink-0 text-accent disabled:opacity-30 transition-opacity hover:opacity-70">
              <Send className="size-4" />
              <span className="sr-only">Send</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
