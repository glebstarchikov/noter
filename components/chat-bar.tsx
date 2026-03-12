'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type FileUIPart, type UIMessage } from 'ai'
import ReactMarkdown from 'react-markdown'
import {
  AlertCircle,
  Check,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  Paperclip,
  Search,
  Send,
  X,
} from 'lucide-react'
import {
  CHAT_MODEL_OPTIONS,
  DEFAULT_CHAT_MODEL,
  getChatModelLabel,
  type ChatModelId,
} from '@/lib/ai-models'
import { ChatMessageAttachments } from '@/components/chat-message-attachments'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  clearStoredMessages,
  getActiveContextLabel,
  getComposerPrompt,
  getContextDescription,
  getEmptyStateDescription,
  getErrorMessage,
  getMessageText,
  getStoredMessages,
  saveStoredMessages,
} from '@/lib/chat-ui-helpers'
import type { ChatSurfaceScope } from '@/lib/types'
import { cn } from '@/lib/utils'

interface ChatBarProps {
  authenticated: boolean
  allowGlobalToggle?: boolean
  defaultScope: ChatSurfaceScope
  meetingId?: string | null
}

const STARTER_PROMPTS: Record<ChatSurfaceScope, string[]> = {
  support: [
    'How do I get started with noter?',
    'How do I upload a meeting?',
    'How do I use the dashboard?',
  ],
  meeting: [
    'Summarize this note',
    'List action items from this note',
    'Extract key decisions from this note',
  ],
  global: [
    'Summarize notes from this week',
    'List all action items across notes',
    'Find recurring themes across notes',
  ],
}


function ContextChip({ label }: { label: string }) {
  return (
    <div className="liquid-glass-context-chip flex items-center rounded-full px-3 py-1.5 text-xs font-medium text-foreground">
      {label}
    </div>
  )
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
    <div className="liquid-glass-chip flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-muted-foreground">
      {isImage ? <ImageIcon className="size-3.5" /> : <FileText className="size-3.5" />}
      <span className="max-w-32 truncate">{filename}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full text-muted-foreground transition-colors hover:text-foreground"
          aria-label={`Remove ${filename}`}
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  )
}

