'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  Sparkles,
  Undo2,
} from 'lucide-react'
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
import { isNeutralEnhancementMessage } from '@/lib/notes/enhancement-errors'
import {
  hasTiptapContent,
  legacyMeetingToTiptap,
  normalizeTiptapDocument,
  type TiptapDocument,
} from '@/lib/tiptap/tiptap-converter'
import type { Meeting, MeetingStatus } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useNoteEnhancement } from '@/hooks/use-note-enhancement'

type NoteSurfaceView =
  | 'empty-generating'
  | 'empty-ready'
  | 'content-ready'
  | 'error'
  | 'conflict'

type DraftProgressState = 'done' | 'active' | 'pending'

const GENERATED_REVEAL_DURATION_MS = 2200
const AUTO_DRAFT_PROGRESS_STEPS: { label: string; state: DraftProgressState }[] = [
  { label: 'Audio saved', state: 'done' },
  { label: 'Transcript ready', state: 'done' },
  { label: 'Drafting notes', state: 'active' },
]

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
  const [showManualEditor, setShowManualEditor] = useState(hasTiptapContent(initialDocument))
  const [showGeneratedReveal, setShowGeneratedReveal] = useState(false)

  const meetingIdRef = useRef(meeting.id)
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const transcriptText = transcript ?? meeting.transcript ?? ''
  const hasDocumentContent = hasTiptapContent(currentDocument)
  const canReview =
    Boolean(transcriptText.trim()) && (isRecordingComplete ?? meeting.status !== 'recording')
  const actionMode = hasDocumentContent ? 'enhance' : 'generate'
  const currentHash = hashDocumentContent(currentDocument)

  const handleDocumentAccepted = useCallback(
    (payload: {
      document: TiptapDocument
      documentHash: string
      baseDocument: TiptapDocument
      wasFirstGeneration: boolean
    }) => {
      setEditorSeed(payload.document)
      setCurrentDocument(payload.document)
      setAcknowledgedHash(payload.documentHash)
      setShowManualEditor(true)

      if (payload.wasFirstGeneration) {
        setShowGeneratedReveal(true)
      }
    },
    []
  )

  const handleAcknowledgedHashChange = useCallback((hash: string) => {
    setAcknowledgedHash(hash)
  }, [])

  const handleLoadLatestVersionCallback = useCallback(
    (payload: { document: TiptapDocument; documentHash: string }) => {
      setCurrentDocument(payload.document)
      setEditorSeed(payload.document)
      setAcknowledgedHash(payload.documentHash)
      setEditorRevision((value) => value + 1)
      setShowManualEditor(hasTiptapContent(payload.document))
    },
    []
  )

  const handleShowEditor = useCallback(() => {
    setShowManualEditor(true)
  }, [])

  const {
    draftState,
    reviewState,
    undoDocument,
    documentConflict,
    wasEverEnhanced,
    regenPromptDismissed,
    shouldShowAction,
    setRegenPromptDismissed,
    setDocumentConflict,
    clearUndoDocument,
    handleDraftRequest,
    handleUndo,
    handleLoadLatestVersion,
    handleKeepLocalDraft,
    setEditorRef,
  } = useNoteEnhancement(meeting, {
    currentDocument,
    acknowledgedHash,
    currentHash,
    actionMode,
    canReview,
    meetingStatus: meeting.status,
    hasDocumentContent,
    onDocumentAccepted: handleDocumentAccepted,
    onAcknowledgedHashChange: handleAcknowledgedHashChange,
    onLoadLatestVersion: handleLoadLatestVersionCallback,
    onShowEditor: handleShowEditor,
  })

  // Reset all editor state when the meeting changes
  useEffect(() => {
    if (meetingIdRef.current === meeting.id) return

    meetingIdRef.current = meeting.id
    const nextDocument = normalizeTiptapDocument(meeting.document_content)
    setEditorSeed(nextDocument)
    setCurrentDocument(nextDocument)
    setAcknowledgedHash(hashDocumentContent(nextDocument))
    setEditorRevision((value) => value + 1)
    setShowManualEditor(hasTiptapContent(nextDocument))
    setShowGeneratedReveal(false)

    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current)
      revealTimerRef.current = null
    }
  }, [meeting.document_content, meeting.id])

  // Detect when document_content arrives for a meeting that had none
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

  // Auto-clear the "new draft ready" reveal badge
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

  const handleEditorReady = useCallback(
    (editor: Parameters<typeof setEditorRef>[0]) => {
      setEditorRef(editor)
    },
    [setEditorRef]
  )

  const handleEditorContentChange = useCallback(
    (document: unknown) => {
      const normalizedDocument = normalizeTiptapDocument(document)
      const nextHash = hashDocumentContent(normalizedDocument)

      setCurrentDocument((existingDocument) =>
        hashDocumentContent(existingDocument) === nextHash ? existingDocument : normalizedDocument
      )
      clearUndoDocument()
    },
    [clearUndoDocument]
  )

  const handleAutosaveConflict = useCallback(
    (payload: { currentDocument: TiptapDocument; currentHash: string; message: string }) => {
      setDocumentConflict({
        ok: false,
        code: 'STALE_DOCUMENT',
        ...payload,
      })
    },
    [setDocumentConflict]
  )

  const handleAutosaveSuccess = useCallback(
    (payload: { documentHash: string }) => {
      setAcknowledgedHash(payload.documentHash)
      setDocumentConflict(null)
    },
    [setDocumentConflict]
  )

  const isNeutralDraftFeedback = isNeutralEnhancementMessage(reviewState.lastError)
  const noteSurfaceView = getNoteSurfaceView({
    status: meeting.status,
    hasDocumentContent,
    hasConflict: Boolean(documentConflict),
  })

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
                      ? "We couldn't create a first draft"
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
