const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

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

export async function extractTextFromBuffer(
  buffer: Buffer,
  filename: string,
  mediaType?: string | null
): Promise<string> {
  const type = mediaType?.toLowerCase() ?? ''
  const lowerName = filename.toLowerCase()

  if (
    type === 'text/plain' ||
    type === 'text/markdown' ||
    lowerName.endsWith('.txt') ||
    lowerName.endsWith('.md')
  ) {
    return buffer.toString('utf8')
  }

  if (type === 'application/pdf' || lowerName.endsWith('.pdf')) {
    try {
      const pdfParse = (await import('pdf-parse')).default
      const data = await pdfParse(buffer)
      return data.text
    } catch {
      throw new Error('Failed to parse PDF attachment.')
    }
  }

  if (type === DOCX_MIME || lowerName.endsWith('.docx')) {
    try {
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(buffer)
      const docXml = zip.file('word/document.xml')
      if (!docXml) {
        throw new Error('Invalid DOCX')
      }
      const xmlContent = await docXml.async('text')
      const textParts: string[] = []
      const regex = /<w:t[^>]*>([^<]*)<\/w:t>/g
      let match: RegExpExecArray | null

      while ((match = regex.exec(xmlContent)) !== null) {
        textParts.push(match[1])
      }

      return textParts.join(' ').trim() || 'Could not extract text from DOCX file.'
    } catch {
      throw new Error('Failed to parse DOCX attachment.')
    }
  }

  throw new Error(`Unsupported attachment type: ${mediaType || filename}`)
}

export async function extractTextFromFile(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  return extractTextFromBuffer(buffer, file.name, file.type)
}

export function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/)
  if (!match) {
    throw new Error('Unsupported attachment encoding')
  }

  return {
    mediaType: match[1] || 'application/octet-stream',
    buffer: Buffer.from(match[2], 'base64'),
  }
}
