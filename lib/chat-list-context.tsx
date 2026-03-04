'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ChatListItem } from '@/lib/types'

interface ChatListContextValue {
  chats: ChatListItem[]
  isLoading: boolean
  refresh: () => Promise<void>
  addChat: (chat: ChatListItem) => void
}

const ChatListContext = createContext<ChatListContextValue | null>(null)

export function ChatListProvider({ children }: { children: React.ReactNode }) {
  const [chats, setChats] = useState<ChatListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/chats', { cache: 'no-store' })
      if (!response.ok) return
      const payload = (await response.json()) as { chats?: ChatListItem[] }
      setChats(payload.chats ?? [])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const addChat = useCallback((chat: ChatListItem) => {
    setChats((prev) => [chat, ...prev.filter((item) => item.id !== chat.id)].slice(0, 50))
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onChatCreated = () => {
      void refresh()
    }

    window.addEventListener('chat-created', onChatCreated)
    return () => window.removeEventListener('chat-created', onChatCreated)
  }, [refresh])

  const value = useMemo(
    () => ({ chats, isLoading, refresh, addChat }),
    [addChat, chats, isLoading, refresh]
  )

  return <ChatListContext.Provider value={value}>{children}</ChatListContext.Provider>
}

export function useChatList() {
  const context = useContext(ChatListContext)
  if (!context) {
    throw new Error('useChatList must be used within ChatListProvider')
  }

  return context
}
