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

type StepState = 'done' | 'active' | 'pending'

function buildDisplaySteps(currentStep: MeetingStatus) {
  switch (currentStep) {
    case 'uploading':
      return [
        { label: 'Uploading audio…', state: 'active' as const },
        { label: 'Preparing transcript', state: 'pending' as const },
        { label: 'Writing notes', state: 'pending' as const },
      ]
    case 'transcribing':
      return [
        { label: 'Audio ready', state: 'done' as const },
        { label: 'Preparing transcript…', state: 'active' as const },
        { label: 'Writing notes', state: 'pending' as const },
      ]
    case 'generating':
      return [
        { label: 'Audio ready', state: 'done' as const },
        { label: 'Transcript ready', state: 'done' as const },
        { label: 'Writing notes…', state: 'active' as const },
      ]
    case 'done':
      return [
        { label: 'Audio ready', state: 'done' as const },
        { label: 'Transcript ready', state: 'done' as const },
        { label: 'Notes complete', state: 'done' as const },
      ]
    case 'recording':
      return [
        { label: 'Recording in progress…', state: 'active' as const },
        { label: 'Preparing transcript', state: 'pending' as const },
        { label: 'Writing notes', state: 'pending' as const },
      ]
    default:
      return [
        { label: 'Audio ready', state: 'done' as const },
        { label: 'Preparing transcript', state: 'pending' as const },
        { label: 'Writing notes', state: 'pending' as const },
      ]
  }
}

function StepIcon({ state }: { state: StepState }) {
  if (state === 'done') {
    return <CheckCircle2 className="size-4 text-accent" />
  }

  if (state === 'active') {
    return <Loader2 className="size-4 animate-spin text-foreground" />
  }

  return <span className="size-3 rounded-full border border-muted-foreground/30" />
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

        if (!nextStep || cancelled) return

        setCurrentStep(nextStep)
        setCurrentError(nextStep === 'error' ? nextError ?? undefined : undefined)
      } catch {
        // Keep the current state visible if polling fails.
      }
    }

    const interval = setInterval(poll, 3_000)
    void poll()

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [meetingId, currentStep])

  useEffect(() => {
    if (!meetingId || currentStep !== 'done') return

    const href = `/dashboard/${meetingId}`
    router.push(href)
    router.refresh()
  }, [currentStep, meetingId, router])

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
        <div className="flex flex-col gap-8">
          <div className="space-y-2">
            <h1 className="text-[30px] font-semibold tracking-tight text-foreground">
              We hit a problem preparing this note
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Nothing is lost. You can start a new note, or remove this one and try again.
            </p>
          </div>

          <div className="surface-utility flex max-w-2xl flex-col gap-5 px-6 py-6">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="size-5 text-destructive" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">Processing stopped early</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {currentError || 'An unexpected error occurred while preparing your note.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild>
                <Link href="/dashboard/new">Start a new note</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isDeleting}
                className="px-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
                {isDeleting ? 'Deleting…' : 'Delete this note'}
              </Button>
            </div>
          </div>
        </div>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this note?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the note and all its data. This cannot be undone.
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

  const displaySteps = buildDisplaySteps(currentStep)

  return (
    <>
      <div className="flex flex-col gap-8">
        <div className="space-y-2">
          <h1 className="text-[30px] font-semibold tracking-tight text-foreground">
            Preparing your note
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            We&apos;re turning the audio into a clear set of notes. You can leave this page while
            we finish up.
          </p>
        </div>

        <div className="flex flex-col gap-5">
          {displaySteps.map((stepItem) => (
            <div key={stepItem.label} className="flex items-center gap-4">
              <div className="flex size-7 shrink-0 items-center justify-center">
                <StepIcon state={stepItem.state} />
              </div>
              <span
                className={cn(
                  stepItem.state === 'active' && 'text-base font-semibold text-foreground',
                  stepItem.state === 'done' && 'text-sm font-medium text-accent',
                  stepItem.state === 'pending' && 'text-sm text-muted-foreground/40'
                )}
              >
                {stepItem.label}
              </span>
            </div>
          ))}
        </div>

        {(currentStep === 'recording' ||
          currentStep === 'uploading' ||
          currentStep === 'transcribing' ||
          currentStep === 'generating') &&
          meetingId && (
          <div className="flex">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting}
              className="px-0 text-sm text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
              {isDeleting ? 'Deleting…' : 'Cancel and delete'}
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the note and all its data. This cannot be undone.
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
