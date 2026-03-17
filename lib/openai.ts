import OpenAI from 'openai'

let _openai: OpenAI | null = null
export function getOpenAI() {
  if (!_openai) {
    if (process.env.AI_GATEWAY_API_KEY) {
      _openai = new OpenAI({
        apiKey: process.env.AI_GATEWAY_API_KEY,
        baseURL: 'https://ai-gateway.vercel.sh/v1',
      })
    } else {
      _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    }
  }
  return _openai
}
