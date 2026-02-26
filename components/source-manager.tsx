'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Upload,
  FileText,
  File,
  Trash2,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { MeetingSource } from '@/lib/types'

const ALLOWED_EXTENSIONS = ['pdf', 'txt', 'md', 'docx']
const MAX_SIZE_MB = 10
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

function formatFileType(type: string) {
  return type.toUpperCase()
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const h = d.getHours()
  const m = d.getMinutes()
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${months[d.getMonth()]} ${d.getDate()}, ${hour12}:${m.toString().padStart(2, '0')} ${period}`
}

const TYPE_COLORS: Record<string, string> = {
  pdf: 'bg-red-500/10 text-red-400 border-red-500/20',
  txt: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  md: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  docx: 'bg-green-500/10 text-green-400 border-green-500/20',
}

export function SourceManager({ meetingId }: { meetingId: string }) {
  const [sources, setSources] = useState<Omit<MeetingSource, 'content'>[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch sources on mount
  useEffect(() => {
    const fetchSources = async () => {
      try {
        const res = await fetch(`/api/sources?meetingId=${meetingId}`)
        const data = await res.json()
        if (data.sources) {
          setSources(data.sources)
        }
      } catch {
        toast.error('Failed to load sources')
      } finally {
        setIsLoading(false)
      }
    }
    fetchSources()
  }, [meetingId])

  const uploadFile = useCallback(
    async (file: File) => {
      // Validate extension
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        toast.error(`Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`)
        return
      }

      // Validate size
      if (file.size > MAX_SIZE_BYTES) {
        toast.error(`File too large. Maximum ${MAX_SIZE_MB}MB.`)
        return
      }

      setIsUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('meetingId', meetingId)

        const res = await fetch('/api/sources', {
          method: 'POST',
          body: formData,
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Upload failed')
        }

        setSources((prev) => [data.source, ...prev])
        toast.success(`${file.name} uploaded and processed`)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Upload failed'
        toast.error(message)
      } finally {
        setIsUploading(false)
      }
    },
    [meetingId]
  )

  const deleteSource = async (sourceId: string, name: string) => {
    if (!confirm(`Remove "${name}" from this meeting?`)) return

    try {
      const res = await fetch('/api/sources', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId }),
      })

      if (!res.ok) {
        throw new Error('Delete failed')
      }

      setSources((prev) => prev.filter((s) => s.id !== sourceId))
      toast.success('Source removed')
    } catch {
      toast.error('Failed to remove source')
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) uploadFile(file)
    },
    [uploadFile]
  )

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    // Reset input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Upload zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors',
          isDragging
            ? 'border-accent bg-accent/5'
            : 'border-border hover:border-muted-foreground',
          isUploading && 'pointer-events-none opacity-50'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md,.docx"
          onChange={handleFileSelect}
          className="hidden"
        />
        {isUploading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Processing document...</p>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="text-sm text-foreground">
                Drop a file or click to upload
              </p>
              <p className="text-xs text-muted-foreground">
                PDF, TXT, Markdown, DOCX -- up to {MAX_SIZE_MB}MB
              </p>
            </div>
          </>
        )}
      </div>

      {/* Sources list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : sources.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Attached documents ({sources.length})
          </span>
          {sources.map((source) => (
            <div
              key={source.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary">
                  {source.file_type === 'pdf' ? (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <File className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate text-sm text-foreground">{source.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDate(source.created_at)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
                    TYPE_COLORS[source.file_type] || 'bg-secondary text-muted-foreground border-border'
                  )}
                >
                  {formatFileType(source.file_type)}
                </span>
                <button
                  onClick={() => deleteSource(source.id, source.name)}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="sr-only">Delete {source.name}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <AlertCircle className="h-5 w-5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            No documents attached yet. Upload presentations, notes, or reference materials to enrich
            the AI chatbot context.
          </p>
        </div>
      )}
    </div>
  )
}
