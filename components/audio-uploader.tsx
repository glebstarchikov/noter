'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const ACCEPTED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/webm', 'audio/ogg']
const MAX_SIZE = 25 * 1024 * 1024 // 25MB (Whisper limit)

interface Props {
  onProcessing: (state: {
    meetingId: string
    step: 'transcribing' | 'generating' | 'done' | 'error'
    error?: string
  }) => void
}

export function AudioUploader({ onProcessing }: Props) {
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
          status: 'transcribing',
        })
        .select('id')
        .single()

      if (insertError || !meeting) throw new Error('Failed to create meeting')

      onProcessing({ meetingId: meeting.id, step: 'transcribing' })

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

      // Call transcribe API with storage path (lightweight JSON, no large payload)
      const transcribeRes = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: meeting.id, storagePath }),
      })

      if (!transcribeRes.ok) {
        const textErr = await transcribeRes.text()
        let errorMessage = 'Transcription failed'
        try {
          const jsonErr = JSON.parse(textErr)
          errorMessage = jsonErr.error || errorMessage
        } catch {
          errorMessage = textErr || errorMessage
        }
        throw new Error(errorMessage)
      }

      const { transcript } = await transcribeRes.json()
      onProcessing({ meetingId: meeting.id, step: 'generating' })

      // Generate notes
      const notesRes = await fetch('/api/generate-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: meeting.id, transcript }),
      })

      if (!notesRes.ok) {
        const textErr = await notesRes.text()
        let errorMessage = 'Notes generation failed'
        try {
          const jsonErr = JSON.parse(textErr)
          errorMessage = jsonErr.error || errorMessage
        } catch {
          errorMessage = textErr || errorMessage
        }
        throw new Error(errorMessage)
      }

      onProcessing({ meetingId: meeting.id, step: 'done' })
      router.push(`/dashboard/${meeting.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      toast.error(message)
      onProcessing({ meetingId: '', step: 'error', error: message })
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
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') fileInputRef.current?.click() }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-6 py-16 transition-colors ${isDragging
          ? 'border-accent bg-accent/5'
          : 'border-border bg-card hover:border-muted-foreground'
          }`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-secondary">
          <Upload className="h-5 w-5 text-muted-foreground" />
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
            <button
              onClick={(e) => { e.stopPropagation(); setFile(null) }}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
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
          {isSubmitting ? 'Processing...' : 'Generate notes'}
        </Button>
      )}
    </div>
  )
}
