export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export const DOCUMENT_MEDIA_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  DOCX_MIME,
])

export function isDocumentAttachment(mediaType: string | null | undefined, filename = '') {
  const normalizedType = mediaType?.toLowerCase() ?? ''
  const normalizedName = filename.toLowerCase()

  return (
    normalizedType === 'application/pdf' ||
    normalizedType === 'text/plain' ||
    normalizedType === 'text/markdown' ||
    normalizedType === DOCX_MIME ||
    normalizedName.endsWith('.pdf') ||
    normalizedName.endsWith('.txt') ||
    normalizedName.endsWith('.md') ||
    normalizedName.endsWith('.docx')
  )
}

export function isImageAttachment(mediaType: string | null | undefined) {
  return typeof mediaType === 'string' && mediaType.startsWith('image/')
}
