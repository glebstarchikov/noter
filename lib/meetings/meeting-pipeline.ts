'use client'

import type { MeetingStatus } from '@/lib/types'

export const STATUS_POLL_INTERVAL_MS = 3_000
export const STATUS_POLL_TIMEOUT_MS = 20 * 60 * 1000

export type ProcessingState = {
    meetingId: string
    step: MeetingStatus
    error?: string
}

/**
 * Parse a non-ok API response into a structured error.
 */
export async function readApiError(
    response: Response,
    fallbackMessage: string
): Promise<{ message: string; code?: string }> {
    const text = await response.text()
    try {
        const parsed = JSON.parse(text)
        return {
            message: typeof parsed?.error === 'string' ? parsed.error : fallbackMessage,
            code: typeof parsed?.code === 'string' ? parsed.code : undefined,
        }
    } catch {
        return { message: text || fallbackMessage, code: undefined }
    }
}

/**
 * Poll the meeting status endpoint until completion, error, or timeout.
 */
export async function waitForMeetingCompletion(
    meetingId: string,
    onProcessing: (state: ProcessingState) => void
): Promise<void> {
    const startedAt = Date.now()

    while (Date.now() - startedAt < STATUS_POLL_TIMEOUT_MS) {
        const statusRes = await fetch(`/api/meetings/${meetingId}`, { cache: 'no-store' })
        if (!statusRes.ok) {
            await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_INTERVAL_MS))
            continue
        }

        const payload = await statusRes.json().catch(() => null)
        const status = payload?.meeting?.status as MeetingStatus | undefined
        const errorMessage = payload?.meeting?.error_message as string | null | undefined

        if (
            status &&
            ['recording', 'generating', 'done', 'error'].includes(status)
        ) {
            onProcessing({
                meetingId,
                step: status,
                error: status === 'error' ? errorMessage ?? undefined : undefined,
            })
        }

        if (status === 'done') {
            return
        }

        if (status === 'error') {
            throw new Error(errorMessage || 'Processing failed')
        }

        await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_INTERVAL_MS))
    }

    throw new Error('Processing timed out. Please open the meeting from dashboard and try again.')
}

