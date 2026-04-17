import {
  normalizeTiptapDocument,
  type TiptapDocument,
} from '@/lib/tiptap/tiptap-converter'

export type DocumentSaveSuccess = {
  ok: true
  documentHash: string
}

export type DocumentSaveConflict = {
  ok: false
  code: 'STALE_DOCUMENT'
  message: string
  currentDocument: TiptapDocument
  currentHash: string
}

export async function saveMeetingDocument({
  meetingId,
  document,
  baseHash,
}: {
  meetingId: string
  document: TiptapDocument
  baseHash: string
}): Promise<DocumentSaveSuccess | DocumentSaveConflict> {
  const response = await fetch(`/api/meetings/${meetingId}/document`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_content: document,
      baseHash,
    }),
  })

  const payload = await response.json().catch(() => null)

  if (response.status === 409) {
    return {
      ok: false,
      code: 'STALE_DOCUMENT',
      message:
        typeof payload?.error === 'string'
          ? payload.error
          : 'A newer version of this note was saved elsewhere.',
      currentDocument: normalizeTiptapDocument(payload?.currentDocument),
      currentHash:
        typeof payload?.currentHash === 'string'
          ? payload.currentHash
          : baseHash,
    }
  }

  if (!response.ok) {
    throw new Error(
      typeof payload?.error === 'string' ? payload.error : 'Failed to save the current note'
    )
  }

  return {
    ok: true,
    documentHash:
      typeof payload?.documentHash === 'string' && payload.documentHash
        ? payload.documentHash
        : baseHash,
  }
}

export function isDocumentSaveConflict(
  value: DocumentSaveSuccess | DocumentSaveConflict
): value is DocumentSaveConflict {
  return !value.ok
}
