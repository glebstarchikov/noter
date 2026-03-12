import React from 'react'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { UIMessage } from 'ai'
import {
  clearChatMessages,
  clearGlobalChatMessages,
  clearSupportChatMessages,
  saveChatMessages,
  saveGlobalChatMessages,
  saveSupportChatMessages,
} from '@/lib/chat-storage'

let pathname = '/'
let authUser: { id: string } | null = { id: 'user-1' }

const chatState = new Map<string, UIMessage[]>()

mock.module('next/navigation', () => ({
  usePathname: () => pathname,
}))

mock.module('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: authUser } }),
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe() {},
          },
        },
      }),
    },
  }),
}))

mock.module('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))

mock.module('@ai-sdk/react', () => ({
  useChat: ({ id }: { id: string }) => {
    const [messages, setMessagesState] = React.useState<UIMessage[]>(chatState.get(id) ?? [])

    React.useEffect(() => {
      setMessagesState(chatState.get(id) ?? [])
    }, [id])

    const setMessages = React.useCallback(
      (next: UIMessage[] | ((current: UIMessage[]) => UIMessage[])) => {
        setMessagesState((current) => {
          const resolved = typeof next === 'function' ? next(current) : next
          chatState.set(id, resolved)
          return resolved
        })
      },
      [id]
    )

    const sendMessage = React.useCallback(
      async ({
        text,
      }: {
        text?: string
      }) => {
        const nextMessages: UIMessage[] = [
          ...(chatState.get(id) ?? []),
          {
            id: `${id}-user`,
            role: 'user',
            parts: text ? [{ type: 'text', text }] : [],
          },
          {
            id: `${id}-assistant`,
            role: 'assistant',
            parts: [{ type: 'text', text: 'Stub answer' }],
          },
        ]

        chatState.set(id, nextMessages)
        setMessagesState(nextMessages)
      },
      [id]
    )

    return {
      messages,
      status: 'ready',
      error: undefined,
      setMessages,
      sendMessage,
    }
  },
}))

const { FloatingChatHost } = await import('./floating-chat-host')

describe('FloatingChatHost', () => {
  beforeEach(() => {
    pathname = '/'
    authUser = { id: 'user-1' }
    chatState.clear()
    localStorage.clear()
    clearChatMessages('meeting-1')
    clearGlobalChatMessages()
    clearSupportChatMessages()

    window.requestAnimationFrame = ((callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 0)) as typeof window.requestAnimationFrame
    window.cancelAnimationFrame = ((id: number) => window.clearTimeout(id)) as typeof window.cancelAnimationFrame
  })

  afterEach(() => {
    cleanup()
  })

  it('hides the floating chat on auth pages', () => {
    pathname = '/auth/login'

    render(<FloatingChatHost />)

    expect(screen.queryByRole('region', { name: 'Chat with noter' })).toBeNull()
  })

  it('renders landing support mode without attachment or tools controls', async () => {
    pathname = '/'

    render(<FloatingChatHost />)

    fireEvent.click(screen.getByRole('button', { name: /open chat/i }))

    expect((await screen.findAllByText('Support')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /add context/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Auto$/i })).toBeNull()
  })

  it('defaults note pages to meeting scope and hydrates the global thread when switched', async () => {
    pathname = '/dashboard/meeting-1'

    saveChatMessages('meeting-1', [
      {
        id: 'meeting-message',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Meeting-only answer' }],
      } as UIMessage,
    ])
    saveGlobalChatMessages([
      {
        id: 'global-message',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Global answer' }],
      } as UIMessage,
    ])

    render(<FloatingChatHost />)

    fireEvent.click(screen.getByRole('button', { name: /open chat/i }))

    expect(await screen.findByText('Meeting-only answer')).not.toBeNull()

    fireEvent.click(screen.getByText('All notes'))

    expect(await screen.findByText('Global answer')).not.toBeNull()
  })

  it('expands and collapses through click, keyboard shortcut, escape, and outside click', async () => {
    pathname = '/dashboard'

    render(<FloatingChatHost />)

    fireEvent.click(screen.getByRole('button', { name: /open chat/i }))

    expect(await screen.findByLabelText('Ask across all notes...')).not.toBeNull()
    expect(
      screen
        .getByRole('region', { name: 'Chat with noter' })
        .querySelector('[data-slot="chatbar-shell"]')
        ?.getAttribute('data-state')
    ).toBe('expanded')

    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByLabelText('Ask across all notes...')).toBeNull()
    })

    fireEvent.keyDown(window, { key: 'j', metaKey: true })

    expect(await screen.findByLabelText('Ask across all notes...')).not.toBeNull()

    fireEvent.mouseDown(document.body)

    await waitFor(() => {
      expect(screen.queryByLabelText('Ask across all notes...')).toBeNull()
    })
  })

  it('hydrates support history separately from dashboard chat history', async () => {
    pathname = '/'

    saveSupportChatMessages([
      {
        id: 'support-message',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Support answer' }],
      } as UIMessage,
    ])

    render(<FloatingChatHost />)

    fireEvent.click(screen.getByRole('button', { name: /open chat/i }))

    expect(await screen.findByText('Support answer')).not.toBeNull()
    expect(screen.queryByText('Global answer')).toBeNull()
  })
})
