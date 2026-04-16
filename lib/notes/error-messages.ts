export interface TranslatedError {
  /** Short, user-domain message suitable for UI rendering. */
  userMessage: string
  /** Original technical detail, preserved for Sentry + dev tooling. */
  developerMessage: string
}

const GENERIC_MESSAGE = 'Something went wrong. Please try again.'

const PATTERNS: Array<{ test: RegExp; message: string }> = [
  {
    test: /typo in the url or port|ECONNREFUSED|fetch failed|ConnectionRefused/i,
    message: 'AI service is unavailable right now. Please try again in a moment.',
  },
  {
    test: /exceeded your current quota|insufficient_quota/i,
    message: 'Your AI provider quota is exhausted. Check your billing with OpenAI or your gateway provider.',
  },
  {
    test: /rate limit|RATE_LIMITED|\b429\b/i,
    message: 'Too many requests. Please wait a moment and try again.',
  },
  {
    test: /model_not_found|404.*model/i,
    message: 'The AI model is not available. Check your model configuration.',
  },
  {
    test: /invalid_api_key|\b401\b|incorrect api key/i,
    message: 'AI provider credentials are missing or invalid. Check OPENAI_API_KEY in your environment.',
  },
  {
    test: /context_length_exceeded|maximum context length/i,
    message: 'The meeting is too long for the selected model. Try a shorter transcript or a model with a larger context.',
  },
  {
    test: /STALE_SOURCE_HASH|source hash/i,
    message: 'The note changed while you were reviewing. Reload and try again.',
  },
]

export function translateToUserError(error: unknown): TranslatedError {
  if (!(error instanceof Error)) {
    return {
      userMessage: GENERIC_MESSAGE,
      developerMessage: typeof error === 'string' ? error : 'Unknown non-Error value',
    }
  }

  const raw = error.message
  const match = PATTERNS.find((p) => p.test.test(raw))

  return {
    userMessage: match?.message ?? GENERIC_MESSAGE,
    developerMessage: raw,
  }
}
