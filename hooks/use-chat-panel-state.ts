import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import type { UIMessage } from 'ai'
import {
  getChatMessages,
  saveChatMessages,
  clearChatMessages,
  getGlobalChatMessages,
  saveGlobalChatMessages,
  clearGlobalChatMessages,
} from '@/lib/chat-storage'

const GLOBAL_SUGGESTIONS = [
  'Pending action items',
  'Key decisions this week',
  'Recurring topics',
  'Overview of recent meetings',
]

const MEETING_SUGGESTIONS = [
  'Main takeaways',
  'Deadlines mentioned',
  'Action items by owner',
  'Key decisions',
]

export function getMessageText(msg: UIMessage): string {
  if (!msg.parts || !Array.isArray(msg.parts)) return ''
  return msg.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

export function useChatPanelState(meetingTitle?: string) {
  const pathname = usePathname()
  const [isExpanded, setIsExpanded] = useState(false)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const meetingId = useMemo(() => {
    const match = pathname.match(/^\/dashboard\/([^/]+)$/)
    return match ? match[1] : null
  }, [pathname])

  const isGlobal = !meetingId
  const chatId = meetingId ?? '__global__'

  const transport = useMemo(() => new DefaultChatTransport({
    api: isGlobal ? '/api/chat/global' : '/api/chat',
    ...(meetingId ? { body: { meetingId } } : {}),
  }), [isGlobal, meetingId])

  const storedMessages = useMemo(
    () => (isGlobal ? getGlobalChatMessages() : getChatMessages(chatId)),
    [isGlobal, chatId]
  )

  const { messages, sendMessage, setMessages, status, error } = useChat({
    id: chatId,
    transport,
    messages: storedMessages,
  })

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (messages.length === 0) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      if (isGlobal) saveGlobalChatMessages(messages)
      else saveChatMessages(chatId, messages)
    }, 500)
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [messages, isGlobal, chatId])

  const handleClearChat = useCallback(() => {
    if (isGlobal) clearGlobalChatMessages()
    else clearChatMessages(chatId)
    setMessages([])
  }, [chatId, isGlobal, setMessages])

  const isLoading = status === 'streaming' || status === 'submitted'
  const isStreaming = status === 'streaming'

  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isExpanded])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        setIsExpanded((prev) => !prev)
        setTimeout(() => inputRef.current?.focus(), 100)
      }
      if (e.key === 'Escape' && isExpanded) setIsExpanded(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isExpanded])

  useEffect(() => {
    if (!isExpanded) return
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsExpanded(false)
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isExpanded])

  const handleSubmit = useCallback((text: string) => {
    if (!text.trim() || isLoading) return
    if (!isExpanded) setIsExpanded(true)
    sendMessage({ text: text.trim() })
    setInput('')
  }, [isExpanded, isLoading, sendMessage])

  const contextLabel = isGlobal
    ? 'Ask across all meetings...'
    : meetingTitle
      ? `Ask about ${meetingTitle.length > 30 ? `${meetingTitle.slice(0, 30)}…` : meetingTitle}...`
      : 'Ask about this meeting...'

  return {
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
    suggestions: isGlobal ? GLOBAL_SUGGESTIONS : MEETING_SUGGESTIONS,
    contextLabel,
    handleSubmit,
    handleClearChat,
  }
}
