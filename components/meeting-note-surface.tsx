'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { DraftActionBar } from '@/components/draft-action-bar'
import { NoteEditorSurface } from '@/components/note-editor-surface'
import { hashDocumentContent } from '@/lib/document-hash'
import {
  hasTiptapContent,
  legacyMeetingToTiptap,
  normalizeTiptapDocument,
  type TiptapDocument,
} from '@/lib/tiptap/tiptap-converter'
import { copyDocumentAsMarkdown } from '@/lib/meetings/meeting-actions'
import type { Meeting } from '@/lib/types'
import { useNoteEnhancement } from '@/hooks/use-note-enhancement'
import { useTemplates } from '@/hooks/use-templates'

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

  const meetingIdRef = useRef(meeting.id)

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
    },
    []
  )

  const { templates, defaultTemplateId } = useTemplates()

  const {
    draftState,
    reviewState,
    undoDocument,
    documentConflict,
    wasEverEnhanced,
    regenPromptDismissed,
    shouldShowAction,
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
    onDocumentAccepted: handleDocumentAccepted,
    onAcknowledgedHashChange: handleAcknowledgedHashChange,
    onLoadLatestVersion: handleLoadLatestVersionCallback,
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
  }, [meeting.document_content, meeting.id])

  const handleEditorReady = useCallback(
    (editor: Editor | null) => {
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

  const handleCopyMarkdown = useCallback(() => {
    copyDocumentAsMarkdown(currentDocument, meeting.title)
  }, [currentDocument, meeting.title])

  const handleAutosaveSuccess = useCallback(
    (payload: { documentHash: string }) => {
      setAcknowledgedHash(payload.documentHash)
      setDocumentConflict(null)
    },
    [setDocumentConflict]
  )

  return (
    <div className="flex flex-col">
      <section className="surface-document relative px-6 py-6 md:px-8 md:py-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
          <DraftActionBar
            draftState={draftState}
            actionMode={actionMode}
            shouldShowAction={shouldShowAction}
            hasDocumentContent={hasDocumentContent}
            undoDocument={undoDocument}
            reviewState={reviewState}
            documentConflict={documentConflict}
            canReview={canReview}
            wasEverEnhanced={wasEverEnhanced}
            regenPromptDismissed={regenPromptDismissed}
            meetingStatus={meeting.status}
            meetingErrorMessage={meeting.error_message}
            templates={templates}
            defaultTemplateId={defaultTemplateId}
            onDraftRequest={(templateId) => void handleDraftRequest(templateId)}
            onUndo={handleUndo}
            onCopyMarkdown={handleCopyMarkdown}
          />

          <NoteEditorSurface
            meeting={meeting}
            editorSeed={editorSeed}
            editorRevision={editorRevision}
            editable={draftState === 'idle'}
            acknowledgedHash={acknowledgedHash}
            documentConflict={documentConflict}
            draftState={draftState}
            onEditorReady={handleEditorReady}
            onContentChange={handleEditorContentChange}
            onAutosaveSuccess={handleAutosaveSuccess}
            onAutosaveConflict={handleAutosaveConflict}
            onLoadLatestVersion={handleLoadLatestVersion}
            onKeepLocalDraft={() => void handleKeepLocalDraft()}
            onDismissConflict={() => setDocumentConflict(null)}
          />
        </div>
      </section>
    </div>
  )
}
