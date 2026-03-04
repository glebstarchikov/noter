'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { useChat } from '@ai-sdk/react'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { ChatInput } from '@/components/chat-input'
import { ChatMessages } from '@/components/chat-messages'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import type { Chat, ChatMessage } from '@/lib/types'

function toUIMessage(message: ChatMessage): UIMessage {
  return {
    id: message.id,
    role: message.role,
    parts: [{ type: 'text', text: message.content }],
  }
}

export function ChatPageClient({ chat, initialMessages }: { chat: Chat; initialMessages: ChatMessage[] }) {
  const router = useRouter()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/global-chat',
        body: { chatId: chat.id },
      }),
    [chat.id]
  )

  const { messages, sendMessage, status, error } = useChat({
    id: chat.id,
    transport,
    messages: initialMessages.map(toUIMessage),
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  const handleDelete = async () => {
    const response = await fetch('/api/chats', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: chat.id }),
    })

    if (response.ok) {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-4 p-6 md:p-10">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-lg font-semibold text-foreground">{chat.title}</h1>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Trash2 className="size-4" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the chat and all messages permanently.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-xl border border-border bg-card px-4 py-4">
        <ChatMessages
          messages={messages}
          status={status}
          error={error}
          emptyStateTitle="Continue this conversation"
        />
      </div>

      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={() => {
            if (!input.trim() || isLoading) return
            sendMessage({ text: input.trim() })
            setInput('')
          }}
          isLoading={isLoading}
          placeholder="Message noter AI..."
        />
      </div>
    </div>
  )
}
