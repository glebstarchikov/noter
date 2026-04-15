import type { UIMessage } from 'ai'
import {
  clearChatMessages,
  clearGlobalChatMessages,
  clearSupportChatMessages,
  getChatMessages,
  getGlobalChatMessages,
  getSupportChatMessages,
  saveChatMessages,
  saveGlobalChatMessages,
  saveSupportChatMessages,
} from '@/lib/chat/chat-storage'
import type { ChatSurfaceScope } from '@/lib/types'

export function getStoredMessages(scope: ChatSurfaceScope, meetingId?: string | null) {
  if (scope === 'support') return getSupportChatMessages()
  if (scope === 'global') return getGlobalChatMessages()
  if (!meetingId) return undefined
  return getChatMessages(meetingId)
}

export function saveStoredMessages(scope: ChatSurfaceScope, messages: UIMessage[], meetingId?: string | null) {
  if (scope === 'support') {
    saveSupportChatMessages(messages)
    return
  }
  if (scope === 'global') {
    saveGlobalChatMessages(messages)
    return
  }
  if (meetingId) {
    saveChatMessages(meetingId, messages)
  }
}

export function clearStoredMessages(scope: ChatSurfaceScope, meetingId?: string | null) {
  if (scope === 'support') {
    clearSupportChatMessages()
    return
  }
  if (scope === 'global') {
    clearGlobalChatMessages()
    return
  }
  if (meetingId) {
    clearChatMessages(meetingId)
  }
}

export function getErrorMessage(error: Error | undefined): string | null {
  if (!error) return null

  if (error.message.includes('429') || error.message.includes('Too Many')) {
    return 'You are sending messages too quickly. Please wait a moment.'
  }

  if (error.message.includes('No meetings')) {
    return 'There are no notes to search yet.'
  }

  return 'Something went wrong. Please try again.'
}

export function getComposerPrompt(scope: ChatSurfaceScope): string {
  if (scope === 'support') return 'Ask about noter...'
  if (scope === 'meeting') return 'Ask about this note...'
  return 'Ask across your notes...'
}

export function getActiveContextLabel(scope: ChatSurfaceScope): string {
  if (scope === 'meeting') return 'This note'
  if (scope === 'global') return 'All notes'
  return 'Support'
}

export function getEmptyStateDescription(scope: ChatSurfaceScope): string {
  if (scope === 'support') {
    return 'Ask about setup, uploads, and how to use noter.'
  }
  if (scope === 'meeting') {
    return 'Start from the current note to summarize it, extract actions, or inspect decisions.'
  }
  return 'Use global chat to connect patterns across notes, track action items, and spot recurring themes.'
}

export function getContextDescription(scope: ChatSurfaceScope, fileCount: number, allowGlobalToggle: boolean): string {
  const fileMessage =
    fileCount > 0
      ? `${fileCount} attached ${fileCount === 1 ? 'file is' : 'files are'} added to your next message.`
      : 'No files are attached yet.'

  if (scope === 'meeting') {
    return allowGlobalToggle
      ? `Ground answers in the current note or switch to all notes. ${fileMessage}`
      : `Ground answers in the current note. ${fileMessage}`
  }

  if (scope === 'global') {
    return `Ground answers across every note in your workspace. ${fileMessage}`
  }

  return 'Support mode answers questions about noter only.'
}

export function getMessageText(message: UIMessage): string {
  if (!Array.isArray(message.parts)) return ''
  return message.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('')
}
