'use client'

import Link from 'next/link'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  meetingId: string
  step: 'transcribing' | 'generating' | 'done' | 'error'
  error?: string
}

const steps = [
  { key: 'transcribing', label: 'Transcribing audio', description: 'Converting speech to text with Whisper' },
  { key: 'generating', label: 'Generating notes', description: 'AI is extracting structured notes' },
  { key: 'done', label: 'Complete', description: 'Your meeting notes are ready' },
]

export function ProcessingView({ meetingId, step, error }: Props) {
  if (step === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-destructive/30 bg-card px-6 py-16">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-sm font-medium text-foreground">Something went wrong</p>
          <p className="text-xs text-muted-foreground">{error || 'An unexpected error occurred'}</p>
        </div>
        <Link
          href="/dashboard/new"
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90"
        >
          Try again
        </Link>
      </div>
    )
  }

  const currentIndex = steps.findIndex((s) => s.key === step)

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border bg-card px-6 py-12">
      {steps.map((s, i) => {
        const isActive = s.key === step
        const isDone = i < currentIndex || step === 'done'
        const isPending = i > currentIndex && step !== 'done'

        return (
          <div key={s.key} className="flex items-start gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center">
              {isDone ? (
                <CheckCircle2 className="h-5 w-5 text-accent" />
              ) : isActive ? (
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
              ) : (
                <div className={cn(
                  'h-2 w-2 rounded-full',
                  isPending ? 'bg-muted-foreground/30' : 'bg-accent'
                )} />
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className={cn(
                'text-sm font-medium',
                isActive || isDone ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {s.label}
              </span>
              <span className="text-xs text-muted-foreground">{s.description}</span>
            </div>
          </div>
        )
      })}

      {step === 'done' && meetingId && (
        <div className="mt-4 flex justify-center">
          <Link
            href={`/dashboard/${meetingId}`}
            className="rounded-lg bg-foreground px-6 py-2.5 text-sm font-medium text-background hover:bg-foreground/90"
          >
            View meeting notes
          </Link>
        </div>
      )}
    </div>
  )
}
