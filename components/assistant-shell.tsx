'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type FileUIPart } from 'ai'
import type { UIMessage } from 'ai'
import ReactMarkdown from 'react-markdown'
import {
  AudioLines,
  CopyPlus,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Minimize2,
  Paperclip,
  Pause,
  Play,
  Search,
  Send,
  Square,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ChatMessageAttachments } from '@/components/chat-message-attachments'
import {
  clearChatMessages,
  clearGlobalChatMessages,
  getChatMessages,
  getGlobalChatMessages,
  saveChatMessages,
  saveGlobalChatMessages,
} from '@/lib/chat-storage'
import { cn } from '@/lib/utils'
import { useAssistantShellContext } from '@/components/assistant-shell-context'

type ModelTier = 'fast' | 'balanced' | 'premium'

const GLOBAL_PROMPTS = [
  'List my todos',
  'Write weekly update',
  'Summarize recent decisions',
  'Draft follow-up email',
] as const

const MEETING_PROMPTS = [
  'Write follow up email',
  'List action items',
  'Write tl;dr',
  'Make notes longer',
] as const

function getMessageText(message: UIMessage) {
  if (!Array.isArray(message.parts)) return ''
  return message.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('')
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function AttachmentChip({
  file,
  onRemove,
}: {
  file: File | FileUIPart
  onRemove?: () => void
}) {
  const filename = 'name' in file ? file.name : file.filename || 'attachment'
  const mediaType = file instanceof File ? file.type : file.mediaType
  const isImage = mediaType.startsWith('image/')

  return (
    <div className="flex items-center gap-2 rounded-full border border-white/45 bg-white/55 px-3 py-1.5 text-xs text-foreground/70 shadow-[0_8px_20px_-18px_rgba(15,23,42,0.28)]">
      {isImage ? <ImageIcon className="size-3.5" /> : <FileText className="size-3.5" />}
      <span className="max-w-40 truncate">{filename}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full text-foreground/55 transition-colors hover:text-foreground"
          aria-label={`Remove ${filename}`}
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

function TranscriptBubbles({
  segments,
}: {
  segments: Array<{ speaker: string; text: string; isFinal?: boolean }>
}) {
  const speakerOrder = new Map<string, number>()

  return (
    <div className="flex flex-col gap-4">
      {segments.map((segment, index) => {
        if (!speakerOrder.has(segment.speaker)) {
          speakerOrder.set(segment.speaker, speakerOrder.size)
        }

        const speakerIndex = speakerOrder.get(segment.speaker) ?? 0
        const alignRight = speakerIndex % 2 === 1

        return (
          <div
            key={`${segment.speaker}-${index}-${segment.text}`}
            className={cn('flex flex-col gap-1.5', alignRight ? 'items-end' : 'items-start')}
          >
            <span className="px-1 text-[11px] font-medium text-foreground/45">
              {segment.speaker}
            </span>
            <div
              className={cn(
                'max-w-[82%] rounded-[24px] px-4 py-3 text-[15px] leading-7 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.24)]',
                alignRight
                  ? 'rounded-br-[10px] bg-[oklch(0.88_0.05_110/0.75)] text-foreground/88'
                  : 'rounded-bl-[10px] bg-white/70 text-foreground/86',
                segment.isFinal === false && 'opacity-65'
              )}
            >
              {segment.text}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function AssistantShell() {
  const pathname = usePathname()
  const { mode, setMode, meetingContext } = useAssistantShellContext()
  const [input, setInput] = useState('')
  const [modelTier, setModelTier] = useState<ModelTier>('balanced')
  const [searchEnabled, setSearchEnabled] = useState(false)
  const [files, setFiles] = useState<FileList | undefined>(undefined)
  const [hasHydratedMessages, setHasHydratedMessages] = useState(false)
  const [composerFocused, setComposerFocused] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const routeMeetingId = useMemo(() => {
    const match = pathname.match(/^\/dashboard\/([^/]+)$/)
    if (!match) return null

    return ['new', 'templates'].includes(match[1]) ? null : match[1]
  }, [pathname])
  const meetingId = meetingContext?.meetingId ?? routeMeetingId
  const isGlobal = !meetingId
  const chatId = meetingId ?? '__global__'
  const prompts = isGlobal ? GLOBAL_PROMPTS : MEETING_PROMPTS
  const showTranscriptDock = Boolean(
    meetingContext &&
      (meetingContext.recordingPhase === 'recording' ||
        meetingContext.recordingPhase === 'stopping' ||
        meetingContext.recordingPhase === 'setup' ||
        meetingContext.transcriptAvailable)
  )
  const isExpanded = mode !== 'collapsed'
  const isTranscriptMode = mode === 'transcript'
  const showPromptChips = isExpanded || composerFocused
  const showSlashMenu = mode === 'chat' && input.trimStart().startsWith('/')

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
  }, [chatId, isGlobal, setMessages])

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

  useEffect(() => {
    setMode('collapsed')
    setInput('')
    setComposerFocused(false)
    setSearchEnabled(false)
    setFiles(undefined)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [pathname, setMode])

  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [isExpanded, messages, status])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
        event.preventDefault()
        setMode('chat')
        setTimeout(() => inputRef.current?.focus(), 50)
      }

      if (event.key === 'Escape' && isExpanded) {
        setMode('collapsed')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isExpanded, setMode])

  const isLoading = status === 'streaming' || status === 'submitted'
  const contextTitle = isGlobal
    ? 'Ask noter'
    : meetingContext?.meetingTitle
      ? `Ask noter about ${meetingContext.meetingTitle}`
      : 'Ask noter about this note'
  const transcriptTitle = meetingContext?.meetingTitle ?? 'Transcript'
  const selectedFiles = files ? Array.from(files) : []

  const resetComposer = useCallback(() => {
    setInput('')
    setSearchEnabled(false)
    setFiles(undefined)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handleSend = useCallback(
    (text: string) => {
      if ((!text.trim() && !files?.length) || isLoading) return

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

      setMode('chat')
      resetComposer()
    },
    [files, isLoading, modelTier, resetComposer, searchEnabled, sendMessage, setMode]
  )

  const handlePromptSelection = useCallback(
    (prompt: string) => {
      handleSend(prompt)
    },
    [handleSend]
  )

  const handleClearChat = useCallback(() => {
    if (isGlobal) clearGlobalChatMessages()
    else clearChatMessages(chatId)
    setMessages([])
  }, [chatId, isGlobal, setMessages])

  const transcriptSegments = meetingContext?.transcriptSegments ?? []
  const showTranscriptEmptyState =
    isTranscriptMode && transcriptSegments.length === 0 && !meetingContext?.transcriptText
  const recordingPhase = meetingContext?.recordingPhase ?? 'done'
  const isTranscriptPaused = meetingContext?.isPaused ?? false
  const transcriptDuration = meetingContext?.durationSeconds ?? 0
  const recordSystemAudio = meetingContext?.recordSystemAudio ?? false
  const handleToggleRecordSystemAudio = meetingContext?.onToggleRecordSystemAudio
  const handleStartRecording = meetingContext?.onStartRecording
  const handleTogglePause = meetingContext?.onTogglePause
  const handleStopRecording = meetingContext?.onStop

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] md:px-6 md:pb-6">
      <div
        className={cn(
          'pointer-events-auto transition-[width,height,transform,border-radius,box-shadow,opacity] duration-300 ease-out',
          isExpanded
            ? 'w-full max-w-[min(960px,calc(100vw-64px))]'
            : 'w-full max-w-[min(820px,calc(100vw-32px))]'
        )}
      >
        <div
          className={cn(
            'liquid-glass-shell mx-auto overflow-hidden',
            isExpanded
              ? 'min-h-[min(78vh,820px)] rounded-[34px]'
              : 'rounded-[40px]'
          )}
        >
          {!isExpanded ? (
            <div className="flex items-center gap-3 p-3">
              {showTranscriptDock && (
                <button
                  type="button"
                  onClick={() => setMode('transcript')}
                  className="liquid-glass-orb relative flex size-16 shrink-0 items-center justify-center rounded-full"
                  aria-label="Open transcript"
                >
                  <AudioLines className="size-6 text-foreground/70" />
                  {meetingContext?.live && (
                    <span className="absolute inset-0 rounded-full">
                      <span className="absolute inset-0 animate-ping rounded-full bg-accent/15" />
                    </span>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => setMode('chat')}
                className={cn(
                  'liquid-glass-dock flex min-h-16 flex-1 items-center justify-between gap-3 rounded-[36px] px-5 py-3 text-left',
                  !showTranscriptDock && 'justify-start'
                )}
                aria-label="Open assistant"
              >
                <span className="truncate text-[17px] text-foreground/55">
                  Ask noter
                </span>
                {showTranscriptDock && (
                  <span className="liquid-glass-chip hidden items-center gap-2 rounded-full px-4 py-2 text-sm text-foreground/80 sm:inline-flex">
                    <span className="inline-flex size-5 items-center justify-center rounded-lg bg-[linear-gradient(135deg,rgba(168,215,255,0.95),rgba(162,178,255,0.9))] text-[15px] font-semibold text-slate-900">
                      /
                    </span>
                    {prompts[0]}
                  </span>
                )}
              </button>
            </div>
          ) : isTranscriptMode ? (
            <div className="flex min-h-[min(78vh,820px)] flex-col">
              <div className="flex items-center justify-between border-b border-white/30 px-6 py-5">
                <div className="space-y-1">
                  <div className="text-xl font-semibold text-foreground/90">
                    {transcriptTitle}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-foreground/55">
                    {meetingContext?.live ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="relative flex size-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent" />
                          <span className="relative inline-flex size-2 rounded-full bg-accent" />
                        </span>
                        Live transcript
                      </span>
                    ) : (
                      <span>Transcript</span>
                    )}
                    <span className="font-mono tabular-nums text-foreground/45">
                      {formatTime(transcriptDuration)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setMode('chat')}
                    className="liquid-glass-control h-11 rounded-full px-4 text-sm shadow-none"
                  >
                    <MessageSquare className="size-4" />
                    Ask noter
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setMode('collapsed')}
                    className="liquid-glass-control rounded-full shadow-none"
                  >
                    <Minimize2 className="size-4" />
                    <span className="sr-only">Collapse assistant</span>
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6">
                {showTranscriptEmptyState ? (
                  <div className="flex h-full items-center justify-center text-center text-[17px] text-foreground/45">
                    Transcript will appear here once recording starts.
                  </div>
                ) : (
                  <TranscriptBubbles segments={transcriptSegments} />
                )}
              </div>

              <div className="border-t border-white/30 px-6 py-4">
                <div className="liquid-glass-toolbar flex flex-wrap items-center gap-3 rounded-[28px] px-4 py-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="liquid-glass-orb flex size-11 items-center justify-center rounded-full">
                      <AudioLines className="size-5 text-foreground/75" />
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground/88">
                        {recordingPhase === 'setup'
                          ? 'Ready to record'
                          : recordingPhase === 'stopping'
                            ? 'Saving your recording…'
                            : recordingPhase === 'done'
                              ? 'Recording complete'
                              : isTranscriptPaused
                                ? 'Recording paused'
                                : 'Recording live'}
                      </div>
                      <div className="truncate text-sm text-foreground/50">
                        {recordingPhase === 'setup'
                          ? 'Open recording here and keep your note visible.'
                          : recordingPhase === 'done'
                            ? 'Switch back to the assistant whenever you want.'
                            : 'Transcript is flowing into this view.'}
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setMode('chat')}
                    className="liquid-glass-control h-11 rounded-full px-4 shadow-none"
                  >
                    <MessageSquare className="size-4" />
                    Ask noter
                  </Button>

                  {recordingPhase === 'setup' && (
                    <>
                      <div className="flex items-center gap-2 rounded-full border border-white/45 bg-white/40 px-3 py-2">
                        <Switch
                          id="assistant-system-audio"
                          checked={recordSystemAudio}
                          onCheckedChange={(checked) => handleToggleRecordSystemAudio?.(checked)}
                        />
                        <Label
                          htmlFor="assistant-system-audio"
                          className="cursor-pointer text-sm text-foreground/72"
                        >
                          Include system audio
                        </Label>
                      </div>
                      <Button
                        type="button"
                        onClick={() => void handleStartRecording?.()}
                        className="liquid-glass-button h-11 rounded-full px-5"
                      >
                        <AudioLines className="size-4" />
                        Start recording
                      </Button>
                    </>
                  )}

                  {recordingPhase !== 'setup' && recordingPhase !== 'done' && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void handleTogglePause?.()}
                        disabled={recordingPhase === 'stopping'}
                        className="liquid-glass-control h-11 rounded-full px-4 shadow-none"
                      >
                        {isTranscriptPaused ? (
                          <Play className="size-4" />
                        ) : (
                          <Pause className="size-4" />
                        )}
                        {isTranscriptPaused ? 'Resume' : 'Pause'}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void handleStopRecording?.()}
                        disabled={recordingPhase === 'stopping'}
                        className="liquid-glass-button h-11 rounded-full px-5"
                      >
                        {recordingPhase === 'stopping' ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Square className="size-4" />
                        )}
                        {recordingPhase === 'stopping' ? 'Working…' : 'Stop'}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[min(78vh,820px)] flex-col">
              <div className="flex items-center justify-between border-b border-white/30 px-6 py-5">
                <div className="space-y-1">
                  <div className="text-xl font-semibold text-foreground/90">
                    {contextTitle}
                  </div>
                  <div className="text-sm text-foreground/55">
                    {isGlobal ? 'Across all notes' : 'This note'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearChat}
                    className="liquid-glass-control h-11 rounded-full px-4 shadow-none"
                  >
                    <CopyPlus className="size-4" />
                    New chat
                  </Button>
                  <Select
                    value={modelTier}
                    onValueChange={(value) => setModelTier(value as ModelTier)}
                  >
                    <SelectTrigger
                      size="sm"
                      className="liquid-glass-control h-11 min-w-32 rounded-full border-0 bg-transparent shadow-none"
                    >
                      <SelectValue placeholder="Balanced" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fast">Fast</SelectItem>
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                  {showTranscriptDock && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setMode('transcript')}
                      className="liquid-glass-control rounded-full shadow-none"
                    >
                      <AudioLines className="size-4" />
                      <span className="sr-only">Open transcript</span>
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setMode('collapsed')}
                    className="liquid-glass-control rounded-full shadow-none"
                  >
                    <Minimize2 className="size-4" />
                    <span className="sr-only">Collapse assistant</span>
                  </Button>
                </div>
              </div>

              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-6 py-6"
                role="log"
                aria-live="polite"
              >
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col justify-end gap-6">
                    <div className="space-y-4">
                      <div className="text-[15px] text-foreground/46">
                        {isGlobal
                          ? 'Ask across all of your notes, decisions, and follow-ups.'
                          : 'Ask for help with this meeting, its transcript, or your notes.'}
                      </div>
                      {showPromptChips && (
                        <div className="flex flex-wrap gap-2">
                          {prompts.map((prompt) => (
                            <button
                              key={prompt}
                              type="button"
                              onClick={() => handlePromptSelection(prompt)}
                              className="liquid-glass-chip inline-flex items-center gap-2 rounded-full px-4 py-2 text-[15px] text-foreground/80"
                            >
                              <span className="inline-flex size-6 items-center justify-center rounded-xl bg-[linear-gradient(135deg,rgba(196,238,170,0.95),rgba(146,214,182,0.85))] text-sm font-semibold text-slate-900">
                                /
                              </span>
                              {prompt}
                            </button>
                          ))}
                        </div>
                      )}
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
                          <span className="px-1 text-[11px] text-foreground/38">
                            {message.role === 'user' ? 'You' : 'noter'}
                          </span>

                          <ChatMessageAttachments message={message} />

                          {text && (
                            <div
                              className={cn(
                                'max-w-[86%] rounded-[28px] px-4 py-3 text-[15px] leading-7 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.24)]',
                                message.role === 'user'
                                  ? 'rounded-br-[10px] bg-white/72 text-foreground/85'
                                  : 'rounded-bl-[10px] bg-[oklch(0.95_0.008_95/0.74)] text-foreground/85'
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
                      <div className="flex items-start">
                        <div className="rounded-[24px] bg-white/65 px-4 py-3 text-sm text-foreground/58 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.24)]">
                          <div className="flex items-center gap-2">
                            <Loader2 className="size-4 animate-spin" />
                            {status === 'streaming' ? 'Writing a response…' : 'Thinking…'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-white/30 px-6 py-5">
                {showPromptChips && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {prompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => handlePromptSelection(prompt)}
                        className="liquid-glass-chip inline-flex items-center gap-2 rounded-full px-4 py-2 text-[15px] text-foreground/80"
                      >
                        <span className="inline-flex size-6 items-center justify-center rounded-xl bg-[linear-gradient(135deg,rgba(196,238,170,0.95),rgba(146,214,182,0.85))] text-sm font-semibold text-slate-900">
                          /
                        </span>
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}

                {error && (
                  <div className="mb-3 rounded-2xl border border-destructive/20 bg-destructive/6 px-4 py-3 text-sm text-destructive">
                    {error.message?.includes('429') || error.message?.includes('Too Many')
                      ? 'You are sending messages too quickly. Please wait a moment.'
                      : error.message?.includes('No meetings')
                        ? 'There are no notes to search yet.'
                        : 'Something went wrong. Please try again.'}
                  </div>
                )}

                {selectedFiles.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
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

                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    handleSend(input)
                  }}
                  className="relative"
                >
                  {showSlashMenu && (
                    <div className="absolute inset-x-0 bottom-full mb-3 rounded-[24px] border border-white/40 bg-white/78 p-3 shadow-[0_24px_50px_-26px_rgba(15,23,42,0.28)] backdrop-blur-2xl">
                      <div className="mb-2 text-xs uppercase tracking-[0.16em] text-foreground/38">
                        Suggestions
                      </div>
                      <div className="flex flex-col gap-1">
                        {prompts.map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => handlePromptSelection(prompt)}
                            className="flex items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm text-foreground/82 transition-colors hover:bg-white/70"
                          >
                            <span className="inline-flex size-7 items-center justify-center rounded-xl bg-[linear-gradient(135deg,rgba(196,238,170,0.95),rgba(146,214,182,0.85))] text-sm font-semibold text-slate-900">
                              /
                            </span>
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="liquid-glass-input flex items-end gap-3 rounded-[28px] px-4 py-3">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onFocus={() => {
                        setComposerFocused(true)
                        setMode('chat')
                      }}
                      onBlur={() => setComposerFocused(false)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault()
                          handleSend(input)
                        }
                      }}
                      placeholder={showSlashMenu ? 'Type / for prompts' : 'Ask anything'}
                      disabled={isLoading}
                      rows={1}
                      aria-label={contextTitle}
                      className="min-h-[72px] flex-1 resize-none bg-transparent px-1 py-2 text-[17px] leading-7 text-foreground/82 outline-none placeholder:text-foreground/42 disabled:opacity-50"
                    />

                    <div className="flex items-center gap-2 pb-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="liquid-glass-control rounded-full shadow-none"
                      >
                        <Paperclip className="size-4" />
                        <span className="sr-only">Attach file</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setSearchEnabled((value) => !value)}
                        className={cn(
                          'liquid-glass-control rounded-full shadow-none',
                          searchEnabled && 'text-foreground'
                        )}
                      >
                        <Search className="size-4" />
                        <span className="sr-only">Toggle search</span>
                      </Button>
                      <Button
                        type="submit"
                        size="icon-sm"
                        disabled={(!input.trim() && selectedFiles.length === 0) || isLoading}
                        className="liquid-glass-button rounded-full"
                      >
                        {isLoading ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Send className="size-4" />
                        )}
                        <span className="sr-only">Send</span>
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
