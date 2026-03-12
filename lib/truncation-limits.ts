/**
 * Centralized content truncation limits for AI calls.
 * Prevents context overflow and cost escalation.
 */

/** Max transcript chars for notes generation and per-meeting chat */
export const MAX_TRANSCRIPT_CHARS = 400_000

/** Max transcript chars for per-meeting chat context */
export const MAX_CHAT_TRANSCRIPT_CHARS = 300_000

/** Max source document chars for per-meeting chat context */
export const MAX_CHAT_SOURCE_CHARS = 50_000

/** Max audio file size in bytes (Whisper limit: 25MB) */
export const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024
