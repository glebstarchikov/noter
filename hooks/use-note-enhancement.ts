'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { toast } from 'sonner'
import { isDocumentSaveConflict, saveMeetingDocument, type DocumentSaveConflict } from '@/lib/document-sync'
import { isNeutralEnhancementMessage } from '@/lib/notes/enhancement-errors'
import { readApiError } from '@/lib/meetings/meeting-pipeline'
import { hasTiptapContent, normalizeTiptapDocument, type TiptapDocument } from '@/lib/tiptap/tiptap-converter'
import type { EnhancementOutcome, EnhancementState, Meeting, MeetingStatus } from '@/lib/types'

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

export type UseNoteEnhancementReturn = {
  draftState: DraftUiState
  reviewState: EnhancementState
  undoDocument: TiptapDocument | null
  documentConflict: DocumentSaveConflict | null
  wasEverEnhanced: boolean
  regenPromptDismissed: boolean
  shouldShowAction: boolean
  setRegenPromptDismissed: (value: boolean) => void
  setDocumentConflict: (value: DocumentSaveConflict | null) => void
  clearUndoDocument: () => void
  handleDraftRequest: () => Promise<void>
  handleUndo: () => void
  handleLoadLatestVersion: () => void
  handleKeepLocalDraft: () => Promise<void>
  setEditorRef: (editor: Editor | null) => void
}

