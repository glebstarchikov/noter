'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type FileUIPart } from 'ai'
import type { UIMessage } from 'ai'
import ReactMarkdown from 'react-markdown'
import {
  Send,
  Sparkles,
  Loader2,
  Trash2,
  ChevronDown,
  MessageSquare,
  Paperclip,
  Search,
  X,
  Image as ImageIcon,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  getChatMessages,
  saveChatMessages,
  clearChatMessages,
  getGlobalChatMessages,
  saveGlobalChatMessages,
  clearGlobalChatMessages,
} from '@/lib/chat-storage'
import { ChatMessageAttachments } from '@/components/chat-message-attachments'

type ModelTier = 'fast' | 'balanced' | 'premium'

function getMessageText(msg: UIMessage): string {
  if (!msg.parts || !Array.isArray(msg.parts)) return ''
  return msg.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('')
}

const GLOBAL_SUGGESTIONS = [
  'What changed across recent notes?',
  'What needs follow-up this week?',
  'Summarize the biggest decisions',
]

const MEETING_SUGGESTIONS = [
  'What are the main takeaways?',
  'Which deadlines were mentioned?',
  'List the action items by owner',
]

interface ChatBarProps {
  meetingTitle?: string
}

function AttachmentChip({
  file,
  onRemove,
}: {
  file: File | FileUIPart
  onRemove?: () => void
}) {
  const filename = 'name' in file ? file.name : (file.filename || 'attachment')
  const mediaType = file instanceof File ? file.type : file.mediaType
  const isImage = mediaType.startsWith('image/')

  return (
    <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground">
      {isImage ? <ImageIcon className="size-3.5" /> : <FileText className="size-3.5" />}
      <span className="max-w-40 truncate">{filename}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full text-muted-foreground transition-colors hover:text-foreground"
          aria-label={`Remove ${filename}`}
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export function ChatBar({ meetingTitle }: ChatBarProps) {
  const pathname = usePathname()
  const [isExpanded, setIsExpanded] = useState(false)
  const [input, setInput] = useState('')
  const [modelTier, setModelTier] = useState<ModelTier>('balanced')
  const [searchEnabled, setSearchEnabled] = useState(false)
  const [files, setFiles] = useState<FileList | undefined>(undefined)
  const [hasHydratedMessages, setHasHydratedMessages] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const meetingId = useMemo(() => {
    const match = pathname.match(/^\/dashboard\/([^/]+)$/)
    return match ? match[1] : null
  }, [pathname])

  const isGlobal = !meetingId
  const chatId = meetingId ?? '__global__'

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: isGlobal ? '/api/chat/global' : '/api/chat',
        body: meetingId ? { meetingId } : undefined,
      }),
    [isGlobal, meetingId]
  )

  const { messages, sendMessage, setMessages, status, error } = useChat({
    id: chatId,
    transport,
  })

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    setHasHydratedMessages(false)
    const storedMessages = isGlobal ? getGlobalChatMessages() : getChatMessages(chatId)
    setMessages(storedMessages ?? [])
    setHasHydratedMessages(true)
  }, [isGlobal, chatId, setMessages])

  useEffect(() => {
    if (!hasHydratedMessages) return
    if (messages.length === 0) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      if (isGlobal) saveGlobalChatMessages(messages)
      else saveChatMessages(chatId, messages)
    }, 500)
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [messages, isGlobal, chatId, hasHydratedMessages])

  const handleClearChat = useCallback(() => {
    if (isGlobal) clearGlobalChatMessages()
    else clearChatMessages(chatId)
    setMessages([])
  }, [isGlobal, chatId, setMessages])

  const isLoading = status === 'streaming' || status === 'submitted'
  const isStreaming = status === 'streaming'

  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isExpanded, isLoading])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'j') {
        event.preventDefault()
        setIsExpanded((prev) => !prev)
        setTimeout(() => inputRef.current?.focus(), 100)
      }
      if (event.key === 'Escape' && isExpanded) {
        setIsExpanded(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isExpanded])

  const resetComposer = () => {
    setInput('')
    setSearchEnabled(false)
    setFiles(undefined)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = (text: string) => {
    if ((!text.trim() && !files?.length) || isLoading) return
    if (!isExpanded) setIsExpanded(true)

    void sendMessage(
      text.trim()
        ? { text: text.trim(), files }
        : { files: files as FileList },
      {
        body: {
          modelTier,
          searchEnabled,
        },
      }
    )

    resetComposer()
  }

  const suggestions = isGlobal ? GLOBAL_SUGGESTIONS : MEETING_SUGGESTIONS
  const sectionLabel = isGlobal ? 'Across all notes' : 'This note'
  const contextTitle = isGlobal
    ? 'Ask noter'
    : meetingTitle
      ? `Ask noter about ${meetingTitle.length > 48 ? `${meetingTitle.slice(0, 48)}…` : meetingTitle}`
      : 'Ask noter about this note'

  const selectedFiles = files ? Array.from(files) : []

  return (
    <section className="border-t border-border/60 bg-background/96 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
        {(isExpanded || messages.length > 0) && (
          <div className="liquid-metal-panel flex flex-col gap-4 rounded-[28px] p-4 md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="liquid-metal-icon flex size-8 items-center justify-center rounded-full">
                    <Sparkles className="size-3.5" />
                  </div>
                  <span className="text-sm font-medium text-foreground">Ask noter</span>
                  <span className="rounded-full bg-background/70 px-2 py-0.5 text-[11px] text-muted-foreground">
                    {sectionLabel}
                  </span>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {isGlobal
                    ? 'Ask across your notes, switch models, add web search, or include a file for context.'
                    : 'Ask about this note, bring in web search, or attach a file to compare against the meeting.'}
                </p>
              </div>

              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearChat}
                    className="h-8 gap-1.5 px-2 text-muted-foreground"
                  >
                    <Trash2 className="size-3.5" />
                    Clear
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIsExpanded(false)}
                  className="text-muted-foreground"
                >
                  <ChevronDown className="size-4" />
                  <span className="sr-only">Collapse chat</span>
                </Button>
              </div>
            </div>

            <div
              ref={scrollRef}
              className="max-h-80 space-y-4 overflow-y-auto"
              role="log"
              aria-live="polite"
            >
              {messages.length === 0 ? (
                <div className="flex flex-col gap-4 py-2">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <MessageSquare className="size-4 text-accent" />
                    {contextTitle}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => handleSubmit(suggestion)}
                        disabled={isLoading}
                        className="rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
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

                    return (
                      <div
                        key={message.id}
                        className={cn(
                          'flex flex-col gap-2',
                          message.role === 'user' ? 'items-end' : 'items-start'
                        )}
                      >
                        <span className="text-[11px] text-muted-foreground">
                          {message.role === 'user' ? 'You' : 'noter'}
                        </span>

                        <ChatMessageAttachments message={message} />

                        {text && (
                          <div
                            className={cn(
                              'max-w-[88%] rounded-3xl px-4 py-3 text-sm leading-7',
                              message.role === 'user'
                                ? 'bg-background/85 text-foreground shadow-sm'
                                : 'border border-border/60 bg-background/70 text-foreground'
                            )}
                          >
                            {message.role === 'user' ? (
                              <div className="whitespace-pre-wrap">{text}</div>
                            ) : (
                              <div className="prose prose-sm max-w-none break-words text-foreground dark:prose-invert [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ul]:pl-5 [&>ol]:mb-2 [&>ol]:pl-5">
                                <ReactMarkdown>{text}</ReactMarkdown>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {isLoading && (
                    <div className="flex items-start gap-3">
                      <div className="rounded-3xl border border-border/60 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Loader2 className="size-3.5 animate-spin" />
                          {isStreaming ? 'Writing a response…' : 'Thinking…'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error.message?.includes('429') || error.message?.includes('Too Many')
                  ? 'You are sending messages too quickly. Please wait a moment.'
                  : error.message?.includes('No meetings')
                    ? 'There are no notes to search yet.'
                    : 'Something went wrong. Please try again.'}
              </div>
            )}
          </div>
        )}

        <div className="liquid-metal-panel flex flex-col gap-3 rounded-[28px] p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="liquid-metal-icon flex size-9 items-center justify-center rounded-full">
              <Sparkles className="size-4" />
            </div>

            <Select value={modelTier} onValueChange={(value) => setModelTier(value as ModelTier)}>
              <SelectTrigger size="sm" className="liquid-metal-control h-9 min-w-36 rounded-full border-0 bg-transparent shadow-none">
                <SelectValue placeholder="Balanced" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fast">Fast</SelectItem>
                <SelectItem value="balanced">Balanced</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSearchEnabled((value) => !value)}
              className={cn(
                'liquid-metal-control rounded-full border-0 px-3 shadow-none',
                searchEnabled && 'text-foreground'
              )}
            >
              <Search className="size-4" />
              Search
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.txt,.md,.docx,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(event) => {
                if (event.target.files) {
                  setFiles(event.target.files)
                }
              }}
            />

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="liquid-metal-control rounded-full border-0 px-3 shadow-none"
            >
              <Paperclip className="size-4" />
              Attach
            </Button>

            <span className="ml-auto text-[11px] text-muted-foreground">
              {sectionLabel}
            </span>
          </div>

          {selectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedFiles.map((file, index) => (
                <AttachmentChip
                  key={`${file.name}-${index}`}
                  file={file}
                  onRemove={() => {
                    const remaining = selectedFiles.filter((_, fileIndex) => fileIndex !== index)
                    if (remaining.length === 0) {
                      setFiles(undefined)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                      return
                    }

                    const dataTransfer = new DataTransfer()
                    remaining.forEach((remainingFile) => dataTransfer.items.add(remainingFile))
                    setFiles(dataTransfer.files)
                  }}
                />
              ))}
            </div>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault()
              handleSubmit(input)
            }}
            className="flex items-end gap-3"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{searchEnabled ? 'Web search enabled for this message' : 'Compose a message'}</span>
                {messages.length > 0 && (
                  <span className="rounded-full bg-background/70 px-1.5 py-0.5 tabular-nums">
                    {messages.length}
                  </span>
                )}
              </div>
              <input
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onFocus={() => setIsExpanded(true)}
                placeholder={contextTitle}
                disabled={isLoading}
                aria-label={contextTitle}
                className="mt-1 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
              />
            </div>

            <div className="flex items-center gap-2">
              <kbd className="rounded-md border border-border/60 bg-background/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                ⌘J
              </kbd>
              <Button
                type="submit"
                size="icon-sm"
                disabled={(!input.trim() && selectedFiles.length === 0) || isLoading}
                className="liquid-metal-button size-10 rounded-full"
              >
                {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                <span className="sr-only">Send</span>
              </Button>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
