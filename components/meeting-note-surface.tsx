'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { MeetingEditor } from '@/components/meeting-editor'
import { MeetingInlineReview } from '@/components/meeting-inline-review'
import { Button } from '@/components/ui/button'
import { hashDocumentContent } from '@/lib/document-hash'
import { readApiError } from '@/lib/meeting-pipeline'
import {
  hasTiptapContent,
  normalizeTiptapDocument,
  type TiptapDocument,
} from '@/lib/tiptap-converter'
import type { EnhancementOutcome, EnhancementState, Meeting } from '@/lib/types'

type DraftMode = 'generate' | 'enhance'
type DraftUiState = 'idle' | 'generating' | 'reviewing' | 'saving'

interface ReviewProposal {
  sourceHash: string
  summary: string
  mode: DraftMode
  baseDocument: TiptapDocument
  proposedDocument: TiptapDocument
}

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
  const router = useRouter()
  const initialDocument = useMemo(
    () => normalizeTiptapDocument(meeting.document_content),
    [meeting.document_content]
  )
  const [editorSeed, setEditorSeed] = useState<TiptapDocument>(initialDocument)
  const [editorRevision, setEditorRevision] = useState(0)
  const [currentDocument, setCurrentDocument] = useState<TiptapDocument>(initialDocument)
  const [draftState, setDraftState] = useState<DraftUiState>('idle')
  const [proposal, setProposal] = useState<ReviewProposal | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [reviewState, setReviewState] = useState<EnhancementState>(normalizeReviewState(meeting.enhancement_state))
  const serverReviewState = useMemo(
    () => normalizeReviewState(meeting.enhancement_state),
    [meeting.enhancement_state]
  )
  const draftStateRef = useRef(draftState)
  const proposalRef = useRef(proposal)

  useEffect(() => {
    draftStateRef.current = draftState
  }, [draftState])

  useEffect(() => {
    proposalRef.current = proposal
  }, [proposal])

  useEffect(() => {
    const nextDocument = normalizeTiptapDocument(meeting.document_content)
    setEditorSeed(nextDocument)
    setCurrentDocument(nextDocument)
    setEditorRevision(0)
    setDraftState('idle')
    setProposal(null)
    setSaveError(null)
    setReviewState(serverReviewState)
  }, [meeting.document_content, meeting.id, serverReviewState])

  useEffect(() => {
    if (draftStateRef.current !== 'idle' || proposalRef.current) return
    setReviewState(serverReviewState)
  }, [serverReviewState])

  const transcriptText = transcript ?? meeting.transcript ?? ''
  const currentHash = hashDocumentContent(currentDocument)
  const hasDocumentContent = hasTiptapContent(currentDocument)
  const canReview =
    Boolean(transcriptText.trim()) && (isRecordingComplete ?? meeting.status !== 'recording')
  const shouldShowAction =
    canReview &&
    draftState === 'idle' &&
    currentHash !== reviewState.lastReviewedSourceHash

  const actionMode: DraftMode = hasDocumentContent ? 'enhance' : 'generate'

  const handleEditorContentChange = useCallback((document: unknown) => {
    const normalizedDocument = normalizeTiptapDocument(document)
    const nextHash = hashDocumentContent(normalizedDocument)

    setCurrentDocument((existingDocument) =>
      hashDocumentContent(existingDocument) === nextHash ? existingDocument : normalizedDocument
    )
    setSaveError(null)
  }, [])

  const persistCurrentDocument = async (document: TiptapDocument) => {
    const response = await fetch(`/api/meetings/${meeting.id}/document`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_content: document }),
    })

    if (!response.ok) {
      const { message } = await readApiError(response, 'Failed to save the current note')
      throw new Error(message)
    }
  }

  const handleDraftRequest = async () => {
    if (!shouldShowAction) return

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
        const { message } = await readApiError(response, 'Failed to draft notes')
        throw new Error(message)
      }

      const payload = (await response.json()) as {
        sourceHash: string
        summary?: string
        mode: DraftMode
        proposedDocument: TiptapDocument
      }

      setProposal({
        sourceHash: payload.sourceHash,
        summary: payload.summary ?? '',
        mode: payload.mode,
        baseDocument: currentDocument,
        proposedDocument: payload.proposedDocument,
      })
      setDraftState('reviewing')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to draft notes'
      toast.error(message)
      setDraftState('idle')
    }
  }

  const handleFinalizeReview = async ({
    document,
    outcome,
  }: {
    document: TiptapDocument
    outcome: EnhancementOutcome
  }) => {
    if (!proposal) return

    setDraftState('saving')
    setSaveError(null)

    try {
      const response = await fetch(`/api/meetings/${meeting.id}/enhance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete',
          outcome,
          sourceHash: proposal.sourceHash,
          ...(outcome === 'accepted' ? { documentContent: document } : {}),
        }),
      })

      if (!response.ok) {
        const { message } = await readApiError(response, 'Failed to save reviewed note')
        throw new Error(message)
      }

      const payload = (await response.json()) as {
        enhancement_state: EnhancementState
        document_content: TiptapDocument
      }
      const nextDocument =
        outcome === 'accepted'
          ? normalizeTiptapDocument(payload.document_content)
          : currentDocument

      setReviewState(normalizeReviewState(payload.enhancement_state))
      setProposal(null)
      setDraftState('idle')
      setSaveError(null)
      setCurrentDocument(nextDocument)
      setEditorSeed(nextDocument)
      setEditorRevision((value) => value + 1)
      router.refresh()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save reviewed note'
      setSaveError(message)
      setDraftState('reviewing')
      toast.error(message)
    }
  }

  return (
    <section className="surface-document relative px-6 py-7 md:px-10 md:py-10">
      <div className="mx-auto w-full max-w-4xl space-y-5">
        {reviewState.lastError && draftState === 'idle' && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {reviewState.lastError}
          </div>
        )}

        {draftState === 'generating' && (
          <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-accent" />
            {actionMode === 'generate'
              ? 'Generating a first draft from the transcript…'
              : 'Drafting one inline improvement from your note and transcript…'}
          </div>
        )}

        {shouldShowAction && (
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => void handleDraftRequest()}
              disabled={draftState !== 'idle'}
              className="liquid-metal-fab h-11 rounded-full px-4 text-sm font-medium"
            >
              <Sparkles className="size-4" />
              {actionMode === 'generate' ? 'Generate notes' : 'Enhance'}
            </Button>
          </div>
        )}

        {proposal && draftState !== 'generating' ? (
          <MeetingInlineReview
            baseDocument={proposal.baseDocument}
            proposedDocument={proposal.proposedDocument}
            summary={proposal.summary}
            isSaving={draftState === 'saving'}
            saveError={saveError}
            onFinalizeReview={handleFinalizeReview}
          />
        ) : (
          <MeetingEditor
            key={`${meeting.id}:${editorRevision}`}
            meeting={meeting}
            editable={draftState === 'idle'}
            documentContent={editorSeed}
            onContentChange={handleEditorContentChange}
          />
        )}
      </div>
    </section>
  )
}
