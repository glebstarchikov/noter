'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { AlertCircle, Loader2, RefreshCcw, Sparkles, Undo2, X } from 'lucide-react'
import { toast } from 'sonner'
import { MeetingEditor } from '@/components/meeting-editor'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { hashDocumentContent } from '@/lib/document-hash'
import {
  isDocumentSaveConflict,
  saveMeetingDocument,
  type DocumentSaveConflict,
} from '@/lib/document-sync'
import { isNeutralEnhancementMessage } from '@/lib/enhancement-errors'
import { readApiError } from '@/lib/meeting-pipeline'
import {
  hasTiptapContent,
  normalizeTiptapDocument,
  type TiptapDocument,
} from '@/lib/tiptap-converter'
import type { EnhancementOutcome, EnhancementState, Meeting } from '@/lib/types'
import { cn } from '@/lib/utils'

type DraftMode = 'generate' | 'enhance'
type DraftUiState = 'idle' | 'generating' | 'streaming' | 'saving'

const STREAMING_BLOCK_DELAY_MS = process.env.NODE_ENV === 'test' ? 0 : 50

function normalizeReviewState(state: EnhancementState | null | undefined): EnhancementState {
  return {
    lastReviewedSourceHash: state?.lastReviewedSourceHash ?? null,
    lastOutcome: state?.lastOutcome ?? null,
    lastReviewedAt: state?.lastReviewedAt ?? null,
    lastError: state?.lastError ?? null,
  }
}

