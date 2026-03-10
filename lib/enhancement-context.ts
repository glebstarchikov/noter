export const MAX_ENHANCEMENT_DOCUMENT_CHARS = 10_000
export const MAX_ENHANCEMENT_STRUCTURED_CHARS = 4_000
export const MAX_ENHANCEMENT_TRANSCRIPT_CHARS = 40_000

function truncateContext(value: string, maxChars: number, label: string) {
  if (value.length <= maxChars) {
    return value
  }

  return `${value.slice(0, maxChars)}\n\n[${label} truncated to ${maxChars} characters]`
}

export function shapeEnhancementContext(input: {
  currentDocumentText: string
  structuredContext: string
  transcript: string
}) {
  return {
    currentDocumentText: truncateContext(
      input.currentDocumentText,
      MAX_ENHANCEMENT_DOCUMENT_CHARS,
      'Current note'
    ),
    structuredContext: truncateContext(
      input.structuredContext,
      MAX_ENHANCEMENT_STRUCTURED_CHARS,
      'Structured metadata'
    ),
    transcript: truncateContext(
      input.transcript,
      MAX_ENHANCEMENT_TRANSCRIPT_CHARS,
      'Transcript'
    ),
  }
}
