export type ChatModelId = 'gpt-5-mini' | 'gpt-5.4'

export const DEFAULT_CHAT_MODEL: ChatModelId = 'gpt-5-mini'

export const CHAT_MODEL_MAP: Record<ChatModelId, string> = {
  'gpt-5-mini': 'openai/gpt-5-mini',
  'gpt-5.4': 'openai/gpt-5.4',
}

export const CHAT_MODEL_LABELS: Record<ChatModelId, string> = {
  'gpt-5-mini': 'GPT-5 mini',
  'gpt-5.4': 'GPT-5.4',
}

export const CHAT_MODEL_OPTIONS = Object.entries(CHAT_MODEL_LABELS).map(([value, label]) => ({
  value: value as ChatModelId,
  label,
}))

export const ENHANCEMENT_MODEL = 'gpt-4o-mini'
export const METADATA_MODEL = process.env.AI_GATEWAY_API_KEY
  ? 'openai/gpt-4o-mini'
  : 'gpt-4o-mini'

export function resolveChatModelId(value: unknown): ChatModelId {
  if (value === 'gpt-5.4') return value
  return DEFAULT_CHAT_MODEL
}

export function getChatModelLabel(value: unknown) {
  return CHAT_MODEL_LABELS[resolveChatModelId(value)]
}

export function resolveChatModel(value: unknown) {
  return CHAT_MODEL_MAP[resolveChatModelId(value)]
}
