'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

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
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm('Delete this meeting? This cannot be undone.')) return
    setIsDeleting(true)
    try {
      const supabase = createClient()
      await supabase.from('meeting_sources').delete().eq('meeting_id', meetingId)
      const { error: deleteError } = await supabase.from('meetings').delete().eq('id', meetingId)
      if (deleteError) throw deleteError
      router.push('/dashboard')
    } catch {
      toast.error('Failed to delete meeting')
      setIsDeleting(false)
    }
  }

  if (step === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-destructive/30 bg-card px-6 py-16">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-sm font-medium text-foreground">Something went wrong</p>
          <p className="text-xs text-muted-foreground max-w-md">{error || 'An unexpected error occurred'}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/new"
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90"
          >
            Try again
          </Link>
          {meetingId && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="border-border text-muted-foreground hover:border-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              {isDeleting ? 'Deleting...' : 'Delete meeting'}
            </Button>
          )}
        </div>
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

      {/* Delete option for stuck processing states */}
      {(step === 'transcribing' || step === 'generating') && meetingId && (
        <div className="mt-2 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="mr-1 h-3 w-3" />
            {isDeleting ? 'Deleting...' : 'Cancel and delete'}
          </Button>
        </div>
      )}
    </div>
  )
}
