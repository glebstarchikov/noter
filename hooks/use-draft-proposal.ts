'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { toast } from 'sonner'
import { isNeutralEnhancementMessage } from '@/lib/notes/enhancement-errors'
import { readApiError } from '@/lib/meetings/meeting-pipeline'
import { hasTiptapContent, type TiptapDocument } from '@/lib/tiptap/tiptap-converter'
import type { EnhancementOutcome, EnhancementState, Meeting, MeetingStatus } from '@/lib/types'

export type DraftMode = 'generate' | 'enhance'
export type DraftUiState = 'idle' | 'generating' | 'streaming' | 'saving'

const STREAMING_BLOCK_DELAY_MS = process.env.NODE_ENV === 'test' ? 0 : 50

function normalizeReviewState(state: EnhancementState | null | undefined): EnhancementState {
  return {
    lastReviewedSourceHash: state?.lastReviewedSourceHash ?? null,
    lastOutcome: state?.lastOutcome ?? null,
    lastReviewedAt: state?.lastReviewedAt ?? null,
    lastError: state?.lastError ?? null,
  }
}

export interface DraftAcceptedPayload {
  document: TiptapDocument
  documentHash: string
  baseDocument: TiptapDocument
  wasFirstGeneration: boolean
}

export interface UseDraftProposalParams {
  currentDocument: TiptapDocument
  currentHash: string
  actionMode: DraftMode
  canReview: boolean
  meetingStatus: MeetingStatus
  /** Whether a document conflict is currently active — affects shouldShowAction. */
  hasDocumentConflict: boolean
  /**
   * Called to persist the current document before drafting begins.
   * Lives in `useNoteEnhancement` since it handles document conflicts.
   * Should throw if a conflict is detected (conflict state is set by the caller).
   */
  persistDocument: (document: TiptapDocument) => Promise<void>
  /**
   * Returns the current editor instance (or null if not mounted yet).
   * Lives in `useNoteEnhancement` since it owns the editor ref.
   */
  waitForEditor: () => Promise<Editor | null>
}

export interface UseDraftProposalReturn {
  draftState: DraftUiState
  reviewState: EnhancementState
  undoDocument: TiptapDocument | null
  wasEverEnhanced: boolean
  regenPromptDismissed: boolean
  shouldShowAction: boolean
  setRegenPromptDismissed: (value: boolean) => void
  clearUndoDocument: () => void
  requestDraft: (params: {
    onAccepted: (payload: DraftAcceptedPayload) => void
    onShowEditor: () => void
  }) => Promise<void>
}

export function useDraftProposal(
  meeting: Meeting,
  params: UseDraftProposalParams,
): UseDraftProposalReturn {
  const {
    currentDocument,
    currentHash,
    actionMode,
    canReview,
    meetingStatus,
    hasDocumentConflict,
    persistDocument,
    waitForEditor,
  } = params

  const serverReviewState = useMemo(
    () => normalizeReviewState(meeting.enhancement_state),
    [meeting.enhancement_state]
  )

  const [draftState, setDraftState] = useState<DraftUiState>('idle')
  const [undoDocument, setUndoDocument] = useState<TiptapDocument | null>(null)
  const [reviewState, setReviewState] = useState<EnhancementState>(
    normalizeReviewState(meeting.enhancement_state)
  )
  const [wasEverEnhanced, setWasEverEnhanced] = useState(false)
  const [regenPromptDismissed, setRegenPromptDismissed] = useState(false)

  const meetingIdRef = useRef(meeting.id)
  const draftStateRef = useRef(draftState)
  const streamingCancelledRef = useRef(false)
  const currentDocumentRef = useRef(currentDocument)

  useEffect(() => {
    draftStateRef.current = draftState
  }, [draftState])

  useEffect(() => {
    currentDocumentRef.current = currentDocument
  }, [currentDocument])

  // Reset all draft state when the meeting changes
  useEffect(() => {
    if (meetingIdRef.current === meeting.id) return

    meetingIdRef.current = meeting.id
    setDraftState('idle')
    setUndoDocument(null)
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
  const isEmptyGenerating =
    !hasTiptapContent(currentDocument) && !hasDocumentConflict && meetingStatus === 'generating'
  const shouldShowAction =
    canReview &&
    !isEmptyGenerating &&
    draftState === 'idle' &&
    !hasDocumentConflict &&
    currentHash !== reviewState.lastReviewedSourceHash

  const setRegenPromptDismissedCb = useCallback((value: boolean) => {
    setRegenPromptDismissed(value)
  }, [])

  const clearUndoDocument = useCallback(() => {
    setUndoDocument(null)
  }, [])

  const streamProposedDocument = useCallback(
    async ({
      sourceHash,
      baseDocument,
      proposedDocument,
      onAccepted,
    }: {
      sourceHash: string
      baseDocument: TiptapDocument
      proposedDocument: TiptapDocument
      onAccepted: (payload: DraftAcceptedPayload) => void
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
        setUndoDocument(baseDocument)
        setWasEverEnhanced(true)
        setRegenPromptDismissed(false)
        setDraftState('idle')

        onAccepted({
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
    [waitForEditor]
  )

  const requestDraft = useCallback(
    async ({
      onAccepted,
      onShowEditor,
    }: {
      onAccepted: (payload: DraftAcceptedPayload) => void
      onShowEditor: () => void
    }) => {
      if (!shouldShowAction && draftStateRef.current === 'idle') return

      if (actionMode === 'generate') {
        onShowEditor()
      }

      setRegenPromptDismissed(false)
      setDraftState('generating')

      try {
        await persistDocument(currentDocumentRef.current)

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
        void streamProposedDocument({
          sourceHash: payload.sourceHash,
          baseDocument: currentDocumentRef.current,
          proposedDocument: payload.proposedDocument,
          onAccepted,
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
    },
    [shouldShowAction, actionMode, persistDocument, streamProposedDocument]
  )

  return {
    draftState,
    reviewState,
    undoDocument,
    wasEverEnhanced,
    regenPromptDismissed,
    shouldShowAction,
    setRegenPromptDismissed: setRegenPromptDismissedCb,
    clearUndoDocument,
    requestDraft,
  }
}
