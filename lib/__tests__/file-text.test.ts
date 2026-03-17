import { describe, it, expect } from 'bun:test'
import { extractTextFromBuffer, decodeDataUrl } from '../file-text'

describe('extractTextFromBuffer', () => {
  it('extracts text from plain text buffer', async () => {
    const buffer = Buffer.from('Hello, world!')
    const result = await extractTextFromBuffer(buffer, 'test.txt', 'text/plain')
    expect(result).toBe('Hello, world!')
  })

  it('extracts text from markdown buffer', async () => {
    const buffer = Buffer.from('# Title\n\nContent here')
    const result = await extractTextFromBuffer(buffer, 'notes.md', 'text/markdown')
    expect(result).toBe('# Title\n\nContent here')
  })

  it('detects text/plain by .txt extension when no mediaType', async () => {
    const buffer = Buffer.from('Extension detection')
    const result = await extractTextFromBuffer(buffer, 'file.txt')
    expect(result).toBe('Extension detection')
  })

  it('detects markdown by .md extension when no mediaType', async () => {
    const buffer = Buffer.from('# Markdown')
    const result = await extractTextFromBuffer(buffer, 'README.md')
    expect(result).toBe('# Markdown')
  })

  it('throws for unsupported types', async () => {
    const buffer = Buffer.from('binary data')
    await expect(
      extractTextFromBuffer(buffer, 'data.bin', 'application/octet-stream')
    ).rejects.toThrow('Unsupported attachment type')
  })

  it('throws for unsupported file without mediaType', async () => {
    const buffer = Buffer.from('binary data')
    await expect(
      extractTextFromBuffer(buffer, 'data.xyz')
    ).rejects.toThrow('Unsupported attachment type')
  })
})

describe('decodeDataUrl', () => {
  it('decodes a base64 data URL', () => {
    const dataUrl = 'data:text/plain;base64,SGVsbG8=';
    const result = decodeDataUrl(dataUrl)
    expect(result.mediaType).toBe('text/plain')
    expect(result.buffer.toString('utf8')).toBe('Hello')
  })

  it('decodes data URL with charset', () => {
    const dataUrl = 'data:text/plain;charset=utf-8;base64,SGVsbG8=';
    const result = decodeDataUrl(dataUrl)
    expect(result.mediaType).toBe('text/plain')
    expect(result.buffer.toString('utf8')).toBe('Hello')
  })

  it('defaults mediaType to application/octet-stream when missing', () => {
    const dataUrl = 'data:;base64,SGVsbG8=';
    const result = decodeDataUrl(dataUrl)
    expect(result.mediaType).toBe('application/octet-stream')
  })

  it('throws for non-base64 data URLs', () => {
    expect(() => decodeDataUrl('data:text/plain,Hello')).toThrow(
      'Unsupported attachment encoding'
    )
  })

  it('throws for non-data URLs', () => {
    expect(() => decodeDataUrl('https://example.com')).toThrow(
      'Unsupported attachment encoding'
    )
  })

  it('throws for empty string', () => {
    expect(() => decodeDataUrl('')).toThrow('Unsupported attachment encoding')
  })
})
