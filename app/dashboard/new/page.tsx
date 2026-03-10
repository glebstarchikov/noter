'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, Upload, Loader2 } from 'lucide-react'
import { AudioUploader } from '@/components/audio-uploader'
import { ProcessingView } from '@/components/processing-view'
import { cn } from '@/lib/utils'
import { BUILTIN_TEMPLATES, DEFAULT_TEMPLATE_ID } from '@/lib/templates'
import { createClient } from '@/lib/supabase/client'
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

  const selectedTemplate = BUILTIN_TEMPLATES.find((t) => t.id === templateId) ?? BUILTIN_TEMPLATES[0]

  // "Record live" — create meeting with status 'recording', navigate to meeting page
  const handleStartRecording = async () => {
    if (isCreating) return
    setIsCreating(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
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
      <div className="mx-auto max-w-2xl px-6 py-8 md:px-10 md:py-10">
        <ProcessingView
          meetingId={processing.meetingId}
          step={processing.step}
          error={processing.error}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 md:px-10 md:py-10">
      <div className="mb-8 flex flex-col gap-1">
        <h1 className="text-[26px] font-semibold tracking-tight text-foreground">New meeting</h1>
        <p className="text-sm text-muted-foreground">Record live audio or upload an existing file.</p>
      </div>

      {/* Template selector */}
      <div className="mb-6">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Template
        </p>
        <div className="flex flex-wrap gap-2">
          {BUILTIN_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplateId(t.id)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                templateId === t.id
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
              )}
            >
              {t.name}
            </button>
          ))}
        </div>
        {selectedTemplate.description && (
          <p className="mt-2 text-[11px] text-muted-foreground">{selectedTemplate.description}</p>
        )}
      </div>

      {/* Two cards — choose record or upload */}
      {activeCard === null && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleStartRecording}
            disabled={isCreating}
            className="flex flex-col items-start gap-5 rounded-xl border border-border bg-card p-9 text-left transition-transform duration-200 hover:scale-[1.01] hover:border-foreground/20 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
          >
            {isCreating ? (
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            ) : (
              <Mic className="size-6 text-muted-foreground" />
            )}
            <div className="flex flex-col gap-1">
              <span className="text-[15px] font-semibold text-foreground">Record live</span>
              <span className="text-sm text-muted-foreground">
                Capture audio from your microphone in real time.
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveCard('upload')}
            className="flex flex-col items-start gap-5 rounded-xl border border-border bg-card p-9 text-left transition-transform duration-200 hover:scale-[1.01] hover:border-foreground/20 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Upload className="size-6 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <span className="text-[15px] font-semibold text-foreground">Upload audio</span>
              <span className="text-sm text-muted-foreground">
                Import an existing recording — MP3, WAV, M4A, or WebM.
              </span>
            </div>
          </button>
        </div>
      )}

      {/* Upload card */}
      {activeCard === 'upload' && (
        <div className="rounded-xl border border-border bg-card p-9">
          <AudioUploader onProcessing={setProcessing} templateId={templateId} />
        </div>
      )}
    </div>
  )
}
