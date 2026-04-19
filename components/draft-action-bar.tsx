'use client'

import { useState } from 'react'
import { ClipboardCopy, Loader2, RefreshCcw, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { isNeutralEnhancementMessage } from '@/lib/notes/enhancement-errors'
import type { DocumentSaveConflict } from '@/lib/document-sync'
import type { TiptapDocument } from '@/lib/tiptap/tiptap-converter'
import type { EnhancementState } from '@/lib/types'
import type { DraftUiState, DraftMode } from '@/hooks/use-draft-proposal'
import type { ResolvedNoteTemplate } from '@/lib/note-template'
import { TemplatePicker } from '@/components/templates/template-picker'

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
  templates: ResolvedNoteTemplate[]
  defaultTemplateId: string
  onDraftRequest: (templateId: string) => void
  onUndo: () => void
  onCopyMarkdown?: () => void
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
  templates,
  defaultTemplateId,
  onDraftRequest,
  onUndo,
  onCopyMarkdown,
}: DraftActionBarProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const effectiveTemplateId = selectedTemplateId ?? defaultTemplateId
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
    (hasDocumentContent || Boolean(documentConflict) || canReview)

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

  return (
    <div className="flex flex-col gap-4 border-b border-border/60 pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Notes</h2>
            {onCopyMarkdown && hasDocumentContent && draftState === 'idle' ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onCopyMarkdown}
                    className="flex items-center rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Copy notes as Markdown"
                  >
                    <ClipboardCopy className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Copy as Markdown</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{headerStateCopy}</p>
        </div>

        {showHeaderActions ? (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {showHeaderDraftAction && (
              draftState !== 'idle' ? (
                <LoadingPill
                  label={loadingLabel}
                  templateName={templates.find((t) => t.id === effectiveTemplateId)?.name ?? ''}
                />
              ) : (
                <div className="relative">
                  {showRegenPrompt ? (
                    <span
                      aria-hidden="true"
                      className="absolute -right-1 -top-1 z-10 size-2.5 rounded-full bg-accent ring-2 ring-background"
                    />
                  ) : null}
                  <TemplatePicker
                    templates={templates}
                    selectedId={effectiveTemplateId}
                    onChange={setSelectedTemplateId}
                    onConfirm={(id) => onDraftRequest(id)}
                    buttonLabel={hasDocumentContent ? 'Improve with AI:' : 'Create notes with:'}
                  />
                </div>
              )
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
              isNeutralDraftFeedback ? (
                <StatusPill tone="muted">No changes suggested</StatusPill>
              ) : canReview ? (
                <RetryPill onClick={() => onDraftRequest(effectiveTemplateId)} />
              ) : (
                <StatusPill tone="destructive">Draft failed</StatusPill>
              )
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function LoadingPill({ label, templateName }: { label: string; templateName: string }) {
  return (
    <button
      type="button"
      disabled
      aria-live="polite"
      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-[12px] font-medium text-primary-foreground opacity-80 disabled:cursor-not-allowed"
    >
      <Loader2 className="size-3.5 animate-spin" />
      <span>{label}</span>
      {templateName ? (
        <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[11px]">{templateName}</span>
      ) : null}
    </button>
  )
}

function RetryPill({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-destructive px-3.5 text-[12px] font-medium text-destructive-foreground transition-opacity hover:opacity-90"
        >
          <span>Draft failed</span>
          <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-1.5 py-0.5 text-[11px]">
            <RefreshCcw className="size-3" />
            Retry
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent>Try again with the selected template</TooltipContent>
    </Tooltip>
  )
}

function StatusPill({ tone, children }: { tone: 'muted' | 'destructive'; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex h-8 items-center rounded-full px-3.5 text-[12px] font-medium',
        tone === 'destructive'
          ? 'bg-destructive text-destructive-foreground'
          : 'bg-muted text-muted-foreground'
      )}
    >
      {children}
    </span>
  )
}
