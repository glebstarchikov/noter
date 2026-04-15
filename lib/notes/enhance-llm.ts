import { generateObject, NoObjectGeneratedError } from 'ai'
import { openai } from '@ai-sdk/openai'
import { ENHANCEMENT_MODEL } from '@/lib/ai-models'
import {
  assertSupportedEnhancementSourceDocument,
  compileDraftProposalToTiptap,
  DraftProposalValidationError,
  draftProposalSchema,
  validateDraftProposal,
} from '@/lib/notes/draft-proposal'
import { shapeEnhancementContext } from '@/lib/notes/enhancement-context'
import {
  ENHANCEMENT_INVALID_PROPOSAL_MESSAGE,
  ENHANCEMENT_MODEL_FAILED_MESSAGE,
  ENHANCEMENT_NO_USEFUL_CHANGES_MESSAGE,
} from '@/lib/notes/enhancement-errors'
import { buildDraftProposalPrompt } from '@/lib/notes/prompts'
import {
  hasTiptapContent,
  normalizeTiptapDocument,
  tiptapToPlainText,
  type TiptapDocument,
} from '@/lib/tiptap/tiptap-converter'
import { hashDocumentContent } from '@/lib/document-hash'
import { getStructuredContext, type ValidatedEnhanceRequest } from '@/lib/notes/enhance-validation'

export class EnhanceRouteError extends Error {
  code: string
  status: number
  logReason?: string
  retryUsed: boolean

  constructor(
    message: string,
    code: string,
    status: number,
    logReason?: string,
    retryUsed = false
  ) {
    super(message)
    this.name = 'EnhanceRouteError'
    this.code = code
    this.status = status
    this.logReason = logReason
    this.retryUsed = retryUsed
  }
}

export interface GenerateLogContext {
  meetingId: string
  mode: 'generate' | 'enhance'
  model: string
  currentDocumentChars: number
  structuredContextChars: number
  transcriptChars: number
}

export interface LlmEnhanceResult {
  proposedDocument: TiptapDocument
  sourceHash: string
  summary: string
  mode: 'generate' | 'enhance'
  retryUsed: boolean
  firstPassFailureReason: string | null
  logContext: GenerateLogContext
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error'
}

function isRetryableDraftError(error: unknown) {
  return (
    NoObjectGeneratedError.isInstance(error) ||
    error instanceof DraftProposalValidationError
  )
}

async function generateProposalDocument({
  mode,
  template,
  currentDocumentText,
  structuredContext,
  transcript,
}: {
  mode: 'generate' | 'enhance'
  template: ValidatedEnhanceRequest['template']
  currentDocumentText: string
  structuredContext: string
  transcript: string
}) {
  let firstPassFailureReason: string | null = null

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const { object } = await generateObject({
        model: openai(ENHANCEMENT_MODEL),
        schema: draftProposalSchema,
        temperature: 0.2,
        // 5 s headroom under the 60 s maxDuration set in app/api/meetings/[id]/enhance/route.ts
        abortSignal: AbortSignal.timeout(55_000),
        providerOptions: {
          openai: {
            strictJsonSchema: true,
          },
        },
        prompt: buildDraftProposalPrompt({
          mode,
          template,
          currentDocumentText,
          structuredContext,
          transcript,
          repairFeedback: attempt === 2 ? firstPassFailureReason : null,
        }),
      })

      const proposal = validateDraftProposal(object)
      const proposedDocument = compileDraftProposalToTiptap(proposal)

      return {
        proposal,
        proposedDocument,
        retryUsed: attempt === 2,
        firstPassFailureReason,
      }
    } catch (error: unknown) {
      const failureReason = getErrorMessage(error)

      if (attempt === 1 && isRetryableDraftError(error)) {
        firstPassFailureReason = failureReason
        continue
      }

      if (isRetryableDraftError(error)) {
        throw new EnhanceRouteError(
          ENHANCEMENT_INVALID_PROPOSAL_MESSAGE,
          'INVALID_PROPOSAL',
          502,
          failureReason,
          true
        )
      }

      throw new EnhanceRouteError(
        ENHANCEMENT_MODEL_FAILED_MESSAGE,
        'MODEL_FAILED',
        502,
        failureReason,
        false
      )
    }
  }

  throw new EnhanceRouteError(
    ENHANCEMENT_MODEL_FAILED_MESSAGE,
    'MODEL_FAILED',
    502,
    'Draft generation exhausted unexpectedly',
    true
  )
}

export async function runEnhanceLlm(
  validated: ValidatedEnhanceRequest,
): Promise<LlmEnhanceResult> {
  const { meeting, parsedBody, template } = validated

  if (parsedBody.action !== 'generate') {
    throw new Error('runEnhanceLlm called with non-generate action')
  }

  const sourceDocument = normalizeTiptapDocument(parsedBody.documentContent)
  const sourceHash = hashDocumentContent(sourceDocument)
  const currentDocumentText = tiptapToPlainText(sourceDocument).trim()
  const shapedContext = shapeEnhancementContext({
    currentDocumentText,
    structuredContext: getStructuredContext(meeting),
    transcript: meeting.transcript!,
  })

  const logContext: GenerateLogContext = {
    meetingId: meeting.id,
    mode: parsedBody.mode,
    model: ENHANCEMENT_MODEL,
    currentDocumentChars: shapedContext.currentDocumentText.length,
    structuredContextChars: shapedContext.structuredContext.length,
    transcriptChars: shapedContext.transcript.length,
  }

  if (parsedBody.mode === 'enhance') {
    try {
      assertSupportedEnhancementSourceDocument(sourceDocument)
    } catch (error: unknown) {
      const failureReason = getErrorMessage(error)
      throw new EnhanceRouteError(
        ENHANCEMENT_INVALID_PROPOSAL_MESSAGE,
        'INVALID_PROPOSAL',
        409,
        failureReason
      )
    }
  }

  const generated = await generateProposalDocument({
    mode: parsedBody.mode,
    template,
    currentDocumentText: shapedContext.currentDocumentText,
    structuredContext: shapedContext.structuredContext,
    transcript: shapedContext.transcript,
  })

  const proposedHasContent = hasTiptapContent(generated.proposedDocument)
  const sourceHasContent = hasTiptapContent(sourceDocument)
  const proposedHash = hashDocumentContent(generated.proposedDocument)

  if (!proposedHasContent) {
    throw new EnhanceRouteError(
      ENHANCEMENT_INVALID_PROPOSAL_MESSAGE,
      'INVALID_PROPOSAL',
      502,
      'Compiled proposal had no content'
    )
  }

  if (
    sourceHash === proposedHash ||
    (sourceHasContent &&
      tiptapToPlainText(generated.proposedDocument).trim() === currentDocumentText)
  ) {
    throw new EnhanceRouteError(
      ENHANCEMENT_NO_USEFUL_CHANGES_MESSAGE,
      'NO_USEFUL_CHANGES',
      409,
      'Generated proposal was materially identical to the source document'
    )
  }

  return {
    proposedDocument: generated.proposedDocument,
    sourceHash,
    summary: generated.proposal.summary,
    mode: parsedBody.mode,
    retryUsed: generated.retryUsed,
    firstPassFailureReason: generated.firstPassFailureReason,
    logContext,
  }
}
