'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { toast } from 'sonner'
import { isNeutralEnhancementMessage } from '@/lib/notes/enhancement-errors'
import { readApiError } from '@/lib/meetings/meeting-pipeline'
import { hasTiptapContent, type TiptapDocument } from '@/lib/tiptap/tiptap-converter'
import type { EnhancementOutcome, EnhancementState, Meeting, MeetingStatus } from '@/lib/types'

export type DraftMode = 'generate' | 'enhance'
export type DraftUiState = 'idle' | 'generating' | 'saving'

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
    templateId?: string
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
  const [regenPromptDismissed, setRegenPromptDismissed] = useState(false)

  // Derived from server state: has AI ever successfully reviewed this note?
  // Was previously a local useState that reset on every mount — causing the
  // regen-prompt indicator to disappear on reload even when server state had
  // a prior review. Deriving from reviewState keeps client + server consistent.
  const wasEverEnhanced =
    reviewState.lastReviewedSourceHash !== null ||
    reviewState.lastReviewedAt !== null

  const meetingIdRef = useRef(meeting.id)
  const draftStateRef = useRef(draftState)
  const currentDocumentRef = useRef(currentDocument)
  const undoDocumentRef = useRef(undoDocument)

  useEffect(() => {
    draftStateRef.current = draftState
  }, [draftState])

  useEffect(() => {
    currentDocumentRef.current = currentDocument
  }, [currentDocument])

  useEffect(() => {
    undoDocumentRef.current = undoDocument
  }, [undoDocument])

  // Reset all draft state when the meeting changes
  useEffect(() => {
    if (meetingIdRef.current === meeting.id) return

    meetingIdRef.current = meeting.id
    setDraftState('idle')
    setUndoDocument(null)
    setReviewState(serverReviewState)
    setRegenPromptDismissed(false)
  }, [meeting.id, serverReviewState])

  // Sync server review state when it actually changes (e.g., the parent
  // refetched the meeting). Intentionally does NOT depend on `undoDocument`:
  // dismissing the undo chip is a local UI action, not a server change, and
  // re-syncing then would clobber freshly-cleared state with a stale
  // `meeting.enhancement_state` prop (see the "Draft failed reappears after
  // undo dismiss" bug).
  useEffect(() => {
    if (draftStateRef.current !== 'idle' || undoDocumentRef.current) return
    setReviewState(serverReviewState)
  }, [serverReviewState])

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

  const applyProposedDocument = useCallback(
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

      editor.commands.setContent(proposedDocument, { emitUpdate: false })
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
      templateId,
    }: {
      onAccepted: (payload: DraftAcceptedPayload) => void
      templateId?: string
    }) => {
      if (!shouldShowAction || draftStateRef.current !== 'idle') return

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
            ...(templateId ? { template_id: templateId } : {}),
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
        void applyProposedDocument({
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
    [shouldShowAction, actionMode, persistDocument, applyProposedDocument]
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
