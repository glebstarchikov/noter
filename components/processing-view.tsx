'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
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
} from '@/components/ui/alert-dialog'
import type { MeetingStatus } from '@/lib/types'

interface Props {
  meetingId: string
  step: MeetingStatus
  error?: string
}

const steps = [
  { key: 'transcribing', label: 'Transcribing audio', description: 'Converting speech to text with Whisper' },
  { key: 'generating', label: 'Generating notes', description: 'AI is extracting structured notes' },
  { key: 'done', label: 'Complete', description: 'Your meeting notes are ready' },
]

const statusMeta: Record<
  MeetingStatus,
  {
    stage: 'transcribing' | 'generating' | 'done' | 'error'
    label: string
    description: string
  }
> = {
  recording: {
    stage: 'transcribing',
    label: 'Recording audio',
    description: 'Capturing meeting audio in your browser',
  },
  uploading: {
    stage: 'transcribing',
    label: 'Uploading audio',
    description: 'Uploading recording to secure storage',
  },
  transcribing: {
    stage: 'transcribing',
    label: 'Transcribing audio',
    description: 'Converting speech to text with Whisper',
  },
  generating: {
    stage: 'generating',
    label: 'Generating notes',
    description: 'AI is extracting structured notes',
  },
  done: {
    stage: 'done',
    label: 'Complete',
    description: 'Your meeting notes are ready',
  },
  error: {
    stage: 'error',
    label: 'Error',
    description: 'Something went wrong while processing this meeting',
  },
}

export function ProcessingView({ meetingId, step, error }: Props) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [currentStep, setCurrentStep] = useState<MeetingStatus>(step)
  const [currentError, setCurrentError] = useState<string | undefined>(error)

  useEffect(() => {
    setCurrentStep(step)
    setCurrentError(error)
  }, [step, error])

  useEffect(() => {
    if (!meetingId) return
    if (currentStep === 'done' || currentStep === 'error') return

    let cancelled = false
    const poll = async () => {
      try {
        const response = await fetch(`/api/meetings/${meetingId}`, { cache: 'no-store' })
        if (!response.ok) return

        const payload = await response.json().catch(() => null)
        const nextStep = payload?.meeting?.status as MeetingStatus | undefined
        const nextError = payload?.meeting?.error_message as string | null | undefined

        if (!nextStep) return
        if (cancelled) return

        setCurrentStep(nextStep)
        setCurrentError(nextStep === 'error' ? nextError ?? undefined : undefined)
      } catch {
        // Poll failures are non-fatal here; user still sees current known state.
      }
    }

    const interval = setInterval(poll, 3_000)
    void poll()

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [meetingId, currentStep])

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || 'Failed to delete meeting')
      }
      router.push('/dashboard')
    } catch {
      toast.error('Failed to delete meeting')
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  if (currentStep === 'error') {
    return (
      <>
        <div className="flex flex-col items-center gap-4 rounded-xl border border-destructive/30 bg-card px-6 py-16">
          <AlertCircle className="size-8 text-destructive" />
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-sm font-medium text-foreground">Something went wrong</p>
            <p className="text-xs text-muted-foreground max-w-md">{currentError || 'An unexpected error occurred'}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild>
              <Link href="/dashboard/new">
                Try again
              </Link>
            </Button>
            {meetingId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isDeleting}
                className="border-border text-muted-foreground hover:border-destructive hover:text-destructive"
              >
                <Trash2 className="mr-1 size-3.5" />
                {isDeleting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Deleting…
                  </>
                ) : (
                  'Delete meeting'
                )}
              </Button>
            )}
          </div>
        </div>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this meeting?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the meeting and all its data. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    )
  }

  const currentStage = statusMeta[currentStep].stage
  const currentIndex = steps.findIndex((s) => s.key === currentStage)

  return (
    <>
      <div className="flex flex-col gap-6 rounded-xl border border-border bg-card px-6 py-12">
        {steps.map((s, i) => {
          const isActive = s.key === currentStage
          const isDone = i < currentIndex || currentStage === 'done'
          const isPending = i > currentIndex && currentStage !== 'done'
          const displayLabel = s.key === currentStage ? statusMeta[currentStep].label : s.label
          const displayDescription =
            s.key === currentStage ? statusMeta[currentStep].description : s.description

          return (
            <div key={s.key} className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                {isDone ? (
                  <CheckCircle2 className="size-5 text-accent" />
                ) : isActive ? (
                  <Loader2 className="size-5 animate-spin text-accent" />
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
                  {displayLabel}
                </span>
                <span className="text-xs text-muted-foreground">{displayDescription}</span>
              </div>
            </div>
          )
        })}

        {currentStep === 'done' && meetingId && (
          <div className="mt-4 flex justify-center">
            <Button asChild>
              <Link href={`/dashboard/${meetingId}`}>
                View meeting notes
              </Link>
            </Button>
          </div>
        )}

        {/* Delete option for stuck processing states */}
        {(currentStep === 'recording' || currentStep === 'uploading' || currentStep === 'transcribing' || currentStep === 'generating') && meetingId && (
          <div className="mt-2 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="mr-1 h-3 w-3" />
              {isDeleting ? 'Deleting...' : 'Cancel and delete'}
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this meeting?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the meeting and all its data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
