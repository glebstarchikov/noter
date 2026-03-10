'use client'

import { useEffect, useMemo, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { Check, Loader2, Sparkles, Undo2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createMeetingEditorExtensions } from '@/lib/meeting-editor-extensions'
import { createTopLevelDiff, type TiptapDiffSegment } from '@/lib/tiptap-diff'
import type { EnhancementOutcome } from '@/lib/types'
import type { TiptapDocument, TiptapNode } from '@/lib/tiptap-converter'

type ChangeDecision = 'pending' | 'accepted' | 'rejected'

type ReviewChangeSegment = Extract<TiptapDiffSegment, { kind: 'change' }> & {
  decision: ChangeDecision
}

type ReviewSegment = Extract<TiptapDiffSegment, { kind: 'unchanged' }> | ReviewChangeSegment

function toReviewSegment(segment: TiptapDiffSegment): ReviewSegment {
  if (segment.kind === 'change') {
    return {
      ...segment,
      decision: 'pending',
    }
  }

  return segment
}

function isReviewChangeSegment(segment: ReviewSegment): segment is ReviewChangeSegment {
  return segment.kind === 'change'
}

function nodesToDocument(nodes: TiptapNode[]): TiptapDocument {
  return {
    type: 'doc',
    content: nodes,
  }
}

function StaticMeetingDocument({
  document,
  className,
}: {
  document: TiptapDocument
  className?: string
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: createMeetingEditorExtensions(),
    content: document,
    editorProps: {
      attributes: {
        class: `prose-editor focus:outline-none ${className ?? ''}`.trim(),
      },
    },
  })

  if (!editor) return null

  return <EditorContent editor={editor} />
}

function buildResolvedDocument(segments: ReviewSegment[]) {
  const content: TiptapNode[] = []
  let acceptedChangeCount = 0

  for (const segment of segments) {
    if (segment.kind === 'unchanged') {
      content.push(...segment.nodes)
      continue
    }

    if (segment.decision === 'pending') {
      continue
    }

    if (segment.decision === 'accepted') {
      if (segment.changeType === 'replace' || segment.changeType === 'insert') {
        if (segment.proposedNode) {
          content.push(segment.proposedNode)
        }
      }
      acceptedChangeCount += 1
      continue
    }

    if (segment.changeType === 'replace' || segment.changeType === 'delete') {
      if (segment.baseNode) {
        content.push(segment.baseNode)
      }
    }
  }

  return {
    document: nodesToDocument(content.length > 0 ? content : [{ type: 'paragraph' }]),
    outcome: acceptedChangeCount > 0 ? 'accepted' : 'dismissed' as EnhancementOutcome,
  }
}

function renderCurrentLabel(segment: ReviewChangeSegment) {
  if (segment.changeType === 'insert') {
    return 'Nothing here yet'
  }

  return 'Current'
}

function renderProposedLabel(segment: ReviewChangeSegment) {
  if (segment.changeType === 'delete') {
    return 'Remove this block'
  }

  return 'Proposed'
}

