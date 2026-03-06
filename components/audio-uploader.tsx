'use client'

import { useRef, useState } from 'react'
import { Upload, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useMeetingUploadFlow } from '@/hooks/use-meeting-upload-flow'
import type { MeetingStatus } from '@/lib/types'

const ACCEPTED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/webm', 'audio/ogg']
const MAX_SIZE = 25 * 1024 * 1024

interface Props {
  onProcessing: (state: {
    meetingId: string
    step: MeetingStatus
    error?: string
  }) => void
}

export function AudioUploader({ onProcessing }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const { isSubmitting, submitMeetingAudio } = useMeetingUploadFlow(onProcessing)

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

  const handleSubmit = async () => {
    if (!file) return
    await submitMeetingAudio({
      audio: file,
      filename: file.name,
      contentType: file.type,
      title: file.name.replace(/\.[^/.]+$/, ''),
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          const dropped = e.dataTransfer.files[0]
          if (dropped) handleFile(dropped)
        }}
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
        className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-6 py-16 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isDragging ? 'border-accent bg-accent/5' : 'border-border bg-card hover:border-muted-foreground'} ${isSubmitting ? 'pointer-events-none opacity-60' : ''}`}
        aria-label="Upload audio file"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-secondary"><Upload className="size-5 text-muted-foreground" /></div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-medium text-foreground">Drop your audio file here</p>
          <p className="text-xs text-muted-foreground">mp3, wav, m4a, webm - up to 25MB</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.wav,.m4a,.webm,.ogg,audio/*"
          onChange={(e) => {
            const nextFile = e.target.files?.[0]
            if (nextFile) handleFile(nextFile)
          }}
          className="hidden"
          aria-label="Upload audio file"
        />
      </div>

      {file && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">{file.name}</span>
            <span className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
          </div>
          <Button variant="ghost-icon" size="icon-sm" onClick={(e) => { e.stopPropagation(); setFile(null) }} aria-label="Remove file">
            <X className="size-4" />
          </Button>
        </div>
      )}

      {file && (
        <Button onClick={handleSubmit} disabled={isSubmitting} className="rounded-lg bg-foreground text-background hover:bg-foreground/90">
          {isSubmitting ? <><Loader2 className="size-4 animate-spin" />Processing…</> : 'Generate notes'}
        </Button>
      )}
    </div>
  )
}
