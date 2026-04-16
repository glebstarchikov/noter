import { generateObject } from 'ai'
import type { ZodSchema } from 'zod'

export class LlmCallError extends Error {
  constructor(
    public readonly code: 'MODEL_FAILED' | 'INVALID_OUTPUT',
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'LlmCallError'
  }
}

export interface CallNoteLlmParams<T> {
  /**
   * An AI SDK LanguageModel object (e.g. `openai('gpt-4o-mini')`) or a bare string model ID.
   * Typed as `unknown` because the AI SDK's LanguageModel generic is complex and varies per
   * version; callers pass runtime-valid values and the internal cast feeds it to generateObject.
   */
  model: unknown
  prompt: string
  schema: ZodSchema<T>
  maxAttempts?: number
  temperature?: number
  abortSignal?: AbortSignal
  /** Provider-specific options passed straight through to generateObject (e.g. strictJsonSchema). */
  providerOptions?: Record<string, unknown>
  /** Injected for testability — not used in production. */
  _generateObject?: typeof generateObject
}

export interface CallNoteLlmResult<T> {
  object: T
  usage: { totalTokens: number }
  attemptsUsed: number
}

/**
 * Unified OpenAI call for note-related LLM operations. Used by both
 * `generateNotesFromTranscript` (initial generation) and `runEnhanceLlm`
 * (refinement). Handles retry with configurable attempts. Prompts stay
 * caller-specific; this helper owns only the call mechanics.
 */
export async function callNoteLlm<T>(
  params: CallNoteLlmParams<T>,
): Promise<CallNoteLlmResult<T>> {
  const { model, prompt, schema, maxAttempts = 2, temperature, abortSignal, providerOptions } = params
  const generate = params._generateObject ?? generateObject

  let lastError: unknown = null
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await generate({
        model,
        prompt,
        schema,
        temperature,
        abortSignal,
        ...(providerOptions !== undefined ? { providerOptions } : {}),
      } as Parameters<typeof generate>[0])
      return {
        object: result.object as T,
        usage: { totalTokens: result.usage?.totalTokens ?? 0 },
        attemptsUsed: attempt,
      }
    } catch (error) {
      lastError = error
      if (attempt >= maxAttempts) break
    }
  }

  throw new LlmCallError(
    'MODEL_FAILED',
    lastError instanceof Error ? lastError.message : 'LLM call failed',
    lastError,
  )
}
