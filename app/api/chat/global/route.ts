import { createOpenAI } from '@ai-sdk/openai'
import {
    convertToModelMessages,
    streamText,
    UIMessage,
} from 'ai'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-helpers'
import { isStringArray, isActionItemArray } from '@/lib/type-guards'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { z } from 'zod'

const ratelimit =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? new Ratelimit({
            redis: Redis.fromEnv(),
            limiter: Ratelimit.slidingWindow(10, '10 s'),
            analytics: true,
        })
        : null

export const maxDuration = 60

const MAX_GLOBAL_CONTEXT_CHARS = 100_000

const globalChatRequestSchema = z.object({
    messages: z.array(z.unknown()).default([]),
})

interface MeetingRow {
    id: string
    title: string | null
    summary: string | null
    action_items: unknown
    key_decisions: unknown
    topics: unknown
    follow_ups: unknown
    created_at: string
}

export async function POST(req: Request) {
    try {
        const supabase = await createClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
            return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
        }

        if (ratelimit) {
            const { success } = await ratelimit.limit(`global_chat_${user.id}`)
            if (!success) {
                return errorResponse('Too Many Requests', 'RATE_LIMITED', 429)
            }
        }

        const rawBody = await req.json().catch(() => null)
        const parsedBody = globalChatRequestSchema.safeParse(rawBody)
        if (!parsedBody.success) {
            return errorResponse('Invalid request body', 'INVALID_REQUEST', 400)
        }
        const { messages } = parsedBody.data

        // Fetch ALL user meetings (summaries only, no transcripts for context efficiency)
        const { data: meetings } = await supabase
            .from('meetings')
            .select(
                'id, title, summary, action_items, key_decisions, topics, follow_ups, created_at'
            )
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(100)

        if (!meetings || meetings.length === 0) {
            return errorResponse('No meetings found', 'NO_MEETINGS', 404)
        }

        // Build context from all meetings with truncation safeguard
        let context = `# All Meetings (${meetings.length} total)\n\n`
        let contextSize = 0

        for (const meeting of meetings as MeetingRow[]) {
            const meetingTitle =
                typeof meeting.title === 'string' && meeting.title.trim().length > 0
                    ? meeting.title
                    : 'Untitled Meeting'

            const createdDate = new Date(meeting.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            })

            let meetingBlock = `---\n## ${meetingTitle} (${createdDate})\n\n`

            if (typeof meeting.summary === 'string' && meeting.summary.length > 0) {
                meetingBlock += `### Summary\n${meeting.summary}\n\n`
            }

            const actionItems = isActionItemArray(meeting.action_items) ? meeting.action_items : []
            if (actionItems.length > 0) {
                meetingBlock += `### Action Items\n`
                for (const item of actionItems) {
                    meetingBlock += `- [${item.done ? 'x' : ' '}] ${item.task}${item.owner ? ` (Owner: ${item.owner})` : ''}\n`
                }
                meetingBlock += '\n'
            }

            const keyDecisions = isStringArray(meeting.key_decisions) ? meeting.key_decisions : []
            if (keyDecisions.length > 0) {
                meetingBlock += `### Key Decisions\n`
                for (const decision of keyDecisions) {
                    meetingBlock += `- ${decision}\n`
                }
                meetingBlock += '\n'
            }

            const topics = isStringArray(meeting.topics) ? meeting.topics : []
            if (topics.length > 0) {
                meetingBlock += `### Topics\n`
                for (const topic of topics) {
                    meetingBlock += `- ${topic}\n`
                }
                meetingBlock += '\n'
            }

            const followUps = isStringArray(meeting.follow_ups) ? meeting.follow_ups : []
            if (followUps.length > 0) {
                meetingBlock += `### Follow-ups\n`
                for (const followUp of followUps) {
                    meetingBlock += `- ${followUp}\n`
                }
                meetingBlock += '\n'
            }

            if (contextSize + meetingBlock.length > MAX_GLOBAL_CONTEXT_CHARS) {
                context += '\n\n[...additional meetings truncated due to context limits]\n'
                break
            }

            context += meetingBlock
            contextSize += meetingBlock.length
        }

        const systemPrompt = `You are noter AI, a global meeting assistant. You have access to summaries, action items, key decisions, topics, and follow-ups from ALL the user's meetings.

Your job is to:
- Answer questions that span multiple meetings
- Find patterns and recurring themes across meetings
- Track action items and responsibilities across meetings
- Compare what was discussed in different meetings
- Provide a holistic view of the user's meeting activity

Rules:
- Only answer based on the provided context. If something isn't in the meeting data, say so honestly.
- When referencing information, always mention which meeting it came from (by title and date).
- Be conversational but professional. Keep answers focused and to the point.
- Format responses with markdown for readability.
- When listing items from multiple meetings, organize them by meeting for clarity.

Here is the full context from all meetings:

${context}`

        const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })

        const result = streamText({
            model: openai('gpt-4o-mini'),
            system: systemPrompt,
            messages: await convertToModelMessages(messages as UIMessage[]),
            abortSignal: req.signal,
        })

        return result.toUIMessageStreamResponse({
            originalMessages: messages as UIMessage[],
        })
    } catch (error: unknown) {
        console.error('Global chat API error:', error)
        const message =
            error instanceof Error ? error.message : 'Chat failed'
        return errorResponse(message, 'CHAT_FAILED', 500)
    }
}
