import type { Meeting } from '@/lib/types'
import type { ActionItem } from '@/lib/types'

// Minimal Tiptap JSON types
export type TiptapNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: TiptapNode[]
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  text?: string
}

export type TiptapDocument = { type: 'doc'; content: TiptapNode[] }
export const EMPTY_TIPTAP_DOCUMENT: TiptapDocument = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

export interface GeneratedNotesDocumentInput {
  summary: string
  detailed_notes: string
  action_items: ActionItem[]
  key_decisions: string[]
  follow_ups: string[]
}

// Primitives

function textNode(s: string): TiptapNode {
  return { type: 'text', text: s }
}

function heading(level: number, content: string): TiptapNode {
  return { type: 'heading', attrs: { level }, content: [textNode(content)] }
}

function paragraph(content: string): TiptapNode {
  if (!content.trim()) return { type: 'paragraph' }
  return { type: 'paragraph', content: [textNode(content)] }
}

function bulletList(items: string[]): TiptapNode {
  return {
    type: 'bulletList',
    content: items.map((item) => ({
      type: 'listItem',
      content: [paragraph(item)],
    })),
  }
}

function taskList(items: { task: string; owner: string | null; done: boolean }[]): TiptapNode {
  return {
    type: 'taskList',
    content: items.map((item) => ({
      type: 'taskItem',
      attrs: { checked: item.done },
      content: [paragraph(item.owner ? `${item.task}  ·  ${item.owner}` : item.task)],
    })),
  }
}

function buildMeetingNodes(input: GeneratedNotesDocumentInput): TiptapNode[] {
  const nodes: TiptapNode[] = []

  if (input.summary) {
    nodes.push(heading(2, 'Summary'))
    nodes.push(paragraph(input.summary))
  }

  if (input.detailed_notes) {
    // Parse markdown headings and bullets into Tiptap nodes
    const lines = input.detailed_notes.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (trimmed.startsWith('## ')) {
        nodes.push(heading(2, trimmed.slice(3)))
      } else if (trimmed.startsWith('# ')) {
        nodes.push(heading(1, trimmed.slice(2)))
      } else if (trimmed.startsWith('### ')) {
        nodes.push(heading(3, trimmed.slice(4)))
      } else if (/^[-*•] /.test(trimmed)) {
        nodes.push({
          type: 'bulletList',
          content: [{
            type: 'listItem',
            content: [paragraph(trimmed.replace(/^[-*•] /, ''))],
          }],
        })
      } else {
        nodes.push(paragraph(trimmed))
      }
    }
  } else if (input.key_decisions.length) {
    nodes.push(heading(2, 'Key Decisions'))
    nodes.push(bulletList(input.key_decisions))
  }

  if (input.action_items.length) {
    nodes.push(heading(2, 'Action Items'))
    nodes.push(taskList(input.action_items))
  }

  if (input.follow_ups.length) {
    nodes.push(heading(2, 'Follow-ups'))
    nodes.push(bulletList(input.follow_ups))
  }

  return nodes
}

export function isTiptapDocument(value: unknown): value is TiptapDocument {
  return Boolean(
    value &&
    typeof value === 'object' &&
    (value as TiptapDocument).type === 'doc' &&
    Array.isArray((value as TiptapDocument).content)
  )
}

export function hasTiptapContent(value: unknown): value is TiptapDocument {
  return isTiptapDocument(value) && value.content.some((node) => {
    if (!node) return false
    if (node.type === 'paragraph' && (!node.content || node.content.length === 0)) return false
    return true
  })
}

function nodeToPlainText(node: TiptapNode): string {
  if (node.text) return node.text

  const childText = (node.content ?? []).map(nodeToPlainText).filter(Boolean).join('\n')

  if (node.type === 'heading') {
    return childText ? `${childText}\n` : ''
  }

  if (node.type === 'listItem' || node.type === 'taskItem') {
    return childText
  }

  if (node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'taskList') {
    return (node.content ?? []).map((child) => `- ${nodeToPlainText(child)}`.trim()).join('\n')
  }

  return childText
}

export function tiptapToPlainText(value: unknown): string {
  if (!isTiptapDocument(value)) return ''

  return value.content
    .map(nodeToPlainText)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .join('\n\n')
}

export function generatedNotesToTiptap(input: GeneratedNotesDocumentInput): TiptapDocument {
  const nodes = buildMeetingNodes(input)

  if (nodes.length === 0) {
    nodes.push({ ...EMPTY_TIPTAP_DOCUMENT.content[0] })
  }

  return { type: 'doc', content: nodes }
}

export function createEmptyTiptapDocument(): TiptapDocument {
  return {
    type: 'doc',
    content: [{ type: 'paragraph' }],
  }
}

export function mergeTiptapDocuments(
  existing: unknown,
  appended: TiptapDocument
): TiptapDocument {
  if (!isTiptapDocument(existing) || existing.content.length === 0) {
    return appended
  }

  return {
    type: 'doc',
    content: [...existing.content, ...appended.content],
  }
}

/**
 * Converts legacy meeting fields (summary, detailed_notes, action_items, etc.)
 * into a Tiptap JSON document. Used when document_content is null.
 */
export function legacyMeetingToTiptap(meeting: Meeting): TiptapDocument {
  return generatedNotesToTiptap({
    summary: meeting.summary ?? '',
    detailed_notes: meeting.detailed_notes ?? '',
    action_items: meeting.action_items ?? [],
    key_decisions: meeting.key_decisions ?? [],
    follow_ups: meeting.follow_ups ?? [],
  })
}

export function normalizeTiptapDocument(value: unknown): TiptapDocument {
  return isTiptapDocument(value) ? value : createEmptyTiptapDocument()
}
