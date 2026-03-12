'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mic, Upload, Loader2, ChevronDown } from 'lucide-react'
import { AudioUploader } from '@/components/audio-uploader'
import { ProcessingView } from '@/components/processing-view'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import { BUILTIN_TEMPLATES, DEFAULT_TEMPLATE_ID } from '@/lib/templates'
import { toast } from 'sonner'
import type { MeetingStatus } from '@/lib/types'

type ActiveCard = 'upload' | null

export default function NewMeetingPage() {
  const router = useRouter()
  const [processing, setProcessing] = useState<{
    meetingId: string
    step: MeetingStatus
    error?: string
  } | null>(null)
  const [activeCard, setActiveCard] = useState<ActiveCard>(null)
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID)
  const [isCreating, setIsCreating] = useState(false)

  const selectedTemplate =
    BUILTIN_TEMPLATES.find((template) => template.id === templateId) ?? BUILTIN_TEMPLATES[0]

  const handleStartRecording = async () => {
    if (isCreating) return
    setIsCreating(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      const { data: meeting, error } = await supabase
        .from('meetings')
        .insert({
          user_id: user.id,
          title: 'New recording',
          status: 'recording',
          ...(templateId ? { template_id: templateId } : {}),
        })
        .select('id')
        .single()

      if (error || !meeting) throw new Error('Failed to create meeting')
      router.push(`/dashboard/${meeting.id}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not start recording')
      setIsCreating(false)
    }
  }

  if (processing) {
    return (
      <div className="flex flex-col gap-6 p-6 md:p-10">
        <ProcessingView
          meetingId={processing.meetingId}
          step={processing.step}
          error={processing.error}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold tracking-tight text-foreground">Start a meeting</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Capture a live conversation or bring in an existing recording. noter will shape the notes for you.
        </p>
      </div>

      <div className="surface-utility flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Note format</p>
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground">{selectedTemplate.name}</span>
            {selectedTemplate.description ? ` · ${selectedTemplate.description}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-full border-border/70 bg-card px-4 shadow-none">
                {selectedTemplate.name}
                <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Choose a format</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={templateId}
                onValueChange={(value) => setTemplateId(value)}
              >
                {BUILTIN_TEMPLATES.map((template) => (
                  <DropdownMenuRadioItem key={template.id} value={template.id}>
                    {template.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button asChild variant="ghost" className="rounded-full px-4 text-muted-foreground">
            <Link href="/dashboard/templates">Browse formats</Link>
          </Button>
        </div>
      </div>

      {activeCard === null && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleStartRecording}
            disabled={isCreating}
            className="surface-document flex flex-col items-start gap-5 px-7 py-8 text-left transition-transform duration-200 hover:scale-[1.01] hover:bg-secondary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
          >
            <div className="flex size-12 items-center justify-center rounded-2xl bg-accent/12 text-accent">
              {isCreating ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Mic className="size-5" />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-lg font-semibold tracking-tight text-foreground">Record live</p>
              <p className="text-sm leading-6 text-muted-foreground">
                Start with your microphone and build notes as the conversation happens.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveCard('upload')}
            className="surface-document flex flex-col items-start gap-5 px-7 py-8 text-left transition-transform duration-200 hover:scale-[1.01] hover:bg-secondary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-foreground">
              <Upload className="size-5" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-semibold tracking-tight text-foreground">Upload audio</p>
              <p className="text-sm leading-6 text-muted-foreground">
                Bring in a saved recording and let noter turn it into structured notes.
              </p>
            </div>
          </button>
        </div>
      )}

      {activeCard === 'upload' && (
        <div className="space-y-4">
          <Button
            variant="ghost"
            onClick={() => setActiveCard(null)}
            className="px-0 text-sm text-muted-foreground hover:text-foreground"
          >
            Back
          </Button>
          <div className="surface-document px-7 py-8">
            <AudioUploader onProcessing={setProcessing} templateId={templateId} />
          </div>
        </div>
      )}
    </div>
  )
}
