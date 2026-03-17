import { z } from 'zod'
import type { TiptapDocument, TiptapNode } from '@/lib/tiptap-converter'

const MAX_SUMMARY_CHARS = 200
const MAX_BLOCK_TEXT_CHARS = 2_000
const MAX_LIST_ITEMS = 40
const MAX_LIST_ITEM_TEXT_CHARS = 500
const MAX_OWNER_CHARS = 200
const MAX_BLOCKS = 120

const headingBlockSchema = z.object({
  type: z.literal('heading'),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  text: z.string().min(1).max(MAX_BLOCK_TEXT_CHARS),
}).strict()

const paragraphBlockSchema = z.object({
  type: z.literal('paragraph'),
  text: z.string().min(1).max(MAX_BLOCK_TEXT_CHARS),
}).strict()

const bulletListBlockSchema = z.object({
  type: z.literal('bullet_list'),
  items: z.array(z.string().min(1).max(MAX_LIST_ITEM_TEXT_CHARS)).min(1).max(MAX_LIST_ITEMS),
}).strict()

const taskItemSchema = z.object({
  text: z.string().min(1).max(MAX_LIST_ITEM_TEXT_CHARS),
  done: z.boolean(),
  owner: z.string().max(MAX_OWNER_CHARS).nullable(),
}).strict()

const taskListBlockSchema = z.object({
  type: z.literal('task_list'),
  items: z.array(taskItemSchema).min(1).max(MAX_LIST_ITEMS),
}).strict()

export const draftBlockSchema = z.discriminatedUnion('type', [
  headingBlockSchema,
  paragraphBlockSchema,
  bulletListBlockSchema,
  taskListBlockSchema,
])

export const draftProposalSchema = z.object({
  schemaVersion: z.literal(1),
  summary: z.string().min(1).max(MAX_SUMMARY_CHARS),
  blocks: z.array(draftBlockSchema).min(1).max(MAX_BLOCKS),
}).strict()

export type DraftBlock = z.infer<typeof draftBlockSchema>
export type DraftProposalV1 = z.infer<typeof draftProposalSchema>

const SUPPORTED_SOURCE_TOP_LEVEL_BLOCKS = new Set([
  'heading',
  'paragraph',
  'bulletList',
  'taskList',
])

export class DraftProposalValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DraftProposalValidationError'
  }
}

function normalizeNonEmptyText(value: string, label: string) {
  const normalized = value.trim()
  if (!normalized) {
    throw new DraftProposalValidationError(`${label} must not be empty`)
  }

  return normalized
}

function textNode(text: string): TiptapNode {
  return { type: 'text', text }
}

function paragraphNode(text: string): TiptapNode {
  return {
    type: 'paragraph',
    content: [textNode(text)],
  }
}

export function validateDraftProposal(value: unknown): DraftProposalV1 {
  const parsed = draftProposalSchema.safeParse(value)
  if (!parsed.success) {
    throw new DraftProposalValidationError('Draft output did not match the expected schema')
  }

  const proposal = parsed.data

  if (proposal.blocks.length === 0) {
    throw new DraftProposalValidationError('Draft output must include at least one block')
  }

  proposal.summary = normalizeNonEmptyText(proposal.summary, 'Draft summary')

  proposal.blocks.forEach((block, index) => {
    if (block.type === 'heading' || block.type === 'paragraph') {
      block.text = normalizeNonEmptyText(
        block.text,
        `Draft block ${index + 1} text`
      )
      return
    }

    if (block.type === 'bullet_list') {
      block.items = block.items.map((item, itemIndex) =>
        normalizeNonEmptyText(item, `Draft bullet ${index + 1}.${itemIndex + 1}`)
      )
      return
    }

    block.items = block.items.map((item, itemIndex) => ({
      ...item,
      text: normalizeNonEmptyText(item.text, `Draft task ${index + 1}.${itemIndex + 1}`),
      owner:
        item.owner === null
          ? null
          : normalizeNonEmptyText(item.owner, `Draft task owner ${index + 1}.${itemIndex + 1}`),
    }))
  })

  return proposal
}

export function assertSupportedEnhancementSourceDocument(document: TiptapDocument) {
  const unsupportedTypes = document.content
    .map((node) => node?.type)
    .filter((type): type is string => Boolean(type) && !SUPPORTED_SOURCE_TOP_LEVEL_BLOCKS.has(type))

  if (unsupportedTypes.length > 0) {
    throw new DraftProposalValidationError(
      `Current note contains unsupported top-level blocks: ${unsupportedTypes.join(', ')}`
    )
  }
}

export function compileDraftProposalToTiptap(proposal: DraftProposalV1): TiptapDocument {
  const validatedProposal = validateDraftProposal(proposal)

  const content = validatedProposal.blocks.map<TiptapNode>((block) => {
    if (block.type === 'heading') {
      return {
        type: 'heading',
        attrs: { level: block.level },
        content: [textNode(block.text)],
      }
    }

    if (block.type === 'paragraph') {
      return paragraphNode(block.text)
    }

    if (block.type === 'bullet_list') {
      return {
        type: 'bulletList',
        content: block.items.map((item) => ({
          type: 'listItem',
          content: [paragraphNode(item)],
        })),
      }
    }

    return {
      type: 'taskList',
      content: block.items.map((item) => ({
        type: 'taskItem',
        attrs: { checked: item.done },
        content: [
          paragraphNode(item.owner ? `${item.text}  ·  ${item.owner}` : item.text),
        ],
      })),
    }
  })

  if (content.length === 0) {
    throw new DraftProposalValidationError('Draft output compiled into an empty document')
  }

  return {
    type: 'doc',
    content,
  }
}

export const draftProposalLimits = {
  maxSummaryChars: MAX_SUMMARY_CHARS,
  maxBlockTextChars: MAX_BLOCK_TEXT_CHARS,
  maxListItems: MAX_LIST_ITEMS,
  maxListItemTextChars: MAX_LIST_ITEM_TEXT_CHARS,
  maxOwnerChars: MAX_OWNER_CHARS,
  maxBlocks: MAX_BLOCKS,
} as const

export const draftPromptSchemaExample = {
  schemaVersion: 1,
  summary: 'Adds clearer action items and a tighter structure.',
  blocks: [
    {
      type: 'heading',
      level: 2,
      text: 'Summary',
    },
    {
      type: 'paragraph',
      text: 'The team aligned on the next launch steps.',
    },
    {
      type: 'bullet_list',
      items: ['Confirm timeline', 'Share follow-up notes'],
    },
    {
      type: 'task_list',
      items: [
        { text: 'Send revised deck', done: false, owner: 'Alice' },
        { text: 'Book design review', done: false, owner: null },
      ],
    },
  ],
} as const
