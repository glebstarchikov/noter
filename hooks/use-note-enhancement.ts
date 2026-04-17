'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { toast } from 'sonner'
import { isDocumentSaveConflict, saveMeetingDocument, type DocumentSaveConflict } from '@/lib/document-sync'
import { type TiptapDocument } from '@/lib/tiptap/tiptap-converter'
import type { EnhancementState, Meeting, MeetingStatus } from '@/lib/types'
import { useDraftProposal, type DraftMode, type DraftUiState } from '@/hooks/use-draft-proposal'

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
    onDocumentAccepted,
    onAcknowledgedHashChange,
    onLoadLatestVersion: onLoadLatestVersionCallback,
  }: {
    currentDocument: TiptapDocument
    acknowledgedHash: string
    currentHash: string
    actionMode: DraftMode
    canReview: boolean
    meetingStatus: MeetingStatus
    onDocumentAccepted: (payload: {
      document: TiptapDocument
      documentHash: string
      baseDocument: TiptapDocument
      wasFirstGeneration: boolean
    }) => void
    onAcknowledgedHashChange: (hash: string) => void
    onLoadLatestVersion: (payload: { document: TiptapDocument; documentHash: string }) => void
  }
): UseNoteEnhancementReturn {
  const [documentConflict, setDocumentConflict] = useState<DocumentSaveConflict | null>(null)

  const editorRef = useRef<Editor | null>(null)
  const acknowledgedHashRef = useRef(acknowledgedHash)
  const meetingIdRef = useRef(meeting.id)

  useEffect(() => {
    acknowledgedHashRef.current = acknowledgedHash
  }, [acknowledgedHash])

  // Reset conflict state when meeting changes
  useEffect(() => {
    if (meetingIdRef.current === meeting.id) return
    meetingIdRef.current = meeting.id
    setDocumentConflict(null)
  }, [meeting.id])

  const setEditorRef = useCallback((editor: Editor | null) => {
    editorRef.current = editor
  }, [])

  // 20 × 25ms = 500ms max wait for the editor ref to populate
  const MAX_EDITOR_WAIT_ATTEMPTS = 20
  const EDITOR_WAIT_POLL_MS = 25

  const waitForEditor = useCallback(async () => {
    if (editorRef.current) return editorRef.current

    for (let attempt = 0; attempt < MAX_EDITOR_WAIT_ATTEMPTS; attempt += 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, EDITOR_WAIT_POLL_MS))
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

  // Stable refs for the callbacks passed to useDraftProposal.
  // Return type is void — useDraftProposal only cares about throws, not the return value.
  const persistDocumentCb = useCallback(
    async (document: TiptapDocument): Promise<void> => {
      await persistCurrentDocument(document)
    },
    [persistCurrentDocument]
  )

  // --- Compose useDraftProposal ---
  const {
    draftState,
    reviewState,
    undoDocument,
    wasEverEnhanced,
    regenPromptDismissed,
    shouldShowAction,
    setRegenPromptDismissed,
    clearUndoDocument,
    requestDraft,
  } = useDraftProposal(meeting, {
    currentDocument,
    currentHash,
    actionMode,
    canReview,
    meetingStatus,
    hasDocumentConflict: documentConflict !== null,
    persistDocument: persistDocumentCb,
    waitForEditor,
  })

  // --- Conflict resolution callbacks (own state) ---

  const handleUndo = useCallback(() => {
    const editor = editorRef.current
    if (!editor || !undoDocument) return

    editor.commands.setContent(undoDocument, { emitUpdate: true })
    clearUndoDocument()
  }, [undoDocument, clearUndoDocument])

  const handleLoadLatestVersion = useCallback(() => {
    if (!documentConflict) return

    clearUndoDocument()
    setDocumentConflict(null)

    onLoadLatestVersionCallback({
      document: documentConflict.currentDocument,
      documentHash: documentConflict.currentHash,
    })
  }, [documentConflict, clearUndoDocument, onLoadLatestVersionCallback])

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

  // --- Public handleDraftRequest: thin wrapper keeping the external interface ---

  const handleDraftRequest = useCallback(async () => {
    await requestDraft({
      onAccepted: (payload) => {
        onAcknowledgedHashChange(payload.documentHash)
        setDocumentConflict(null)
        onDocumentAccepted(payload)
      },
    })
  }, [requestDraft, onAcknowledgedHashChange, onDocumentAccepted])

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
