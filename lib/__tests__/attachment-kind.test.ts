import { describe, it, expect } from 'bun:test'
import { isDocumentAttachment, isImageAttachment } from '../attachment-kind'

describe('isDocumentAttachment', () => {
  it('returns true for application/pdf', () => {
    expect(isDocumentAttachment('application/pdf')).toBe(true)
  })

  it('returns true for text/plain', () => {
    expect(isDocumentAttachment('text/plain')).toBe(true)
  })

  it('returns true for text/markdown', () => {
    expect(isDocumentAttachment('text/markdown')).toBe(true)
  })

  it('returns true for DOCX mime type', () => {
    expect(
      isDocumentAttachment(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    ).toBe(true)
  })

  it('returns true for .pdf filename regardless of mediaType', () => {
    expect(isDocumentAttachment(null, 'file.pdf')).toBe(true)
  })

  it('returns true for .txt filename', () => {
    expect(isDocumentAttachment(null, 'notes.txt')).toBe(true)
  })

  it('returns true for .md filename', () => {
    expect(isDocumentAttachment(null, 'README.md')).toBe(true)
  })

  it('returns true for .docx filename', () => {
    expect(isDocumentAttachment(null, 'report.docx')).toBe(true)
  })

  it('returns false for image types', () => {
    expect(isDocumentAttachment('image/png')).toBe(false)
  })

  it('returns false for unknown types without known extension', () => {
    expect(isDocumentAttachment('application/octet-stream', 'data.bin')).toBe(false)
  })

  it('handles case-insensitive mediaType', () => {
    expect(isDocumentAttachment('Application/PDF')).toBe(true)
  })

  it('handles case-insensitive filename', () => {
    expect(isDocumentAttachment(null, 'FILE.PDF')).toBe(true)
  })

  it('returns false for null mediaType and empty filename', () => {
    expect(isDocumentAttachment(null, '')).toBe(false)
  })

  it('returns false for undefined mediaType and no filename', () => {
    expect(isDocumentAttachment(undefined)).toBe(false)
  })
})

describe('isImageAttachment', () => {
  it('returns true for image/png', () => {
    expect(isImageAttachment('image/png')).toBe(true)
  })

  it('returns true for image/jpeg', () => {
    expect(isImageAttachment('image/jpeg')).toBe(true)
  })

  it('returns true for image/webp', () => {
    expect(isImageAttachment('image/webp')).toBe(true)
  })

  it('returns false for non-image types', () => {
    expect(isImageAttachment('application/pdf')).toBe(false)
  })

  it('returns false for null', () => {
    expect(isImageAttachment(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isImageAttachment(undefined)).toBe(false)
  })
})
