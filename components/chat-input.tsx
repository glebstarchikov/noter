'use client'

import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  isLoading: boolean
  placeholder?: string
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  placeholder = 'Ask noter AI...',
}: ChatInputProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
      className="flex items-center gap-2"
    >
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={isLoading}
        aria-label={placeholder}
        className="flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
      />
      <Button
        type="submit"
        size="icon"
        disabled={!value.trim() || isLoading}
        className="size-9 shrink-0 bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-30"
      >
        <Send className="size-4" />
        <span className="sr-only">Send message</span>
      </Button>
    </form>
  )
}
