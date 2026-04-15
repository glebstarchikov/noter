'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { toast } from 'sonner'
import { isDocumentSaveConflict, saveMeetingDocument, type DocumentSaveConflict } from '@/lib/document-sync'
import { type TiptapDocument } from '@/lib/tiptap/tiptap-converter'
import type { EnhancementState, Meeting, MeetingStatus } from '@/lib/types'
import { useDraftProposal, type DraftMode } from '@/hooks/use-draft-proposal'

export type UseNoteEnhancementReturn = {
  draftState: import('@/hooks/use-draft-proposal').DraftUiState
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
    hasDocumentContent: _hasDocumentContent,
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
  const [documentConflict, setDocumentConflict] = useState<DocumentSaveConflict | null>(null)

  const editorRef = useRef<Editor | null>(null)
  const acknowledgedHashRef = useRef(acknowledgedHash)
  const currentDocumentRef = useRef(currentDocument)
  const meetingIdRef = useRef(meeting.id)

  useEffect(() => {
    acknowledgedHashRef.current = acknowledgedHash
  }, [acknowledgedHash])

  useEffect(() => {
    currentDocumentRef.current = currentDocument
  }, [currentDocument])

  // Reset conflict state when meeting changes
  useEffect(() => {
    if (meetingIdRef.current === meeting.id) return
    meetingIdRef.current = meeting.id
    setDocumentConflict(null)
  }, [meeting.id])

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
      await persistCurrentDocument(currentDocumentRef.current, documentConflict.currentHash)
      toast.success('Your local draft replaced the newer server version.')
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to replace the server version'
      toast.error(message)
    }
  }, [documentConflict, persistCurrentDocument])

  // --- Public handleDraftRequest: thin wrapper keeping the external interface ---

  const handleDraftRequest = useCallback(async () => {
    await requestDraft({
      onAccepted: (payload) => {
        onAcknowledgedHashChange(payload.documentHash)
        setDocumentConflict(null)
        onDocumentAccepted(payload)
      },
      onShowEditor,
    })
  }, [requestDraft, onAcknowledgedHashChange, onDocumentAccepted, onShowEditor])

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