export function ChatBar({
  authenticated,
  allowGlobalToggle = false,
  defaultScope,
  meetingId,
}: ChatBarProps) {
  const isMobile = useIsMobile()
  const [activeScope, setActiveScope] = useState<ChatSurfaceScope>(defaultScope)
  const [input, setInput] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [model, setModel] = useState<ChatModelId>(DEFAULT_CHAT_MODEL)
  const [searchEnabled, setSearchEnabled] = useState(false)
  const [files, setFiles] = useState<FileList | undefined>(undefined)
  const [hasHydratedMessages, setHasHydratedMessages] = useState(false)
  const [spacerHeight, setSpacerHeight] = useState(96)
  const shellRef = useRef<HTMLDivElement>(null)
  const dockButtonRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setActiveScope(defaultScope)
  }, [defaultScope, meetingId])

  const transport = useMemo(() => {
    if (activeScope === 'support') {
      return new DefaultChatTransport({ api: '/api/chat/support' })
    }

    if (activeScope === 'global') {
      return new DefaultChatTransport({ api: '/api/chat/global' })
    }

    return new DefaultChatTransport({
      api: '/api/chat',
      body: meetingId ? { meetingId } : undefined,
    })
  }, [activeScope, meetingId])

  const chatId = useMemo(() => {
    if (activeScope === 'support') return '__support__'
    if (activeScope === 'global') return '__global__'
    return meetingId ?? '__global__'
  }, [activeScope, meetingId])

  const { messages, sendMessage, setMessages, status, error } = useChat({
    id: chatId,
    transport,
  })

  const resetComposer = useCallback(() => {
    setInput('')
    setFiles(undefined)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  useEffect(() => {
    resetComposer()
  }, [activeScope, resetComposer])

  useEffect(() => {
    setHasHydratedMessages(false)
    const storedMessages = getStoredMessages(activeScope, meetingId)
    setMessages(storedMessages ?? [])
    setHasHydratedMessages(true)
  }, [activeScope, meetingId, setMessages])

  useEffect(() => {
    if (!hasHydratedMessages || messages.length === 0) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveStoredMessages(activeScope, messages, meetingId)
    }, 300)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [activeScope, hasHydratedMessages, meetingId, messages])

  useEffect(() => {
    if (!isExpanded) return

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [isExpanded])

  useEffect(() => {
    if (!isExpanded) return

    const frame = window.requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ block: 'end' })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [isExpanded, messages, status])

  useEffect(() => {
    const measureShell = () => {
      const nextHeight = shellRef.current?.getBoundingClientRect().height
      if (!nextHeight) return
      setSpacerHeight(Math.ceil(nextHeight) + 24)
    }

    measureShell()
    window.addEventListener('resize', measureShell)

    return () => window.removeEventListener('resize', measureShell)
  }, [isExpanded, isMobile])

  useEffect(() => {
    document.documentElement.style.setProperty('--floating-chatbar-offset', `${spacerHeight}px`)

    return () => {
      document.documentElement.style.removeProperty('--floating-chatbar-offset')
    }
  }, [spacerHeight])

  const collapse = useCallback(() => {
    setIsExpanded(false)
    window.requestAnimationFrame(() => {
      dockButtonRef.current?.focus()
    })
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
        event.preventDefault()
        if (isExpanded) {
          collapse()
        } else {
          setIsExpanded(true)
        }
      }

      if (event.key === 'Escape' && isExpanded) {
        event.preventDefault()
        collapse()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [collapse, isExpanded])

  useEffect(() => {
    if (!isExpanded) return

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (shellRef.current?.contains(target)) return
      if (target.closest('[data-slot=dropdown-menu-content]')) return
      if (target.closest('[data-radix-popper-content-wrapper]')) return
      if (target.closest('[data-slot=popover-content]')) return
      collapse()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [collapse, isExpanded])

  const isLoading = status === 'submitted' || status === 'streaming'
  const isStreaming = status === 'streaming'
  const canAttach = authenticated && activeScope !== 'support'
  const canUseTools = activeScope !== 'support'
  const canShowContext = activeScope !== 'support'
  const selectedFiles = useMemo(() => (files ? Array.from(files) : []), [files])
  const submitDisabled = isLoading || (!input.trim() && selectedFiles.length === 0)
  const errorMessage = getErrorMessage(error)
  const prompt = getComposerPrompt(activeScope)
  const activeContextLabel = getActiveContextLabel(activeScope)
  const starterPrompts = STARTER_PROMPTS[activeScope]
  const showContextRow = canShowContext || selectedFiles.length > 0

  const handleClearChat = useCallback(() => {
    clearStoredMessages(activeScope, meetingId)
    setMessages([])
  }, [activeScope, meetingId, setMessages])

  const handleSubmit = useCallback(
    (text: string) => {
      const trimmedText = text.trim()
      const hasAttachments = canAttach && Boolean(files?.length)
      if (isLoading || (!trimmedText && !hasAttachments)) return

      const payload =
        hasAttachments
          ? trimmedText
            ? { text: trimmedText, files }
            : { files: files as FileList }
          : { text: trimmedText }

      void sendMessage(payload, {
        body:
          activeScope === 'support'
            ? undefined
            : {
                model,
                searchEnabled,
              },
      })

      resetComposer()
    },
    [activeScope, canAttach, files, isLoading, model, resetComposer, searchEnabled, sendMessage]
  )

  const handleStarterPrompt = useCallback(
    (starterPrompt: string) => {
      handleSubmit(starterPrompt)
    },
    [handleSubmit]
  )

  const removeSelectedFile = useCallback(
    (index: number) => {
      const remainingFiles = selectedFiles.filter((_, fileIndex) => fileIndex !== index)
      if (remainingFiles.length === 0) {
        setFiles(undefined)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        return
      }

      const nextFiles = new DataTransfer()
      remainingFiles.forEach((remainingFile) => nextFiles.items.add(remainingFile))
      setFiles(nextFiles.files)
    },
    [selectedFiles]
  )

  return (
    <>
      <div aria-hidden="true" style={{ height: spacerHeight }} />

      <section
        role="region"
        aria-label="Chat with noter"
        className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-2 md:px-4"
        style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div
          ref={shellRef}
          data-slot="chatbar-shell"
          data-state={isExpanded ? 'expanded' : 'collapsed'}
          data-generating={isLoading ? 'true' : 'false'}
          className={cn(
            'liquid-glass-shell pointer-events-auto flex w-[calc(100vw-1rem)] max-w-[44rem] flex-col overflow-hidden rounded-[30px] transition-[height,transform,box-shadow,border-color] duration-200 ease-out',
            isExpanded ? 'h-[min(70vh,32rem)]' : 'h-16'
          )}
        >
          {isExpanded ? (
            <div className="relative flex min-h-0 flex-1 flex-col">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost-icon"
                    size="icon-sm"
                    onClick={collapse}
                    aria-label="Close"
                    className="liquid-glass-control absolute right-3 top-3 z-10 rounded-full border border-border/40"
                  >
                    <X />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Close</TooltipContent>
              </Tooltip>

              <ScrollArea className="min-h-0 flex-1">
                <div
                  className={cn(
                    'flex min-h-full flex-col gap-4 px-4 pb-2 pt-14',
                    messages.length === 0 && !isLoading ? 'justify-center' : 'justify-end'
                  )}
                >
                  {messages.length === 0 && !isLoading ? (
                    <Empty className="mx-auto w-full max-w-[36rem] border-0 bg-transparent p-0">
                      <EmptyHeader className="max-w-none items-start gap-2 text-left">
                        <EmptyTitle className="text-base">Start with a prompt</EmptyTitle>
                        <EmptyDescription className="max-w-xl text-left">
                          {getEmptyStateDescription(activeScope)}
                        </EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent className="max-w-none items-stretch">
                        <div className="grid gap-2 sm:grid-cols-2">
                          {starterPrompts.map((starterPrompt) => (
                            <Button
                              key={starterPrompt}
                              type="button"
                              variant="ghost"
                              onClick={() => handleStarterPrompt(starterPrompt)}
                              className="liquid-glass-prompt h-auto justify-start rounded-[20px] px-4 py-3 text-left whitespace-normal"
                            >
                              {starterPrompt}
                            </Button>
                          ))}
                        </div>
                      </EmptyContent>
                    </Empty>
                  ) : (
                    <div role="log" aria-live="polite" className="flex flex-col gap-4">
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
                            <span className="px-1 text-[11px] text-muted-foreground">
                              {message.role === 'user' ? 'You' : 'noter'}
                            </span>

                            <ChatMessageAttachments message={message} />

                            {text ? (
                              <div
                                className={cn(
                                  'max-w-[90%] rounded-[24px] px-4 py-3 text-sm leading-7',
                                  message.role === 'user'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'border border-border/60 bg-background/55 text-foreground'
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
                            ) : null}
                          </div>
                        )
                      })}

                      {isLoading ? (
                        <div className="flex items-start">
                          <div className="flex max-w-[90%] items-center gap-2 rounded-[24px] border border-border/60 bg-background/55 px-4 py-3 text-sm text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" />
                            {isStreaming ? 'Writing a response...' : 'Thinking...'}
                          </div>
                        </div>
                      ) : null}

                      <div ref={endRef} />
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="px-3 pb-3 pt-2">
                {errorMessage ? (
                  <Alert variant="destructive" className="mb-3 border-destructive/20 bg-destructive/5">
                    <AlertCircle />
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                ) : null}

                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    handleSubmit(input)
                  }}
                >
                  <InputGroup className="liquid-glass-input h-auto rounded-[26px] border-border/60 shadow-none">
                    <InputGroupTextarea
                      ref={inputRef}
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onFocus={() => setIsExpanded(true)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault()
                          handleSubmit(input)
                        }
                      }}
                      placeholder={prompt}
                      disabled={isLoading}
                      aria-label={prompt}
                      className="min-h-[3.5rem] max-h-32 overflow-y-auto px-4 py-3 text-sm leading-6"
                    />

                    {showContextRow ? (
                      <div className="flex flex-wrap gap-2 px-3 pb-2">
                        {canShowContext ? <ContextChip label={activeContextLabel} /> : null}
                        {selectedFiles.map((file, index) => (
                          <AttachmentChip
                            key={`${file.name}-${index}`}
                            file={file}
                            onRemove={() => removeSelectedFile(index)}
                          />
                        ))}
                      </div>
                    ) : null}

                    <InputGroupAddon align="block-end" className="flex-wrap gap-2 pt-2">
                      {canShowContext ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <InputGroupButton
                              variant="ghost"
                              size="sm"
                              className="liquid-glass-control border border-border/40"
                            >
                              Context
                              <ChevronDown data-icon="inline-end" />
                            </InputGroupButton>
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            className="liquid-glass-popover w-[18rem] rounded-[24px] border-border/40 p-4"
                          >
                            <div className="flex flex-col gap-4">
                              <div className="flex flex-col gap-1">
                                <p className="text-sm font-medium text-foreground">Active context</p>
                                <p className="text-sm leading-6 text-muted-foreground">
                                  {getContextDescription(activeScope, selectedFiles.length, allowGlobalToggle)}
                                </p>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <ContextChip label={activeContextLabel} />
                                {selectedFiles.length > 0 ? (
                                  <Badge variant="outline" className="rounded-full">
                                    {selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'}
                                  </Badge>
                                ) : null}
                              </div>

                              {allowGlobalToggle ? (
                                <>
                                  <Separator />
                                  <div className="flex flex-col gap-2">
                                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                      Scope
                                    </p>
                                    <ToggleGroup
                                      type="single"
                                      variant="outline"
                                      size="sm"
                                      value={activeScope === 'meeting' ? 'meeting' : 'global'}
                                      onValueChange={(value) => {
                                        if (value === 'meeting' || value === 'global') {
                                          setActiveScope(value)
                                        }
                                      }}
                                      aria-label="Chat scope"
                                      className="liquid-glass-toolbar w-full"
                                    >
                                      <ToggleGroupItem value="meeting" aria-label="This note">
                                        This note
                                      </ToggleGroupItem>
                                      <ToggleGroupItem value="global" aria-label="All notes">
                                        All notes
                                      </ToggleGroupItem>
                                    </ToggleGroup>
                                  </div>
                                </>
                              ) : null}
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : null}

                      {canAttach ? (
                        <>
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
                          <InputGroupButton
                            variant="ghost"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="liquid-glass-control border border-border/40"
                          >
                            <Paperclip data-icon="inline-start" />
                            Add files
                          </InputGroupButton>
                        </>
                      ) : null}

                      {canUseTools ? (
                        <>
                          <InputGroupButton
                            variant={searchEnabled ? 'secondary' : 'ghost'}
                            size="sm"
                            aria-pressed={searchEnabled}
                            data-active={searchEnabled ? 'true' : 'false'}
                            onClick={() => setSearchEnabled((current) => !current)}
                            className="liquid-glass-control border border-border/40"
                          >
                            <Search data-icon="inline-start" />
                            Search web
                            {searchEnabled ? <Check data-icon="inline-end" /> : null}
                          </InputGroupButton>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <InputGroupButton
                                variant="ghost"
                                size="sm"
                                className="liquid-glass-control border border-border/40"
                              >
                                {getChatModelLabel(model)}
                                <ChevronDown data-icon="inline-end" />
                              </InputGroupButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-52">
                              <DropdownMenuRadioGroup
                                value={model}
                                onValueChange={(value) => setModel(value as ChatModelId)}
                              >
                                {CHAT_MODEL_OPTIONS.map((option) => (
                                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                                    {option.label}
                                  </DropdownMenuRadioItem>
                                ))}
                              </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      ) : null}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <InputGroupButton
                            variant="ghost"
                            size="icon-sm"
                            aria-label="More chat actions"
                            className="liquid-glass-control border border-border/40"
                          >
                            <MoreHorizontal />
                          </InputGroupButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            disabled={messages.length === 0}
                            onSelect={() => handleClearChat()}
                          >
                            Clear conversation
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <InputGroupButton
                            type="submit"
                            variant="default"
                            size="icon-sm"
                            disabled={submitDisabled}
                            aria-label="Send message"
                            className="liquid-glass-button ml-auto"
                          >
                            {isLoading ? <Loader2 className="animate-spin" /> : <Send />}
                          </InputGroupButton>
                        </TooltipTrigger>
                        <TooltipContent side="top">Send message</TooltipContent>
                      </Tooltip>
                    </InputGroupAddon>
                  </InputGroup>
                </form>
              </div>
            </div>
          ) : (
            <button
              ref={dockButtonRef}
              type="button"
              onClick={() => setIsExpanded(true)}
              className="liquid-glass-dock flex h-full w-full items-center justify-between gap-4 rounded-[30px] px-4 text-left transition-transform"
              aria-expanded="false"
              aria-label="Open chat"
            >
              <span className="truncate text-sm text-muted-foreground">{prompt}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">⌘J</span>
            </button>
          )}
        </div>
      </section>
    </>
  )
}
