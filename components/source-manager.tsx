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
import type { MeetingSource } from '@/lib/types'
import { formatMeetingDate } from '@/lib/presentation/meeting-format'

const ALLOWED_EXTENSIONS = ['pdf', 'txt', 'md', 'docx']
const MAX_SIZE_MB = 10
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

function formatFileType(type: string) {
  return type.toUpperCase()
}

const TYPE_BADGE_STYLES: Record<string, string> = {
  pdf: 'bg-secondary text-secondary-foreground border-border',
  txt: 'bg-muted text-muted-foreground border-border',
  md: 'bg-accent/15 text-accent-foreground border-accent/30',
  docx: 'bg-card text-foreground border-border',
}

export function SourceManager({ meetingId }: { meetingId: string }) {
  const [sources, setSources] = useState<Omit<MeetingSource, 'content'>[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch sources on mount
  useEffect(() => {
    const fetchSources = async () => {
      try {
        const res = await fetch(`/api/sources?meetingId=${meetingId}`)
        if (!res.ok) throw new Error('Failed to fetch')
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

        if (!res.ok) {
          const textErr = await res.text()
          let errorMessage = 'Upload failed'
          try {
            const jsonErr = JSON.parse(textErr)
            errorMessage = jsonErr.error || errorMessage
          } catch {
            errorMessage = textErr || errorMessage
          }
          throw new Error(errorMessage)
        }

        const data = await res.json()


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
    } finally {
      setDeleteTarget(null)
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
    <>
      <div className="flex flex-col gap-5">
        {/* Upload zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          role="button"
          tabIndex={isUploading ? -1 : 0}
          aria-disabled={isUploading}
          onKeyDown={(e) => {
            if (isUploading) return
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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
            aria-label="Upload source document"
          />
          {isUploading ? (
            <>
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Processing document...</p>
            </>
          ) : (
            <>
              <Upload className="size-8 text-muted-foreground" />
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
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
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
                      <FileText className="size-4 text-muted-foreground" />
                    ) : (
                      <File className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="truncate text-sm text-foreground">{source.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatMeetingDate(source.created_at)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
                      TYPE_BADGE_STYLES[source.file_type] || 'bg-secondary text-muted-foreground border-border'
                    )}
                  >
                    {formatFileType(source.file_type)}
                  </span>
                  <Button
                    variant="ghost-destructive"
                    size="icon-sm"
                    onClick={() => setDeleteTarget({ id: source.id, name: source.name })}
                  >
                    <Trash2 className="size-3.5" />
                    <span className="sr-only">Delete {source.name}</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <AlertCircle className="size-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              No documents attached yet. Upload presentations, notes, or reference materials to enrich
              the AI chatbot context.
            </p>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove source?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove &ldquo;{deleteTarget?.name}&rdquo; from this meeting? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteSource(deleteTarget.id, deleteTarget.name)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
