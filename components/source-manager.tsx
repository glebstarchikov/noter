'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Upload,
  FileText,
  File,
  Trash2,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import type { MeetingSource } from '@/lib/types'
import { formatDateCompact } from '@/lib/date-formatter'
import { fetchSources as fetchSourcesApi, uploadSource, deleteSource as deleteSourceApi } from '@/lib/source-api'

const ALLOWED_EXTENSIONS = ['pdf', 'txt', 'md', 'docx']
const MAX_SIZE_MB = 10
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

function formatFileType(type: string) {
  return type.toUpperCase()
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
    fetchSourcesApi(meetingId)
      .then(setSources)
      .catch(() => toast.error("We couldn't load your documents. Please try again."))
      .finally(() => setIsLoading(false))
  }, [meetingId])

  const uploadFile = useCallback(
    async (file: File) => {
      // Validate extension
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        toast.error('We support PDF, Word, Markdown, and plain text files.')
        return
      }

      // Validate size
      if (file.size > MAX_SIZE_BYTES) {
        toast.error('This file is too large. The maximum size is 10 MB.')
        return
      }

      setIsUploading(true)
      try {
        const source = await uploadSource(meetingId, file)
        setSources((prev) => [source, ...prev])
        toast.success(`${file.name} uploaded and processed`)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Something went wrong uploading this file. Please try again.'
        toast.error(message)
      } finally {
        setIsUploading(false)
      }
    },
    [meetingId]
  )

  const deleteSource = async (sourceId: string) => {
    try {
      await deleteSourceApi(sourceId)
      setSources((prev) => prev.filter((s) => s.id !== sourceId))
      toast.success('Document removed')
    } catch {
      toast.error("We couldn't remove this document. Please try again.")
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
            'surface-utility flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[24px] border-2 border-dashed p-8 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isDragging
              ? 'border-accent bg-accent/5'
              : 'border-border hover:border-muted-foreground/60',
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
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="surface-document flex items-center justify-between px-3 py-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-8 rounded-md" />
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-6 w-12 rounded-full" />
              </div>
            ))}
          </div>
        ) : sources.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Attached documents ({sources.length})
            </span>
            {sources.map((source) => (
              <div
                key={source.id}
                className="surface-document flex items-center justify-between rounded-[22px] px-3 py-2.5"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="surface-utility flex size-8 shrink-0 items-center justify-center rounded-md">
                    {source.file_type === 'pdf' ? (
                      <FileText className="size-4 text-muted-foreground" />
                    ) : (
                      <File className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="truncate text-sm text-foreground">{source.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDateCompact(source.created_at)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="rounded-full px-2 py-0.5">
                    {formatFileType(source.file_type)}
                  </Badge>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost-destructive"
                        size="icon-sm"
                        onClick={() => setDeleteTarget({ id: source.id, name: source.name })}
                        aria-label={`Remove ${source.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Remove document</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty className="surface-empty py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileText />
              </EmptyMedia>
              <EmptyTitle>No documents attached yet</EmptyTitle>
              <EmptyDescription>
                Upload presentations, notes, or reference materials to enrich the note context when you need them.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" className="shadow-none" onClick={() => fileInputRef.current?.click()}>
                <Upload />
                Add a document
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove document?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove &ldquo;{deleteTarget?.name}&rdquo; from this note? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteSource(deleteTarget.id)}
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
