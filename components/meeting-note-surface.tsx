'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  Sparkles,
  Undo2,
} from 'lucide-react'
import { toast } from 'sonner'
import { MeetingEditor } from '@/components/meeting-editor'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
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
  legacyMeetingToTiptap,
  normalizeTiptapDocument,
  type TiptapDocument,
} from '@/lib/tiptap-converter'
import type { EnhancementOutcome, EnhancementState, Meeting, MeetingStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

type DraftMode = 'generate' | 'enhance'
type DraftUiState = 'idle' | 'generating' | 'streaming' | 'saving'
type NoteSurfaceView =
  | 'empty-generating'
  | 'empty-ready'
  | 'content-ready'
  | 'error'
  | 'conflict'

type DraftProgressState = 'done' | 'active' | 'pending'

const STREAMING_BLOCK_DELAY_MS = process.env.NODE_ENV === 'test' ? 0 : 50
const AUTO_DRAFT_PROGRESS_STEPS: { label: string; state: DraftProgressState }[] = [
  { label: 'Audio saved', state: 'done' },
  { label: 'Transcript ready', state: 'done' },
  { label: 'Drafting notes', state: 'active' },
]
const GENERATED_REVEAL_DURATION_MS = 2200

function normalizeReviewState(state: EnhancementState | null | undefined): EnhancementState {
  return {
    lastReviewedSourceHash: state?.lastReviewedSourceHash ?? null,
    lastOutcome: state?.lastOutcome ?? null,
    lastReviewedAt: state?.lastReviewedAt ?? null,
    lastError: state?.lastError ?? null,
  }
}

function getNoteSurfaceView({
  status,
  hasDocumentContent,
  hasConflict,
}: {
  status: MeetingStatus
  hasDocumentContent: boolean
  hasConflict: boolean
}): NoteSurfaceView {
  if (hasConflict) return 'conflict'
  if (hasDocumentContent) return 'content-ready'
  if (status === 'generating') return 'empty-generating'
  if (status === 'error') return 'error'
  return 'empty-ready'
}

function DraftProgressIcon({ state }: { state: DraftProgressState }) {
  if (state === 'done') {
    return <CheckCircle2 className="size-4 text-accent" />
  }

  if (state === 'active') {
    return <Loader2 className="size-4 animate-spin text-foreground" />
  }

  return <span className="size-3 rounded-full border border-muted-foreground/30" />
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
  const initialDocument = useMemo(() => {
    const doc = normalizeTiptapDocument(meeting.document_content)
    if (hasTiptapContent(doc)) return doc
    const legacy = legacyMeetingToTiptap(meeting)
    return hasTiptapContent(legacy) ? legacy : doc
  }, [meeting])
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
  const [documentConflict, setDocumentConflict] = useState<DocumentSaveConflict | null>(null)
  const [reviewState, setReviewState] = useState<EnhancementState>(
    normalizeReviewState(meeting.enhancement_state)
  )
  const [wasEverEnhanced, setWasEverEnhanced] = useState(false)
  const [regenPromptDismissed, setRegenPromptDismissed] = useState(false)
  const [showManualEditor, setShowManualEditor] = useState(hasTiptapContent(initialDocument))
  const [showGeneratedReveal, setShowGeneratedReveal] = useState(false)
  const serverReviewState = useMemo(
    () => normalizeReviewState(meeting.enhancement_state),
    [meeting.enhancement_state]
  )
  const meetingIdRef = useRef(meeting.id)
  const draftStateRef = useRef(draftState)
  const editorRef = useRef<Editor | null>(null)
  const streamingCancelledRef = useRef(false)
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    setDocumentConflict(null)
    setReviewState(serverReviewState)
    setWasEverEnhanced(false)
    setRegenPromptDismissed(false)
    setShowManualEditor(hasTiptapContent(nextDocument))
    setShowGeneratedReveal(false)
    streamingCancelledRef.current = true

    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current)
      revealTimerRef.current = null
    }
  }, [meeting.document_content, meeting.id, serverReviewState])

  useEffect(() => {
    if (draftStateRef.current !== 'idle' || undoDocument) return
    setReviewState(serverReviewState)
  }, [serverReviewState, undoDocument])

  useEffect(() => {
    if (meetingIdRef.current !== meeting.id) return
    const nextDoc = normalizeTiptapDocument(meeting.document_content)
    if (!hasTiptapContent(editorSeed) && hasTiptapContent(nextDoc)) {
      setEditorSeed(nextDoc)
      setCurrentDocument(nextDoc)
      setAcknowledgedHash(hashDocumentContent(nextDoc))
      setEditorRevision((value) => value + 1)
      setShowManualEditor(true)
      setShowGeneratedReveal(true)
    }
  }, [meeting.document_content, meeting.id, editorSeed])

  useEffect(() => {
    if (!showGeneratedReveal) return

    revealTimerRef.current = setTimeout(() => {
      setShowGeneratedReveal(false)
      revealTimerRef.current = null
    }, GENERATED_REVEAL_DURATION_MS)

    return () => {
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current)
        revealTimerRef.current = null
      }
    }
  }, [showGeneratedReveal])

  const transcriptText = transcript ?? meeting.transcript ?? ''
  const currentHash = hashDocumentContent(currentDocument)
  const hasDocumentContent = hasTiptapContent(currentDocument)
  const canReview =
    Boolean(transcriptText.trim()) && (isRecordingComplete ?? meeting.status !== 'recording')
  const isNeutralDraftFeedback = isNeutralEnhancementMessage(reviewState.lastError)
  const noteSurfaceView = getNoteSurfaceView({
    status: meeting.status,
    hasDocumentContent,
    hasConflict: Boolean(documentConflict),
  })

  const actionMode: DraftMode = hasDocumentContent ? 'enhance' : 'generate'
  const loadingLabel =
    draftState === 'saving'
      ? 'Saving changes…'
      : draftState === 'streaming'
        ? actionMode === 'generate'
          ? 'Writing draft…'
          : 'Applying draft…'
        : actionMode === 'generate'
          ? 'Creating draft…'
          : 'Improving…'
  const draftActionLabel =
    noteSurfaceView === 'error'
      ? 'Try again'
      : hasDocumentContent
        ? 'Improve with AI'
        : showManualEditor
          ? 'Create first draft'
          : 'Generate notes with AI'

  const shouldShowAction =
    canReview &&
    noteSurfaceView !== 'empty-generating' &&
    draftState === 'idle' &&
    !documentConflict &&
    currentHash !== reviewState.lastReviewedSourceHash
  const showRegenPrompt =
    hasDocumentContent &&
    wasEverEnhanced &&
    shouldShowAction &&
    draftState === 'idle' &&
    !regenPromptDismissed &&
    !documentConflict
  const showEmptyStatePrimaryAction =
    shouldShowAction && !hasDocumentContent && !showManualEditor
  const showHeaderDraftAction =
    (shouldShowAction || draftState !== 'idle') &&
    noteSurfaceView !== 'empty-generating' &&
    (hasDocumentContent || showManualEditor || noteSurfaceView === 'conflict')
  const showHeaderActions =
    showHeaderDraftAction ||
    Boolean(undoDocument && draftState === 'idle') ||
    Boolean(reviewState.lastError && draftState === 'idle')
  const shouldShowEditor =
    hasDocumentContent || showManualEditor || draftState !== 'idle' || Boolean(documentConflict)
  const showEmptyState =
    !shouldShowEditor &&
    (noteSurfaceView === 'empty-generating' ||
      noteSurfaceView === 'empty-ready' ||
      noteSurfaceView === 'error')

  const handleEditorReady = useCallback((editor: Editor | null) => {
    editorRef.current = editor
  }, [])

  const handleEditorContentChange = useCallback((document: unknown) => {
    const normalizedDocument = normalizeTiptapDocument(document)
    const nextHash = hashDocumentContent(normalizedDocument)

    setCurrentDocument((existingDocument) =>
      hashDocumentContent(existingDocument) === nextHash ? existingDocument : normalizedDocument
    )
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
    setDocumentConflict(null)
    setShowManualEditor(hasTiptapContent(documentConflict.currentDocument))
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

  const waitForEditor = useCallback(async () => {
    if (editorRef.current) return editorRef.current

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 25))
      if (editorRef.current) return editorRef.current
    }

    return null
  }, [])

  const streamProposedDocument = async ({
    sourceHash,
    baseDocument,
    proposedDocument,
  }: {
    sourceHash: string
    baseDocument: TiptapDocument
    proposedDocument: TiptapDocument
  }) => {
    const editor = await waitForEditor()
    if (!editor) {
      setDraftState('idle')
      toast.error('The editor is not ready yet. Please try again.')
      return
    }

    streamingCancelledRef.current = false
    setDraftState('streaming')

    const blocks = proposedDocument.content ?? []

    if (blocks.length > 0) {
      editor.commands.setContent({ type: 'doc', content: [blocks[0]] }, { emitUpdate: false })
    }

    for (let i = 1; i < blocks.length; i += 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, STREAMING_BLOCK_DELAY_MS))
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
      setEditorSeed(payload.document_content)
      setCurrentDocument(payload.document_content)
      setDocumentConflict(null)
      setUndoDocument(baseDocument)
      setWasEverEnhanced(true)
      setRegenPromptDismissed(false)
      setDraftState('idle')
      setShowManualEditor(true)

      if (!hasTiptapContent(baseDocument) && hasTiptapContent(payload.document_content)) {
        setShowGeneratedReveal(true)
      }
    } catch (error) {
      editor.commands.setContent(baseDocument, { emitUpdate: false })
      setEditorSeed(baseDocument)
      setCurrentDocument(baseDocument)
      setDraftState('idle')
      const message = error instanceof Error ? error.message : 'Failed to save AI changes'
      toast.error(message)
    }
  }

  const handleDraftRequest = async () => {
    if (!shouldShowAction && draftState === 'idle') return

    if (!hasDocumentContent) {
      setShowManualEditor(true)
    }

    setRegenPromptDismissed(false)
    setDraftState('generating')

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

  const headerStateCopy = (() => {
    switch (noteSurfaceView) {
      case 'empty-generating':
        return showManualEditor
          ? 'The first draft is still being created in the background. Anything you type now stays editable.'
          : 'The first draft is being created automatically and will appear here.'
      case 'empty-ready':
        return showManualEditor
          ? 'Start typing now, or ask AI to create a first draft from the transcript.'
          : canReview
            ? 'No notes yet. Generate a first draft or start typing manually.'
            : 'No notes yet. Start typing manually to begin.'
      case 'content-ready':
        return 'Edit freely here. Use AI only when you want a second pass.'
      case 'error':
        return showManualEditor
          ? 'Automatic draft generation failed. You can keep typing or retry.'
          : 'Automatic draft generation failed. Retry or start typing manually.'
      case 'conflict':
        return 'Resolve the newer saved version before continuing.'
      default:
        return ''
    }
  })()

  return (
    <div className="flex flex-col">
      <section
        className={cn(
          'surface-document relative px-6 py-6 transition-colors duration-700 md:px-8 md:py-8',
          showGeneratedReveal && 'bg-accent/[0.03] ring-1 ring-accent/20'
        )}
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
          {documentConflict && (
            <Alert className="rounded-2xl border-amber-300/60 bg-amber-50/80 text-amber-950">
              <AlertCircle />
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex flex-col gap-1">
                  <AlertTitle className="line-clamp-none">
                    A newer version of this note exists
                  </AlertTitle>
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDocumentConflict(null)}
                    className="h-8 rounded-full text-amber-900/70 shadow-none"
                  >
                    Keep editing
                  </Button>
                </div>
              </div>
            </Alert>
          )}

          <div className="flex flex-col gap-4 border-b border-border/60 pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">Notes</h2>
                  {showGeneratedReveal ? (
                    <Badge variant="secondary" className="rounded-full">
                      New draft ready
                    </Badge>
                  ) : null}
                  {noteSurfaceView === 'empty-generating' && !showGeneratedReveal ? (
                    <Badge variant="secondary" className="rounded-full">
                      Draft in progress
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{headerStateCopy}</p>
              </div>

              {showHeaderActions ? (
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {showHeaderDraftAction && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="relative gap-2 rounded-full border-border/70 bg-background/80 shadow-none"
                          onClick={() => void handleDraftRequest()}
                          disabled={draftState !== 'idle'}
                        >
                          {draftState !== 'idle' ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Sparkles className="size-4" />
                          )}
                          {draftState !== 'idle' ? loadingLabel : draftActionLabel}
                          {showRegenPrompt && draftState === 'idle' ? (
                            <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-accent" />
                          ) : null}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {showRegenPrompt
                          ? 'Your note changed since the last improvement'
                          : 'Use AI to review this note'}
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {undoDocument && draftState === 'idle' ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="rounded-full gap-1.5"
                          onClick={handleUndo}
                        >
                          <Undo2 className="size-3.5" />
                          Undo
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Revert AI changes</TooltipContent>
                    </Tooltip>
                  ) : null}

                  {reviewState.lastError && draftState === 'idle' ? (
                    <>
                      <Badge
                        variant={isNeutralDraftFeedback ? 'secondary' : 'destructive'}
                        className="rounded-full"
                      >
                        {isNeutralDraftFeedback ? 'No changes suggested' : 'Draft failed'}
                      </Badge>
                      {!isNeutralDraftFeedback && canReview ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 rounded-full gap-1"
                              onClick={() => void handleDraftRequest()}
                            >
                              <RefreshCcw className="size-3" />
                              Retry
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Try again</TooltipContent>
                        </Tooltip>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>

            {shouldShowEditor && noteSurfaceView === 'empty-generating' && !hasDocumentContent ? (
              <Alert className="rounded-2xl border-border/70 bg-secondary/30">
                <Loader2 className="animate-spin text-accent" />
                <div className="flex flex-col gap-1">
                  <AlertTitle className="line-clamp-none">
                    Drafting notes in the background
                  </AlertTitle>
                  <AlertDescription>
                    Your first draft will appear here automatically. Anything you type now stays
                    editable.
                  </AlertDescription>
                </div>
              </Alert>
            ) : null}
          </div>

          {showEmptyState ? (
            <Empty className="surface-empty min-h-[360px] gap-8 px-6 py-12 md:min-h-[420px]">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  {noteSurfaceView === 'empty-generating' ? (
                    <Loader2 className="animate-spin" />
                  ) : noteSurfaceView === 'error' ? (
                    <AlertCircle />
                  ) : (
                    <Sparkles />
                  )}
                </EmptyMedia>
                <EmptyTitle>
                  {noteSurfaceView === 'empty-generating'
                    ? 'Creating your first draft…'
                    : noteSurfaceView === 'error'
                      ? 'We couldn’t create a first draft'
                      : 'No notes yet'}
                </EmptyTitle>
                <EmptyDescription>
                  {noteSurfaceView === 'empty-generating'
                    ? 'Your notes will appear here automatically. Start typing only if you want to capture something before the draft lands.'
                    : noteSurfaceView === 'error'
                      ? meeting.error_message || 'Try again or start typing manually.'
                      : canReview
                        ? 'Generate a first draft from the transcript or start typing manually.'
                        : 'Start typing manually to begin this note.'}
                </EmptyDescription>
              </EmptyHeader>

              <EmptyContent className="max-w-md gap-5">
                {noteSurfaceView === 'empty-generating' ? (
                  <>
                    <Progress value={67} />
                    <div className="flex w-full flex-col gap-3 text-left">
                      {AUTO_DRAFT_PROGRESS_STEPS.map((step) => (
                        <div key={step.label} className="flex items-center gap-3">
                          <DraftProgressIcon state={step.state} />
                          <span
                            className={cn(
                              'text-sm',
                              step.state === 'done' && 'font-medium text-accent',
                              step.state === 'active' && 'font-semibold text-foreground',
                              step.state === 'pending' && 'text-muted-foreground'
                            )}
                          >
                            {step.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}

                <div className="flex flex-wrap items-center justify-center gap-3">
                  {showEmptyStatePrimaryAction ? (
                    <Button
                      type="button"
                      className="rounded-full gap-2"
                      onClick={() => void handleDraftRequest()}
                      disabled={draftState !== 'idle'}
                    >
                      {draftState !== 'idle' ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4" />
                      )}
                      {noteSurfaceView === 'error' ? 'Try again' : 'Generate notes with AI'}
                    </Button>
                  ) : null}

                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setShowManualEditor(true)}
                  >
                    Start typing manually
                  </Button>
                </div>
              </EmptyContent>
            </Empty>
          ) : null}

          <div
            className={cn(
              'relative transition-opacity duration-200',
              draftState !== 'idle' && 'opacity-90',
              !shouldShowEditor && 'hidden'
            )}
          >
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
    </div>
  )
}
