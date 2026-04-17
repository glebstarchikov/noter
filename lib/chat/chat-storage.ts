import { isFileUIPart, type UIMessage } from 'ai'
import {
  getMessageAttachmentMetadata,
  setMessageAttachmentMetadata,
  toChatAttachmentMetadata,
} from '@/lib/chat/chat-attachments'

const STORAGE_KEY_PREFIX = 'noter-chat-'
const INDEX_KEY = 'noter-chat-index'
const MAX_STORED_CHATS = 50
const GLOBAL_CHAT_KEY = `${STORAGE_KEY_PREFIX}__global__`
const SUPPORT_CHAT_KEY = `${STORAGE_KEY_PREFIX}__support__`

function isLocalStorageAvailable(): boolean {
  try {
    const key = '__noter_test__'
    localStorage.setItem(key, '1')
    localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

function getIndex(): string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function setIndex(index: string[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index))
  } catch {
    // Quota exceeded — silent fail
  }
}

function evictOldest(index: string[]): string[] {
  while (index.length >= MAX_STORED_CHATS) {
    const oldest = index.shift()
    if (oldest) {
      try {
        localStorage.removeItem(STORAGE_KEY_PREFIX + oldest)
      } catch {
        // silent
      }
    }
  }
  return index
}

function sanitizeMessages(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => {
    const parts = Array.isArray(message.parts) ? message.parts : []
    const liveAttachments = parts
      .filter(isFileUIPart)
      .map(toChatAttachmentMetadata)
    const existingAttachments = getMessageAttachmentMetadata(message)
    const attachments = [...existingAttachments, ...liveAttachments]
    const sanitizedMessage = setMessageAttachmentMetadata(message, attachments)

    return {
      ...sanitizedMessage,
      parts: parts.filter((part) => !isFileUIPart(part)),
    }
  })
}

function readMessagesForKey(storageKey: string): UIMessage[] | undefined {
  if (!isLocalStorageAvailable()) return undefined

  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return undefined
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as UIMessage[]) : undefined
  } catch {
    return undefined
  }
}

function writeMessagesForKey(storageKey: string, messages: UIMessage[]): void {
  if (!isLocalStorageAvailable()) return

  const sanitizedMessages = sanitizeMessages(messages)

  try {
    localStorage.setItem(storageKey, JSON.stringify(sanitizedMessages))
  } catch {
    // Quota exceeded — silent fail
  }
}

function removeMessagesForKey(storageKey: string): void {
  if (!isLocalStorageAvailable()) return

  try {
    localStorage.removeItem(storageKey)
  } catch {
    // silent
  }
}

export function getChatMessages(meetingId: string): UIMessage[] | undefined {
  if (!isLocalStorageAvailable()) return undefined

  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + meetingId)
    if (!raw) return undefined
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      clearChatMessages(meetingId)
      return undefined
    }
    return parsed as UIMessage[]
  } catch {
    clearChatMessages(meetingId)
    return undefined
  }
}

export function saveChatMessages(meetingId: string, messages: UIMessage[]): void {
  if (!isLocalStorageAvailable()) return

  const sanitizedMessages = sanitizeMessages(messages)

  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + meetingId, JSON.stringify(sanitizedMessages))

    // Update index (move this meetingId to the end = most recent)
    let index = getIndex().filter((id) => id !== meetingId)
    index = evictOldest(index)
    index.push(meetingId)
    setIndex(index)
  } catch {
    // Quota exceeded — try evicting and retrying once
    try {
      let index = getIndex()
      index = evictOldest(index)
      setIndex(index)
      localStorage.setItem(STORAGE_KEY_PREFIX + meetingId, JSON.stringify(sanitizedMessages))
    } catch {
      // Still failing — give up silently
    }
  }
}

export function clearChatMessages(meetingId: string): void {
  if (!isLocalStorageAvailable()) return

  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + meetingId)
    const index = getIndex().filter((id) => id !== meetingId)
    setIndex(index)
  } catch {
    // silent
  }
}

// --- Global chat storage (separate from meeting chats) ---

export function getGlobalChatMessages(): UIMessage[] | undefined {
  const messages = readMessagesForKey(GLOBAL_CHAT_KEY)
  if (messages) return messages

  removeMessagesForKey(GLOBAL_CHAT_KEY)
  return undefined
}

export function saveGlobalChatMessages(messages: UIMessage[]): void {
  writeMessagesForKey(GLOBAL_CHAT_KEY, messages)
}

export function clearGlobalChatMessages(): void {
  removeMessagesForKey(GLOBAL_CHAT_KEY)
}

export function getSupportChatMessages(): UIMessage[] | undefined {
  const messages = readMessagesForKey(SUPPORT_CHAT_KEY)
  if (messages) return messages

  removeMessagesForKey(SUPPORT_CHAT_KEY)
  return undefined
}

export function saveSupportChatMessages(messages: UIMessage[]): void {
  writeMessagesForKey(SUPPORT_CHAT_KEY, messages)
}

export function clearSupportChatMessages(): void {
  removeMessagesForKey(SUPPORT_CHAT_KEY)
}
