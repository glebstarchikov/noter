import { describe, test, expect, mock } from 'bun:test'
import { callNoteLlm, LlmCallError } from '@/lib/notes/llm-call'
import { z } from 'zod'

const testSchema = z.object({
  summary: z.string(),
})

describe('callNoteLlm', () => {
  test('returns parsed output on first-attempt success', async () => {
    const generate = mock(async () => ({
      object: { summary: 'test summary' },
      usage: { totalTokens: 100 },
    }))
    const result = await callNoteLlm({
      model: 'gpt-5-mini',
      prompt: 'system prompt',
      schema: testSchema,
      maxAttempts: 2,
      _generateObject: generate as never,
    })
    expect(result.object.summary).toBe('test summary')
    expect(result.attemptsUsed).toBe(1)
    expect(generate).toHaveBeenCalledTimes(1)
  })

  test('retries once on failure then succeeds', async () => {
    let calls = 0
    const generate = mock(async () => {
      calls += 1
      if (calls === 1) {
        throw new Error('Transient model error')
      }
      return { object: { summary: 'success' }, usage: { totalTokens: 50 } }
    })
    const result = await callNoteLlm({
      model: 'gpt-5-mini',
      prompt: 'system prompt',
      schema: testSchema,
      maxAttempts: 2,
      _generateObject: generate as never,
    })
    expect(result.object.summary).toBe('success')
    expect(result.attemptsUsed).toBe(2)
    expect(calls).toBe(2)
  })

  test('throws LlmCallError after exhausting attempts with cause propagated', async () => {
    const originalError = new Error('Persistent failure')
    const generate = mock(async () => {
      throw originalError
    })
    const err = await callNoteLlm({
      model: 'gpt-5-mini',
      prompt: 'system prompt',
      schema: testSchema,
      maxAttempts: 2,
      _generateObject: generate as never,
    }).catch((e) => e)
    expect(err).toBeInstanceOf(LlmCallError)
    expect(err.code).toBe('MODEL_FAILED')
    expect(err.cause).toBe(originalError)
    expect(err.message).toBe('Persistent failure')
  })
})
