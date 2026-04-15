import type { TiptapDocument } from '@/lib/tiptap/tiptap-converter'

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null'

  if (typeof value === 'string') {
    return JSON.stringify(value)
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  if (typeof value === 'object') {
    const objectValue = value as Record<string, unknown>
    const keys = Object.keys(objectValue).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`).join(',')}}`
  }

  return JSON.stringify(String(value))
}

function fnv1a(input: string) {
  let hash = 0x811c9dc5

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function hashDocumentContent(document: TiptapDocument) {
  return fnv1a(stableStringify(document))
}

export function hashUnknownContent(value: unknown) {
  return fnv1a(stableStringify(value))
}