export function MeetingInlineReview({
  baseDocument,
  proposedDocument,
  summary,
  isSaving,
  saveError,
  onApplyReview,
  onCancelReview,
}: {
  baseDocument: TiptapDocument
  proposedDocument: TiptapDocument
  summary?: string
  isSaving: boolean
  saveError: string | null
  onApplyReview: (result: { document: TiptapDocument; outcome: EnhancementOutcome }) => void
  onCancelReview: () => void
}) {
  const initialSegments = useMemo<ReviewSegment[]>(
    () => createTopLevelDiff(baseDocument, proposedDocument).map(toReviewSegment),
    [baseDocument, proposedDocument]
  )
  const [segments, setSegments] = useState(initialSegments)

  useEffect(() => {
    setSegments(initialSegments)
  }, [initialSegments])

  const pendingCount = segments.filter(
    (segment) => isReviewChangeSegment(segment) && segment.decision === 'pending'
  ).length

  const resolvedReview = useMemo(() => buildResolvedDocument(segments), [segments])

  const updateDecision = (segmentId: string, decision: ChangeDecision) => {
    setSegments((current) =>
      current.map((segment) =>
        isReviewChangeSegment(segment) && segment.id === segmentId
          ? { ...segment, decision }
          : segment
      )
    )
  }

  const resolveAll = (decision: Extract<ChangeDecision, 'accepted' | 'rejected'>) => {
    setSegments((current) =>
      current.map((segment) =>
        isReviewChangeSegment(segment)
          ? { ...segment, decision }
          : segment
      )
    )
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-4 z-10 flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/92 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Sparkles className="size-4 text-accent" />
            Review draft changes
          </div>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            {pendingCount} pending
          </span>
          {summary ? (
            <span className="text-sm text-muted-foreground">{summary}</span>
          ) : null}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancelReview}
              disabled={isSaving}
              className="h-8 rounded-full shadow-none"
            >
              Cancel review
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => resolveAll('rejected')}
              disabled={isSaving || pendingCount === 0}
              className="h-8 rounded-full shadow-none"
            >
              Reject all
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => resolveAll('accepted')}
              disabled={isSaving || pendingCount === 0}
              className="liquid-metal-button h-8 rounded-full"
            >
              Accept all
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => onApplyReview(resolvedReview)}
              disabled={isSaving || pendingCount > 0}
              className="liquid-metal-button h-8 rounded-full"
            >
              Apply reviewed changes
            </Button>
          </div>
        </div>

        {(isSaving || saveError) && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin text-accent" />
                <span className="text-muted-foreground">Saving reviewed note…</span>
              </>
            ) : null}
            {saveError ? (
              <>
                <span className="text-destructive">{saveError}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onApplyReview(resolvedReview)}
                  disabled={pendingCount > 0}
                  className="h-8 rounded-full shadow-none"
                >
                  Retry save
                </Button>
              </>
            ) : null}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {segments.map((segment) => {
          if (segment.kind === 'unchanged') {
            return (
              <div key={segment.id} className="rounded-2xl border border-transparent px-1">
                <StaticMeetingDocument document={nodesToDocument(segment.nodes)} />
              </div>
            )
          }

          const acceptedState =
            segment.decision === 'accepted'
              ? 'Accepted'
              : segment.decision === 'rejected'
                ? 'Rejected'
                : segment.changeType === 'insert'
                  ? 'Add block'
                  : segment.changeType === 'delete'
                    ? 'Remove block'
                    : 'Replace block'

          return (
            <div
              key={segment.id}
              className="rounded-2xl border border-border/70 bg-secondary/30 px-4 py-4"
            >
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground shadow-sm">
                  {acceptedState}
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    {renderCurrentLabel(segment)}
                  </p>
                  {segment.baseNode ? (
                    <div className="rounded-2xl border border-border/60 bg-background/80 px-3 py-3 opacity-70">
                      <StaticMeetingDocument
                        document={nodesToDocument([segment.baseNode])}
                        className="pointer-events-none"
                      />
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/60 bg-background/50 px-3 py-3 text-sm text-muted-foreground">
                      Nothing here yet.
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center">
                  <div className="rounded-full bg-background/80 px-3 py-1 text-xs text-muted-foreground shadow-sm">
                    Review
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    {renderProposedLabel(segment)}
                  </p>
                  {segment.proposedNode ? (
                    <div className="rounded-2xl border border-accent/30 bg-background/80 px-3 py-3 shadow-sm">
                      <StaticMeetingDocument
                        document={nodesToDocument([segment.proposedNode])}
                        className="pointer-events-none"
                      />
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/60 bg-background/50 px-3 py-3 text-sm text-muted-foreground">
                      This block will be removed.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => updateDecision(segment.id, 'accepted')}
                  disabled={isSaving}
                  className="liquid-metal-button h-8 rounded-full"
                >
                  <Check className="size-4" />
                  Accept
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => updateDecision(segment.id, 'rejected')}
                  disabled={isSaving}
                  className="h-8 rounded-full shadow-none"
                >
                  <X className="size-4" />
                  Reject
                </Button>
                {segment.decision !== 'pending' ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => updateDecision(segment.id, 'pending')}
                    disabled={isSaving}
                    className="h-8 rounded-full text-muted-foreground shadow-none"
                  >
                    <Undo2 className="size-4" />
                    Reset
                  </Button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
