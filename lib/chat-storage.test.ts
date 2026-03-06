import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getChatMessages, saveChatMessages, clearChatMessages } from './chat-storage'
import type { UIMessage } from 'ai'

function makeMessage(id: string, role: 'user' | 'assistant', text: string): UIMessage {
  return {
    id,
    role,
    parts: [{ type: 'text', text }],
    createdAt: new Date(),
  } as UIMessage
}

describe('chat-storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('getChatMessages', () => {
    it('returns undefined when no messages stored', () => {
      expect(getChatMessages('meeting-1')).toBeUndefined()
    })

    it('returns stored messages', () => {
      const messages = [makeMessage('1', 'user', 'hello')]
      saveChatMessages('meeting-1', messages)

      const result = getChatMessages('meeting-1')
      expect(result).toHaveLength(1)
      expect(result![0].id).toBe('1')
    })

    it('returns undefined and clears corrupted data', () => {
      localStorage.setItem('noter-chat-meeting-1', 'not-json')
      expect(getChatMessages('meeting-1')).toBeUndefined()
      expect(localStorage.getItem('noter-chat-meeting-1')).toBeNull()
    })

    it('returns undefined and clears non-array data', () => {
      localStorage.setItem('noter-chat-meeting-1', JSON.stringify({ not: 'array' }))
      expect(getChatMessages('meeting-1')).toBeUndefined()
      expect(localStorage.getItem('noter-chat-meeting-1')).toBeNull()
    })
  })

  describe('saveChatMessages', () => {
    it('saves messages to localStorage', () => {
      const messages = [makeMessage('1', 'user', 'hello')]
      saveChatMessages('meeting-1', messages)

      const raw = localStorage.getItem('noter-chat-meeting-1')
      expect(raw).not.toBeNull()
      const parsed = JSON.parse(raw!)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].id).toBe('1')
    })

    it('updates index with meeting ID', () => {
      saveChatMessages('meeting-1', [makeMessage('1', 'user', 'hi')])
      saveChatMessages('meeting-2', [makeMessage('2', 'user', 'hi')])

      const index = JSON.parse(localStorage.getItem('noter-chat-index')!)
      expect(index).toEqual(['meeting-1', 'meeting-2'])
    })

    it('moves meeting to end of index on update', () => {
      saveChatMessages('meeting-1', [makeMessage('1', 'user', 'hi')])
      saveChatMessages('meeting-2', [makeMessage('2', 'user', 'hi')])
      saveChatMessages('meeting-1', [makeMessage('1', 'user', 'updated')])

      const index = JSON.parse(localStorage.getItem('noter-chat-index')!)
      expect(index).toEqual(['meeting-2', 'meeting-1'])
    })

    it('evicts oldest when exceeding max stored chats', () => {
      // Save 50 chats
      for (let i = 0; i < 50; i++) {
        saveChatMessages(`meeting-${i}`, [makeMessage(`${i}`, 'user', `msg ${i}`)])
      }

      // Save one more — should evict meeting-0
      saveChatMessages('meeting-50', [makeMessage('50', 'user', 'msg 50')])

      expect(localStorage.getItem('noter-chat-meeting-0')).toBeNull()
      expect(getChatMessages('meeting-50')).toHaveLength(1)

      const index = JSON.parse(localStorage.getItem('noter-chat-index')!)
      expect(index).not.toContain('meeting-0')
      expect(index).toContain('meeting-50')
    })
  })

  describe('clearChatMessages', () => {
    it('removes messages and updates index', () => {
      saveChatMessages('meeting-1', [makeMessage('1', 'user', 'hi')])
      saveChatMessages('meeting-2', [makeMessage('2', 'user', 'hi')])

      clearChatMessages('meeting-1')

      expect(localStorage.getItem('noter-chat-meeting-1')).toBeNull()
      const index = JSON.parse(localStorage.getItem('noter-chat-index')!)
      expect(index).toEqual(['meeting-2'])
    })

    it('handles clearing non-existent meeting gracefully', () => {
      expect(() => clearChatMessages('nonexistent')).not.toThrow()
    })
  })

  describe('localStorage unavailable', () => {
    it('returns undefined when localStorage throws', () => {
      const orig = Storage.prototype.getItem
      Storage.prototype.getItem = () => { throw new Error('blocked') }

      expect(getChatMessages('meeting-1')).toBeUndefined()

      Storage.prototype.getItem = orig
    })

    it('does not throw when saving with localStorage unavailable', () => {
      const orig = Storage.prototype.setItem
      Storage.prototype.setItem = () => { throw new Error('blocked') }

      expect(() =>
        saveChatMessages('meeting-1', [makeMessage('1', 'user', 'hi')])
      ).not.toThrow()

      Storage.prototype.setItem = orig
    })
  })
})
