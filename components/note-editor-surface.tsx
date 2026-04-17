'use client'

import type { Editor } from '@tiptap/react'
import { AlertCircle } from 'lucide-react'
import { MeetingEditor } from '@/components/meeting-editor'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { DocumentSaveConflict } from '@/lib/document-sync'
import type { TiptapDocument } from '@/lib/tiptap/tiptap-converter'
import type { Meeting } from '@/lib/types'
import { cn } from '@/lib/utils'
import type { DraftUiState } from '@/hooks/use-draft-proposal'

interface NoteEditorSurfaceProps {
  meeting: Meeting
  editorSeed: TiptapDocument
  editorRevision: number
  editable: boolean
  acknowledgedHash: string
  documentConflict: DocumentSaveConflict | null
  draftState: DraftUiState
  onEditorReady: (editor: Editor | null) => void
  onContentChange: (document: unknown) => void
  onAutosaveSuccess: (payload: { documentHash: string }) => void
  onAutosaveConflict: (payload: {
    currentDocument: TiptapDocument
    currentHash: string
    message: string
  }) => void
  onLoadLatestVersion: () => void
  onKeepLocalDraft: () => void
  onDismissConflict: () => void
}

export function NoteEditorSurface({
  meeting,
  editorSeed,
  editorRevision,
  editable,
  acknowledgedHash,
  documentConflict,
  draftState,
  onEditorReady,
  onContentChange,
  onAutosaveSuccess,
  onAutosaveConflict,
  onLoadLatestVersion,
  onKeepLocalDraft,
  onDismissConflict,
}: NoteEditorSurfaceProps) {
  return (
    <>
      {documentConflict && (
        <Alert className="rounded-xl border-destructive/20 bg-destructive/5 text-foreground">
          <AlertCircle className="text-destructive" />
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-1">
              <AlertTitle className="line-clamp-none">
                A newer version of this note exists
              </AlertTitle>
              <AlertDescription className="text-muted-foreground">
                {documentConflict.message}
              </AlertDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onLoadLatestVersion}
                className="h-8 rounded-full shadow-none"
              >
                Load latest
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onKeepLocalDraft}
                className="h-8 rounded-full shadow-none"
              >
                Replace with my draft
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onDismissConflict}
                className="h-8 rounded-full shadow-none"
              >
                Keep editing
              </Button>
            </div>
          </div>
        </Alert>
      )}

      <div
        className={cn(
          'relative transition-opacity duration-200',
          draftState !== 'idle' && 'opacity-90'
        )}
      >
        <MeetingEditor
          key={`${meeting.id}:${editorRevision}`}
          meeting={meeting}
          editable={editable}
          documentContent={editorSeed}
          onEditorReady={onEditorReady}
          onContentChange={onContentChange}
          autosaveBaseHash={acknowledgedHash}
          autosaveEnabled={!documentConflict && draftState === 'idle'}
          onAutosaveSuccess={onAutosaveSuccess}
          onAutosaveConflict={onAutosaveConflict}
        />
      </div>
    </>
  )
}
