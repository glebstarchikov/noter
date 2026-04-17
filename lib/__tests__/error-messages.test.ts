import { describe, test, expect } from 'bun:test'
import { translateToUserError } from '@/lib/notes/error-messages'

describe('translateToUserError', () => {
  test('undici-style URL error becomes friendly service-unavailable', () => {
    const result = translateToUserError(
      new Error('fetch failed: Was there a typo in the url or port?'),
    )
    expect(result.userMessage).toContain('service')
    expect(result.developerMessage).toContain('typo in the url or port')
  })

  test('OpenAI quota error becomes friendly quota message', () => {
    const result = translateToUserError(
      new Error('429 You exceeded your current quota, please check your plan and billing details'),
    )
    expect(result.userMessage).toContain('quota')
  })

  test('unknown error falls back to a generic message', () => {
    const result = translateToUserError(new Error('something weird happened'))
    expect(result.userMessage).toBe('Something went wrong. Please try again.')
    expect(result.developerMessage).toBe('something weird happened')
  })

  test('handles non-Error inputs gracefully', () => {
    const result = translateToUserError('just a string' as unknown as Error)
    expect(result.userMessage).toBe('Something went wrong. Please try again.')
  })
})
