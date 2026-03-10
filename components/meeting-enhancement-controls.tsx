'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles, Loader2, Check, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Meeting } from '@/lib/types'

interface MeetingEnhancementControlsProps {
  meeting: Meeting
}

export function MeetingEnhancementControls({ meeting }: MeetingEnhancementControlsProps) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const currentSuggestion = meeting.enhancement_state?.currentSuggestion ?? null
  const isReviewing = meeting.enhancement_status === 'reviewing' && currentSuggestion
  const isGenerating = meeting.enhancement_status === 'generating'
  const canEnhance = Boolean(meeting.transcript?.trim()) && meeting.status !== 'recording'

  useEffect(() => {
    if (isReviewing) {
      cardRef.current?.focus()
    }
  }, [isReviewing])

  useEffect(() => {
    if (!isReviewing) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        void handleAction('accept')
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        void handleAction('skip')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isReviewing, currentSuggestion?.id])

  const handleAction = async (action: 'start' | 'accept' | 'skip') => {
    if (!canEnhance || isPending) return

    setIsPending(true)
    try {
      const response = await fetch(`/api/meetings/${meeting.id}/enhance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ...(currentSuggestion ? { suggestionId: currentSuggestion.id } : {}),
        }),
      })

      if (!response.ok) {
        throw new Error('Enhancement failed')
      }

      router.refresh()
    } catch {
      setIsPending(false)
    }
  }

  if (!canEnhance && !isGenerating && !isReviewing) {
    return null
  }

  return (
    <>
      {canEnhance && !isGenerating && !isReviewing && (
        <div className="fixed right-4 bottom-24 z-40 md:right-6 md:bottom-28">
          <Button
            type="button"
            onClick={() => void handleAction('start')}
            disabled={isPending}
            className="liquid-metal-fab h-12 rounded-full px-5 text-sm font-medium"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Enhance
          </Button>
        </div>
      )}

      {(isGenerating || isReviewing) && (
        <>
          <div className="pointer-events-none absolute inset-0 z-10 rounded-3xl bg-background/40 backdrop-blur-[2px]" />
          <div
            ref={cardRef}
            tabIndex={-1}
            className={cn(
              'liquid-metal-panel fixed inset-x-4 bottom-24 z-20 mx-auto max-w-lg rounded-[28px] p-5 outline-none md:bottom-28',
              isReviewing && 'ring-2 ring-ring/20'
            )}
          >
            {isGenerating && !isReviewing ? (
              <div className="flex items-start gap-3">
                <div className="liquid-metal-icon flex size-10 items-center justify-center rounded-full">
                  <Loader2 className="size-4 animate-spin" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-foreground">Finding one useful enhancement</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    noter is reviewing your note and transcript to propose one focused improvement.
                  </p>
                </div>
              </div>
            ) : currentSuggestion ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="liquid-metal-icon flex size-10 items-center justify-center rounded-full">
                    <Sparkles className="size-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-foreground">{currentSuggestion.title}</p>
                    <p className="text-sm leading-6 text-muted-foreground">{currentSuggestion.summary}</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Before
                    </p>
                    <p className="mt-2 text-sm leading-6 text-foreground/80">
                      {currentSuggestion.beforeExcerpt || 'No preview available.'}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      After
                    </p>
                    <p className="mt-2 text-sm leading-6 text-foreground">
                      {currentSuggestion.afterExcerpt || 'No preview available.'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    onClick={() => void handleAction('accept')}
                    disabled={isPending}
                    className="liquid-metal-button"
                  >
                    <Check className="size-4" />
                    Accept
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void handleAction('skip')}
                    disabled={isPending}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                    Skip
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Press <kbd className="rounded border border-border/60 bg-background px-1.5 py-0.5">Enter</kbd> to accept or <kbd className="rounded border border-border/60 bg-background px-1.5 py-0.5">Esc</kbd> to skip.
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </>
      )}
    </>
  )
}
