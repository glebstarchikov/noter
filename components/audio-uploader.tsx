'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { MeetingStatus } from '@/lib/types'
import {
  readApiError,
  waitForMeetingCompletion,
  runLegacyPipeline,
  type ProcessingState,
} from '@/lib/meeting-pipeline'

const ACCEPTED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/webm', 'audio/ogg']
const MAX_SIZE = 25 * 1024 * 1024 // 25MB (Whisper limit)

interface Props {
  onProcessing: (state: {
    meetingId: string
    step: MeetingStatus
    error?: string
  }) => void
  templateId?: string
}

export function AudioUploader({ onProcessing, templateId }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)

  const validateFile = (f: File): string | null => {
    if (!ACCEPTED_TYPES.includes(f.type) && !f.name.match(/\.(mp3|wav|m4a|webm|ogg)$/i)) {
      return 'Unsupported format. Please use mp3, wav, m4a, or webm.'
    }
    if (f.size > MAX_SIZE) {
      return 'File too large. Maximum size is 25MB.'
    }
    return null
  }

  const handleFile = (f: File) => {
    const error = validateFile(f)
    if (error) {
      toast.error(error)
      return
    }
    setFile(f)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }


  const handleSubmit = async () => {
    if (!file || submittingRef.current) return
    submittingRef.current = true
    setIsSubmitting(true)
    let currentMeetingId = ''

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Create meeting record
      const { data: meeting, error: insertError } = await supabase
        .from('meetings')
        .insert({
          user_id: user.id,
          title: file.name.replace(/\.[^/.]+$/, ''),
          status: 'uploading',
          ...(templateId ? { template_id: templateId } : {}),
        })
        .select('id')
        .single()

      if (insertError || !meeting) throw new Error('Failed to create meeting')

      currentMeetingId = meeting.id
      onProcessing({ meetingId: meeting.id, step: 'uploading' })

      // Upload audio directly to Supabase Storage (avoids serverless payload limits)
      const extension = file.name.split('.').pop()?.toLowerCase() || 'webm'
      const storagePath = `${user.id}/${meeting.id}.${extension}`
      const { error: uploadError } = await supabase.storage
        .from('meeting-audio')
        .upload(storagePath, file, {
          contentType: file.type || 'audio/webm',
        })

      if (uploadError) throw new Error('Failed to upload audio: ' + uploadError.message)

      // Save storage path to DB
      await supabase
        .from('meetings')
        .update({ audio_url: storagePath })
        .eq('id', meeting.id)

      const processRes = await fetch(`/api/meetings/${meeting.id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!processRes.ok) {
        const processError = await readApiError(processRes, 'Failed to queue processing')
        if (processError.code === 'QUEUE_UNAVAILABLE') {
          await runLegacyPipeline(meeting.id, storagePath, onProcessing)
          onProcessing({ meetingId: meeting.id, step: 'done' })
          router.push(`/dashboard/${meeting.id}`)
          return
        }

        throw new Error(processError.message)
      }

      onProcessing({ meetingId: meeting.id, step: 'transcribing' })
      await waitForMeetingCompletion(meeting.id, onProcessing)
      onProcessing({ meetingId: meeting.id, step: 'done' })
      router.push(`/dashboard/${meeting.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      toast.error(message)
      onProcessing({ meetingId: currentMeetingId, step: 'error', error: message })
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => {
          if (!isSubmitting) fileInputRef.current?.click()
        }}
        role="button"
        tabIndex={isSubmitting ? -1 : 0}
        aria-disabled={isSubmitting}
        onKeyDown={(e) => {
          if (isSubmitting) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            fileInputRef.current?.click()
          }
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-6 py-16 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isDragging
          ? 'border-accent bg-accent/5'
          : 'border-border bg-card hover:border-muted-foreground'
          } ${isSubmitting ? 'pointer-events-none opacity-60' : ''}`}
        aria-label="Upload audio file"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-secondary">
          <Upload className="size-5 text-muted-foreground" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-medium text-foreground">
            Drop your audio file here
          </p>
          <p className="text-xs text-muted-foreground">
            mp3, wav, m4a, webm - up to 25MB
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.wav,.m4a,.webm,.ogg,audio/*"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
          }}
          className="hidden"
          aria-label="Upload audio file"
        />
      </div>

      {/* Selected file */}
      {file && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">{file.name}</span>
            <span className="text-xs text-muted-foreground">
              {(file.size / 1024 / 1024).toFixed(1)} MB
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost-icon"
              size="icon-sm"
              onClick={(e) => { e.stopPropagation(); setFile(null) }}
              aria-label="Remove file"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Submit */}
      {file && (
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="rounded-lg bg-foreground text-background hover:bg-foreground/90"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Processing…
            </>
          ) : (
            'Generate notes'
          )}
        </Button>
      )}
    </div>
  )
}
