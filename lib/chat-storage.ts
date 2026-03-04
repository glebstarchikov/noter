import type { UIMessage } from 'ai'

const STORAGE_KEY_PREFIX = 'noter-chat-'
const INDEX_KEY = 'noter-chat-index'
const MAX_STORED_CHATS = 50

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

  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + meetingId, JSON.stringify(messages))

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
      localStorage.setItem(STORAGE_KEY_PREFIX + meetingId, JSON.stringify(messages))
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
