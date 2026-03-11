export type ChatModelTier = 'fast' | 'balanced' | 'premium'

export const CHAT_MODEL_MAP: Record<ChatModelTier, string> = {
  fast: 'google/gemini-3-flash',
  balanced: 'anthropic/claude-sonnet-4.5',
  premium: 'openai/gpt-5.4',
}

export const ENHANCEMENT_MODEL = 'gpt-4o-mini'
export const METADATA_MODEL = process.env.AI_GATEWAY_API_KEY
  ? 'openai/gpt-4o-mini'
  : 'gpt-4o-mini'

export function resolveChatModelTier(value: unknown): ChatModelTier {
  if (value === 'fast' || value === 'premium') return value
  return 'balanced'
}

export function resolveChatModel(value: unknown) {
  return CHAT_MODEL_MAP[resolveChatModelTier(value)]
}
