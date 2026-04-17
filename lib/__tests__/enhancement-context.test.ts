import { describe, it, expect } from 'bun:test'
import {
  shapeEnhancementContext,
  MAX_ENHANCEMENT_DOCUMENT_CHARS,
  MAX_ENHANCEMENT_STRUCTURED_CHARS,
  MAX_ENHANCEMENT_TRANSCRIPT_CHARS,
} from '../notes/enhancement-context'

describe('shapeEnhancementContext', () => {
  it('passes through short content unchanged', () => {
    const result = shapeEnhancementContext({
      currentDocumentText: 'Short doc',
      structuredContext: 'Short context',
      transcript: 'Short transcript',
    })
    expect(result.currentDocumentText).toBe('Short doc')
    expect(result.structuredContext).toBe('Short context')
    expect(result.transcript).toBe('Short transcript')
  })

  it('truncates document text exceeding limit', () => {
    const longDoc = 'a'.repeat(MAX_ENHANCEMENT_DOCUMENT_CHARS + 100)
    const result = shapeEnhancementContext({
      currentDocumentText: longDoc,
      structuredContext: 'ok',
      transcript: 'ok',
    })
    expect(result.currentDocumentText.length).toBeLessThan(longDoc.length)
    expect(result.currentDocumentText).toContain('[Current note truncated to')
    expect(result.currentDocumentText).toContain(`${MAX_ENHANCEMENT_DOCUMENT_CHARS} characters]`)
  })

  it('truncates structured context exceeding limit', () => {
    const longContext = 'b'.repeat(MAX_ENHANCEMENT_STRUCTURED_CHARS + 100)
    const result = shapeEnhancementContext({
      currentDocumentText: 'ok',
      structuredContext: longContext,
      transcript: 'ok',
    })
    expect(result.structuredContext.length).toBeLessThan(longContext.length)
    expect(result.structuredContext).toContain('[Structured metadata truncated to')
  })

  it('truncates transcript exceeding limit', () => {
    const longTranscript = 'c'.repeat(MAX_ENHANCEMENT_TRANSCRIPT_CHARS + 100)
    const result = shapeEnhancementContext({
      currentDocumentText: 'ok',
      structuredContext: 'ok',
      transcript: longTranscript,
    })
    expect(result.transcript.length).toBeLessThan(longTranscript.length)
    expect(result.transcript).toContain('[Transcript truncated to')
  })

  it('does not truncate content exactly at limit', () => {
    const exactDoc = 'x'.repeat(MAX_ENHANCEMENT_DOCUMENT_CHARS)
    const result = shapeEnhancementContext({
      currentDocumentText: exactDoc,
      structuredContext: 'ok',
      transcript: 'ok',
    })
    expect(result.currentDocumentText).toBe(exactDoc)
  })

  it('handles empty strings', () => {
    const result = shapeEnhancementContext({
      currentDocumentText: '',
      structuredContext: '',
      transcript: '',
    })
    expect(result.currentDocumentText).toBe('')
    expect(result.structuredContext).toBe('')
    expect(result.transcript).toBe('')
  })
})