export function MeetingNoteSurface({
  meeting,
  transcript,
  isRecordingComplete,
}: {
  meeting: Meeting
  transcript?: string | null
  isRecordingComplete?: boolean
}) {
  const initialDocument = useMemo(
    () => normalizeTiptapDocument(meeting.document_content),
    [meeting.document_content]
  )
  const initialDocumentHash = useMemo(
    () => hashDocumentContent(initialDocument),
    [initialDocument]
  )
  const [editorSeed, setEditorSeed] = useState<TiptapDocument>(initialDocument)
  const [editorRevision, setEditorRevision] = useState(0)
  const [currentDocument, setCurrentDocument] = useState<TiptapDocument>(initialDocument)
  const [acknowledgedHash, setAcknowledgedHash] = useState(initialDocumentHash)
  const [draftState, setDraftState] = useState<DraftUiState>('idle')
  const [undoDocument, setUndoDocument] = useState<TiptapDocument | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [documentConflict, setDocumentConflict] = useState<DocumentSaveConflict | null>(null)
  const [reviewState, setReviewState] = useState<EnhancementState>(normalizeReviewState(meeting.enhancement_state))
  const [wasEverEnhanced, setWasEverEnhanced] = useState(false)
  const [regenPromptDismissed, setRegenPromptDismissed] = useState(false)
  const serverReviewState = useMemo(
    () => normalizeReviewState(meeting.enhancement_state),
    [meeting.enhancement_state]
  )
  const meetingIdRef = useRef(meeting.id)
  const draftStateRef = useRef(draftState)
  const editorRef = useRef<Editor | null>(null)
  const streamingCancelledRef = useRef(false)

  useEffect(() => {
    draftStateRef.current = draftState
  }, [draftState])

  useEffect(() => {
    if (meetingIdRef.current === meeting.id) return

    meetingIdRef.current = meeting.id
    const nextDocument = normalizeTiptapDocument(meeting.document_content)
    setEditorSeed(nextDocument)
    setCurrentDocument(nextDocument)
    setAcknowledgedHash(hashDocumentContent(nextDocument))
    setEditorRevision((value) => value + 1)
    setDraftState('idle')
    setUndoDocument(null)
    setSaveError(null)
    setDocumentConflict(null)
    setReviewState(serverReviewState)
    setWasEverEnhanced(false)
    setRegenPromptDismissed(false)
    streamingCancelledRef.current = true
  }, [meeting.document_content, meeting.id, serverReviewState])

  useEffect(() => {
    if (draftStateRef.current !== 'idle' || undoDocument) return
    setReviewState(serverReviewState)
  }, [serverReviewState, undoDocument])

  const transcriptText = transcript ?? meeting.transcript ?? ''
  const currentHash = hashDocumentContent(currentDocument)
  const hasDocumentContent = hasTiptapContent(currentDocument)
  const canReview =
    Boolean(transcriptText.trim()) && (isRecordingComplete ?? meeting.status !== 'recording')
  const isNeutralDraftFeedback = isNeutralEnhancementMessage(reviewState.lastError)
  const shouldShowAction =
    canReview &&
    draftState === 'idle' &&
    !documentConflict &&
    currentHash !== reviewState.lastReviewedSourceHash

  const actionMode: DraftMode = hasDocumentContent ? 'enhance' : 'generate'

  const showRegenPrompt =
    wasEverEnhanced &&
    shouldShowAction &&
    draftState === 'idle' &&
    !regenPromptDismissed &&
    !documentConflict

  const showFab =
    canReview &&
    !documentConflict &&
    (shouldShowAction || draftState !== 'idle')

  const fabIsLoading = draftState !== 'idle'

  const handleEditorReady = useCallback((editor: Editor | null) => {
    editorRef.current = editor
  }, [])

  const handleEditorContentChange = useCallback((document: unknown) => {
    const normalizedDocument = normalizeTiptapDocument(document)
    const nextHash = hashDocumentContent(normalizedDocument)

    setCurrentDocument((existingDocument) =>
      hashDocumentContent(existingDocument) === nextHash ? existingDocument : normalizedDocument
    )
    setSaveError(null)
    setUndoDocument(null)
  }, [])

  const handleAutosaveConflict = useCallback((payload: {
    currentDocument: TiptapDocument
    currentHash: string
    message: string
  }) => {
    setDocumentConflict({
      ok: false,
      code: 'STALE_DOCUMENT',
      ...payload,
    })
    setSaveError(null)
  }, [])

  const handleAutosaveSuccess = useCallback((payload: { documentHash: string }) => {
    setAcknowledgedHash(payload.documentHash)
    setDocumentConflict(null)
  }, [])

  const persistCurrentDocument = useCallback(
    async (document: TiptapDocument, baseHash = acknowledgedHash) => {
      const result = await saveMeetingDocument({
        meetingId: meeting.id,
        document,
        baseHash,
      })

      if (isDocumentSaveConflict(result)) {
        setDocumentConflict(result)
        const conflictError = new Error(result.message)
        ;(conflictError as Error & { code?: string }).code = result.code
        throw conflictError
      }

      setAcknowledgedHash(result.documentHash)
      setDocumentConflict(null)
      return result
    },
    [acknowledgedHash, meeting.id]
  )

  const handleLoadLatestVersion = useCallback(() => {
    if (!documentConflict) return

    setCurrentDocument(documentConflict.currentDocument)
    setEditorSeed(documentConflict.currentDocument)
    setAcknowledgedHash(documentConflict.currentHash)
    setEditorRevision((value) => value + 1)
    setUndoDocument(null)
    setDraftState('idle')
    setSaveError(null)
    setDocumentConflict(null)
    streamingCancelledRef.current = true
  }, [documentConflict])

  const handleKeepLocalDraft = useCallback(async () => {
    if (!documentConflict) return

    try {
      await persistCurrentDocument(currentDocument, documentConflict.currentHash)
      toast.success('Your local draft replaced the newer server version.')
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to replace the server version'
      toast.error(message)
    }
  }, [currentDocument, documentConflict, persistCurrentDocument])

  const handleUndo = useCallback(() => {
    const editor = editorRef.current
    if (!editor || !undoDocument) return

    editor.commands.setContent(undoDocument, { emitUpdate: true })
    setEditorSeed(undoDocument)
    setUndoDocument(null)
  }, [undoDocument])

  const streamProposedDocument = async ({
    sourceHash,
    baseDocument,
    proposedDocument,
  }: {
    sourceHash: string
    baseDocument: TiptapDocument
    proposedDocument: TiptapDocument
  }) => {
    const editor = editorRef.current
    if (!editor) return

    streamingCancelledRef.current = false
    setDraftState('streaming')

    const blocks = proposedDocument.content ?? []

    // Start with first block immediately — no blank flash
    if (blocks.length > 0) {
      editor.commands.setContent({ type: 'doc', content: [blocks[0]] }, { emitUpdate: false })
    }

    for (let i = 1; i < blocks.length; i++) {
      await new Promise<void>((r) => setTimeout(r, STREAMING_BLOCK_DELAY_MS))
      if (streamingCancelledRef.current) return
      editor.commands.setContent(
        { type: 'doc', content: blocks.slice(0, i + 1) },
        { emitUpdate: false }
      )
    }

    setDraftState('saving')

    try {
      const response = await fetch(`/api/meetings/${meetingIdRef.current}/enhance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete',
          outcome: 'accepted' satisfies EnhancementOutcome,
          sourceHash,
          documentContent: proposedDocument,
        }),
      })

      if (!response.ok) {
        const { message } = await readApiError(response, 'Failed to save AI changes')
        throw new Error(message)
      }

      const payload = (await response.json()) as {
        enhancement_state: EnhancementState
        document_content: TiptapDocument
        documentHash: string
      }

      setReviewState(normalizeReviewState(payload.enhancement_state))
      setAcknowledgedHash(payload.documentHash)
      setEditorSeed(proposedDocument)
      setDocumentConflict(null)
      setUndoDocument(baseDocument)
      setWasEverEnhanced(true)
      setRegenPromptDismissed(false)
      setDraftState('idle')
    } catch (error) {
      // Revert editor to base content on failure
      editor.commands.setContent(baseDocument, { emitUpdate: false })
      setEditorSeed(baseDocument)
      setDraftState('idle')
      const message = error instanceof Error ? error.message : 'Failed to save AI changes'
      toast.error(message)
    }
  }

  const handleDraftRequest = async () => {
    if (!shouldShowAction && draftState === 'idle') return

    setRegenPromptDismissed(false)
    setDraftState('generating')
    setSaveError(null)

    try {
      await persistCurrentDocument(currentDocument)

      const response = await fetch(`/api/meetings/${meeting.id}/enhance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          mode: actionMode,
          documentContent: currentDocument,
        }),
      })

      if (!response.ok) {
        const { message, code } = await readApiError(response, 'Failed to draft notes')
        const draftError = new Error(message)
        ;(draftError as Error & { code?: string }).code = code
        throw draftError
      }

      const payload = (await response.json()) as {
        sourceHash: string
        summary?: string
        mode: DraftMode
        proposedDocument: TiptapDocument
      }

      setReviewState((current) => ({ ...current, lastError: null }))
      setDocumentConflict(null)
      void streamProposedDocument({
        sourceHash: payload.sourceHash,
        baseDocument: currentDocument,
        proposedDocument: payload.proposedDocument,
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to draft notes'
      const code =
        error instanceof Error && 'code' in error ? (error as { code?: string }).code : undefined
      if (code !== 'STALE_DOCUMENT') {
        if (!isNeutralEnhancementMessage(message)) {
          toast.error(message)
        }
        setReviewState((current) => ({
          ...current,
          lastError: message,
        }))
      }
      setDraftState('idle')
    }
  }

  return (
    <div className="flex flex-col">
      <section
        className={cn(
          'surface-document relative px-6 py-6 md:px-8 md:py-8',
          (draftState === 'generating' || draftState === 'streaming') && 'surface-thinking'
        )}
      >
        <div className="mx-auto w-full max-w-4xl space-y-4">
          {documentConflict && (
            <Alert className="rounded-2xl border-amber-300/60 bg-amber-50/80 text-amber-950">
              <AlertCircle />
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex flex-col gap-1">
                  <AlertTitle className="line-clamp-none">A newer version of this note exists</AlertTitle>
                  <AlertDescription className="text-amber-900/80">
                    {documentConflict.message}
                  </AlertDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLoadLatestVersion}
                    className="h-8 rounded-full border-amber-300/70 bg-transparent shadow-none"
                  >
                    Load latest
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleKeepLocalDraft()}
                    className="liquid-glass-button h-8 rounded-full"
                  >
                    Replace with my draft
                  </Button>
                </div>
              </div>
            </Alert>
          )}

          {reviewState.lastError && draftState === 'idle' && (
            <Alert
              variant={isNeutralDraftFeedback ? 'default' : 'destructive'}
              className={cn(
                'rounded-2xl',
                isNeutralDraftFeedback
                  ? 'border-border/70 bg-secondary/40 text-muted-foreground'
                  : 'border-destructive/20 bg-destructive/5'
              )}
            >
              {!isNeutralDraftFeedback ? <AlertCircle /> : null}
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex flex-col gap-1">
                  <AlertTitle className="line-clamp-none">
                    {isNeutralDraftFeedback ? 'No changes suggested' : 'Drafting needs another try'}
                  </AlertTitle>
                  <AlertDescription>{reviewState.lastError}</AlertDescription>
                </div>
                {canReview && !documentConflict ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleDraftRequest()}
                    className="h-8 rounded-full shadow-none"
                  >
                    <RefreshCcw className="size-4" />
                    Retry draft
                  </Button>
                ) : null}
              </div>
            </Alert>
          )}

          {showRegenPrompt && (
            <div className="liquid-glass-chip glass-chip-enter flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm backdrop-blur">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Sparkles className="size-3.5 text-accent" />
                <span>Your note has changed since the last generation</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleDraftRequest()}
                  className="rounded-full bg-foreground/[0.08] px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-foreground/[0.12]"
                >
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={() => setRegenPromptDismissed(true)}
                  aria-label="Dismiss"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          )}

          <div className="relative">
            {draftState === 'generating' && (
              <div className="enhance-shimmer-overlay rounded-3xl" />
            )}

            {(draftState === 'generating' || draftState === 'streaming') && (
              <div className="absolute inset-x-0 top-8 z-10 flex justify-center">
                <div className="liquid-glass-chip flex items-center gap-2.5 rounded-full px-4 py-2 text-sm text-muted-foreground backdrop-blur">
                  <Loader2 className="size-4 animate-spin text-accent" />
                  {actionMode === 'generate'
                    ? 'Generating a first draft from the transcript…'
                    : 'Drafting improvements…'}
                </div>
              </div>
            )}

            {undoDocument && draftState === 'idle' && (
              <div className="mb-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleUndo}
                  className="liquid-glass-chip glass-chip-enter liquid-glass-interactive flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground backdrop-blur hover:text-foreground"
                >
                  <Undo2 className="size-3.5" />
                  Undo AI changes
                </button>
              </div>
            )}

            <MeetingEditor
              key={`${meeting.id}:${editorRevision}`}
              meeting={meeting}
              editable={draftState === 'idle'}
              documentContent={editorSeed}
              onEditorReady={handleEditorReady}
              onContentChange={handleEditorContentChange}
              autosaveBaseHash={acknowledgedHash}
              autosaveEnabled={!documentConflict && draftState === 'idle'}
              onAutosaveSuccess={handleAutosaveSuccess}
              onAutosaveConflict={handleAutosaveConflict}
            />
          </div>
        </div>
      </section>

      {showFab && (
        <div className="flex justify-center pt-5">
          <Button
            type="button"
            onClick={() => void handleDraftRequest()}
            disabled={fabIsLoading}
            className="liquid-glass-fab glass-chip-enter h-11 rounded-full px-5 text-sm font-medium"
          >
            {fabIsLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {actionMode === 'generate' ? 'Generating…' : 'Enhancing…'}
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                {actionMode === 'generate' ? 'Generate notes' : 'Enhance'}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
