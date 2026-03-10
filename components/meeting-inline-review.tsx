'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Loader2, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createTopLevelDiff, type TiptapDiffSegment } from '@/lib/tiptap-diff'
import {
  tiptapToPlainText,
  type TiptapDocument,
  type TiptapNode,
} from '@/lib/tiptap-converter'
import type { EnhancementOutcome } from '@/lib/types'

type ChangeDecision = 'pending' | 'accepted' | 'rejected'

type ReviewChangeSegment = Extract<TiptapDiffSegment, { kind: 'change' }> & {
  decision: ChangeDecision
}

type ReviewUnchangedSegment = Extract<TiptapDiffSegment, { kind: 'unchanged' }>

type ReviewSegment = ReviewUnchangedSegment | ReviewChangeSegment

function isReviewChangeSegment(segment: ReviewSegment): segment is ReviewChangeSegment {
  return segment.kind === 'change'
}

function toReviewSegment(segment: TiptapDiffSegment): ReviewSegment {
  if (segment.kind === 'change') {
    return {
      ...segment,
      decision: 'pending',
    }
  }

  return segment
}

function renderNodeText(node: TiptapNode) {
  return tiptapToPlainText({ type: 'doc', content: [node] }).trim()
}

function renderNode(node: TiptapNode, key: string, tone: 'base' | 'added' | 'removed') {
  const text = renderNodeText(node)
  const commonClass = cn(
    'whitespace-pre-wrap text-[15px] leading-7',
    tone === 'added' && 'text-foreground',
    tone === 'removed' && 'text-muted-foreground line-through decoration-muted-foreground/70',
    tone === 'base' && 'text-foreground'
  )

  if (node.type === 'heading') {
    const level = typeof node.attrs?.level === 'number' ? node.attrs.level : 2
    return (
      <div
        key={key}
        className={cn(
          commonClass,
          level === 1 && 'text-[26px] font-semibold tracking-tight',
          level === 2 && 'pt-4 text-[18px] font-semibold tracking-tight',
          level === 3 && 'pt-3 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground'
        )}
      >
        {text}
      </div>
    )
  }

  if (node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'taskList') {
    return (
      <div key={key} className={cn(commonClass, 'pl-4')}>
        {text || '\u00A0'}
      </div>
    )
  }

  if (node.type === 'blockquote') {
    return (
      <div key={key} className={cn(commonClass, 'border-l border-border pl-4 italic')}>
        {text || '\u00A0'}
      </div>
    )
  }

  return (
    <div key={key} className={commonClass}>
      {text || '\u00A0'}
    </div>
  )
}

function nodesToDocument(nodes: TiptapNode[]): TiptapDocument {
  return {
    type: 'doc',
    content: nodes,
  }
}

function buildResolvedDocument(segments: ReviewSegment[]): {
  document: TiptapDocument
  outcome: EnhancementOutcome
} {
  const content: TiptapNode[] = []
  let acceptedChangeCount = 0

  for (const segment of segments) {
    if (segment.kind === 'unchanged') {
      content.push(...segment.nodes)
      continue
    }

    if (segment.decision === 'accepted') {
      content.push(...segment.proposedNodes)
      acceptedChangeCount += 1
    } else {
      content.push(...segment.baseNodes)
    }
  }

  return {
    document: nodesToDocument(content.length > 0 ? content : [{ type: 'paragraph' }]),
    outcome: acceptedChangeCount > 0 ? 'accepted' : 'dismissed',
  }
}

export function MeetingInlineReview({
  baseDocument,
  proposedDocument,
  summary,
  isSaving,
  saveError,
  onFinalizeReview,
}: {
  baseDocument: TiptapDocument
  proposedDocument: TiptapDocument
  summary?: string
  isSaving: boolean
  saveError: string | null
  onFinalizeReview: (result: { document: TiptapDocument; outcome: EnhancementOutcome }) => void
}) {
  const initialSegments = useMemo<ReviewSegment[]>(
    () => createTopLevelDiff(baseDocument, proposedDocument).map(toReviewSegment),
    [baseDocument, proposedDocument]
  )
  const [segments, setSegments] = useState(initialSegments)
  const hasSubmittedRef = useRef(false)

  useEffect(() => {
    setSegments(initialSegments)
    hasSubmittedRef.current = false
  }, [initialSegments])

  const pendingCount = segments.filter(
    (segment) => isReviewChangeSegment(segment) && segment.decision === 'pending'
  ).length

  const resolvedReview = useMemo(() => buildResolvedDocument(segments), [segments])

  useEffect(() => {
    if (pendingCount !== 0 || hasSubmittedRef.current) return
    hasSubmittedRef.current = true
    onFinalizeReview(resolvedReview)
  }, [onFinalizeReview, pendingCount, resolvedReview])

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
          <div className="ml-auto flex items-center gap-2">
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
                  onClick={() => onFinalizeReview(resolvedReview)}
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
              <div key={segment.id} className="space-y-2">
                {segment.nodes.map((node, nodeIndex) =>
                  renderNode(node, `${segment.id}-${nodeIndex}`, 'base')
                )}
              </div>
            )
          }

          if (segment.decision !== 'pending') {
            const visibleNodes =
              segment.decision === 'accepted' ? segment.proposedNodes : segment.baseNodes

            return (
              <div key={segment.id} className="space-y-2">
                {visibleNodes.map((node, nodeIndex) =>
                  renderNode(node, `${segment.id}-${nodeIndex}`, 'base')
                )}
              </div>
            )
          }

          return (
            <div key={segment.id} className="rounded-2xl border border-border/70 bg-secondary/30 px-4 py-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Current
                  </p>
                  <div className="space-y-2">
                    {segment.baseNodes.length > 0 ? (
                      segment.baseNodes.map((node, nodeIndex) =>
                        renderNode(node, `${segment.id}-base-${nodeIndex}`, 'removed')
                      )
                    ) : (
                      <div className="text-sm text-muted-foreground">Nothing here yet.</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <div className="rounded-full bg-background/80 px-3 py-1 text-xs text-muted-foreground shadow-sm">
                    Change
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Proposed
                  </p>
                  <div className="space-y-2 rounded-2xl border border-accent/30 bg-background/80 px-3 py-3 shadow-sm">
                    {segment.proposedNodes.map((node, nodeIndex) =>
                      renderNode(node, `${segment.id}-new-${nodeIndex}`, 'added')
                    )}
                  </div>
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
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
