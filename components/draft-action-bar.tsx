'use client'

import { Loader2, RefreshCcw, Sparkles, Undo2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { isNeutralEnhancementMessage } from '@/lib/notes/enhancement-errors'
import type { DocumentSaveConflict } from '@/lib/document-sync'
import type { TiptapDocument } from '@/lib/tiptap/tiptap-converter'
import type { EnhancementState } from '@/lib/types'
import type { DraftUiState, DraftMode } from '@/hooks/use-draft-proposal'

interface DraftActionBarProps {
  draftState: DraftUiState
  actionMode: DraftMode
  shouldShowAction: boolean
  hasDocumentContent: boolean
  undoDocument: TiptapDocument | null
  reviewState: EnhancementState
  documentConflict: DocumentSaveConflict | null
  canReview: boolean
  wasEverEnhanced: boolean
  regenPromptDismissed: boolean
  meetingStatus: string
  meetingErrorMessage: string | null
  onDraftRequest: () => void
  onUndo: () => void
}

export function DraftActionBar({
  draftState,
  actionMode,
  shouldShowAction,
  hasDocumentContent,
  undoDocument,
  reviewState,
  documentConflict,
  canReview,
  wasEverEnhanced,
  regenPromptDismissed,
  meetingStatus,
  meetingErrorMessage,
  onDraftRequest,
  onUndo,
}: DraftActionBarProps) {
  const isNeutralDraftFeedback = isNeutralEnhancementMessage(reviewState.lastError)

  // Derive header description text
  const headerStateCopy = (() => {
    if (documentConflict) return 'Resolve the newer saved version before continuing.'
    if (hasDocumentContent) return 'Edit freely here. Use AI only when you want a second pass.'
    if (meetingStatus === 'error') {
      return 'Automatic draft generation failed. Retry or start typing manually.'
    }
    if (canReview) {
      return 'No notes yet. Generate a first draft or start typing manually.'
    }
    return 'No notes yet. Start typing manually to begin.'
  })()

  const showRegenPrompt =
    hasDocumentContent &&
    wasEverEnhanced &&
    shouldShowAction &&
    draftState === 'idle' &&
    !regenPromptDismissed &&
    !documentConflict

  const showHeaderDraftAction =
    (shouldShowAction || draftState !== 'idle') &&
    (hasDocumentContent || Boolean(documentConflict))

  const showHeaderActions =
    showHeaderDraftAction ||
    Boolean(undoDocument && draftState === 'idle') ||
    Boolean(reviewState.lastError && draftState === 'idle')

  const loadingLabel =
    draftState === 'saving'
      ? 'Saving changes...'
      : actionMode === 'generate'
        ? 'Creating draft...'
        : 'Improving...'

  const draftActionLabel =
    meetingStatus === 'error'
      ? 'Try again'
      : hasDocumentContent
        ? 'Improve with AI'
        : 'Create first draft'

  return (
    <div className="flex flex-col gap-4 border-b border-border/60 pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Notes</h2>
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
                    variant="ghost"
                    size="sm"
                    className="relative gap-2 rounded-full border-border/70 bg-background/80 shadow-none"
                    onClick={onDraftRequest}
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
                    onClick={onUndo}
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
                        onClick={onDraftRequest}
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
    </div>
  )
}