export function useNoteEnhancement(
  meeting: Meeting,
  {
    currentDocument,
    acknowledgedHash,
    currentHash,
    actionMode,
    canReview,
    meetingStatus,
    hasDocumentContent,
    onDocumentAccepted,
    onAcknowledgedHashChange,
    onLoadLatestVersion: onLoadLatestVersionCallback,
    onShowEditor,
  }: {
    currentDocument: TiptapDocument
    acknowledgedHash: string
    currentHash: string
    actionMode: DraftMode
    canReview: boolean
    meetingStatus: MeetingStatus
    hasDocumentContent: boolean
    onDocumentAccepted: (payload: {
      document: TiptapDocument
      documentHash: string
      baseDocument: TiptapDocument
      wasFirstGeneration: boolean
    }) => void
    onAcknowledgedHashChange: (hash: string) => void
    onLoadLatestVersion: (payload: { document: TiptapDocument; documentHash: string }) => void
    /** Called when a draft is requested on an empty document, to show the editor immediately. */
    onShowEditor: () => void
  }
): UseNoteEnhancementReturn {
  const serverReviewState = useMemo(
    () => normalizeReviewState(meeting.enhancement_state),
    [meeting.enhancement_state]
  )

  const [draftState, setDraftState] = useState<DraftUiState>('idle')
  const [undoDocument, setUndoDocument] = useState<TiptapDocument | null>(null)
  const [documentConflict, setDocumentConflict] = useState<DocumentSaveConflict | null>(null)
  const [reviewState, setReviewState] = useState<EnhancementState>(
    normalizeReviewState(meeting.enhancement_state)
  )
  const [wasEverEnhanced, setWasEverEnhanced] = useState(false)
  const [regenPromptDismissed, setRegenPromptDismissed] = useState(false)

  const meetingIdRef = useRef(meeting.id)
  const draftStateRef = useRef(draftState)
  const editorRef = useRef<Editor | null>(null)
  const streamingCancelledRef = useRef(false)
  const acknowledgedHashRef = useRef(acknowledgedHash)
  const currentDocumentRef = useRef(currentDocument)

  useEffect(() => {
    draftStateRef.current = draftState
  }, [draftState])

  useEffect(() => {
    acknowledgedHashRef.current = acknowledgedHash
  }, [acknowledgedHash])

  useEffect(() => {
    currentDocumentRef.current = currentDocument
  }, [currentDocument])

  // Reset all enhancement state when the meeting changes
  useEffect(() => {
    if (meetingIdRef.current === meeting.id) return

    meetingIdRef.current = meeting.id
    setDraftState('idle')
    setUndoDocument(null)
    setDocumentConflict(null)
    setReviewState(serverReviewState)
    setWasEverEnhanced(false)
    setRegenPromptDismissed(false)
    streamingCancelledRef.current = true
  }, [meeting.id, serverReviewState])

  // Sync server review state when idle and no pending undo
  useEffect(() => {
    if (draftStateRef.current !== 'idle' || undoDocument) return
    setReviewState(serverReviewState)
  }, [serverReviewState, undoDocument])

  // Mirrors getNoteSurfaceView: 'empty-generating' only when no content, no conflict, status=generating
  const isEmptyGenerating = !hasDocumentContent && !documentConflict && meetingStatus === 'generating'
  const shouldShowAction =
    canReview &&
    !isEmptyGenerating &&
    draftState === 'idle' &&
    !documentConflict &&
    currentHash !== reviewState.lastReviewedSourceHash

  const setEditorRef = useCallback((editor: Editor | null) => {
    editorRef.current = editor
  }, [])

  const waitForEditor = useCallback(async () => {
    if (editorRef.current) return editorRef.current

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 25))
      if (editorRef.current) return editorRef.current
    }

    return null
  }, [])

  const persistCurrentDocument = useCallback(
    async (document: TiptapDocument, baseHash = acknowledgedHashRef.current) => {
      const result = await saveMeetingDocument({
        meetingId: meetingIdRef.current,
        document,
        baseHash,
      })

      if (isDocumentSaveConflict(result)) {
        setDocumentConflict(result)
        const conflictError = new Error(result.message)
        ;(conflictError as Error & { code?: string }).code = result.code
        throw conflictError
      }

      onAcknowledgedHashChange(result.documentHash)
      setDocumentConflict(null)
      return result
    },
    [onAcknowledgedHashChange]
  )

  const streamProposedDocument = useCallback(
    async ({
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

        const wasFirstGeneration =
          !hasTiptapContent(baseDocument) && hasTiptapContent(payload.document_content)

        setReviewState(normalizeReviewState(payload.enhancement_state))
        onAcknowledgedHashChange(payload.documentHash)
        setUndoDocument(baseDocument)
        setWasEverEnhanced(true)
        setRegenPromptDismissed(false)
        setDraftState('idle')
        setDocumentConflict(null)

        onDocumentAccepted({
          document: payload.document_content,
          documentHash: payload.documentHash,
          baseDocument,
          wasFirstGeneration,
        })
      } catch (error) {
        editor.commands.setContent(baseDocument, { emitUpdate: false })
        setDraftState('idle')
        const message = error instanceof Error ? error.message : 'Failed to save AI changes'
        toast.error(message)
      }
    },
    [waitForEditor, onAcknowledgedHashChange, onDocumentAccepted]
  )

  const handleDraftRequest = useCallback(async () => {
    if (!shouldShowAction && draftState === 'idle') return

    if (actionMode === 'generate') {
      onShowEditor()
    }

    setRegenPromptDismissed(false)
    setDraftState('generating')

    try {
      await persistCurrentDocument(currentDocumentRef.current)

      const response = await fetch(`/api/meetings/${meetingIdRef.current}/enhance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          mode: actionMode,
          documentContent: currentDocumentRef.current,
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
        baseDocument: currentDocumentRef.current,
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
  }, [shouldShowAction, draftState, actionMode, onShowEditor, persistCurrentDocument, streamProposedDocument])

  const handleUndo = useCallback(() => {
    const editor = editorRef.current
    if (!editor || !undoDocument) return

    editor.commands.setContent(undoDocument, { emitUpdate: true })
    setUndoDocument(null)
  }, [undoDocument])

  const handleLoadLatestVersion = useCallback(() => {
    if (!documentConflict) return

    setUndoDocument(null)
    setDraftState('idle')
    setDocumentConflict(null)
    streamingCancelledRef.current = true

    onLoadLatestVersionCallback({
      document: documentConflict.currentDocument,
      documentHash: documentConflict.currentHash,
    })
  }, [documentConflict, onLoadLatestVersionCallback])

  const handleKeepLocalDraft = useCallback(async () => {
    if (!documentConflict) return

    try {
      await persistCurrentDocument(currentDocumentRef.current, documentConflict.currentHash)
      toast.success('Your local draft replaced the newer server version.')
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to replace the server version'
      toast.error(message)
    }
  }, [documentConflict, persistCurrentDocument])

  const clearUndoDocument = useCallback(() => {
    setUndoDocument(null)
  }, [])

  return {
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
  }
}
