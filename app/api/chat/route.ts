import { createOpenAI } from '@ai-sdk/openai'
import {
  convertToModelMessages,
  streamText,
  UIMessage,
} from 'ai'
import { createClient } from '@/lib/supabase/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(10, '10 s'),
      analytics: true,
    })
    : null

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return new Response('Unauthorized', { status: 401 })
    }

    if (ratelimit) {
      const { success } = await ratelimit.limit(`chat_${user.id}`)
      if (!success) {
        return new Response('Too Many Requests', { status: 429 })
      }
    }

    const body = await req.json()
    const { messages, meetingId } = body as {
      messages: UIMessage[]
      meetingId: string
    }

    if (!meetingId) {
      return new Response('Missing meetingId', { status: 400 })
    }

    // Fetch meeting data (with ownership check)
    const { data: meeting } = await supabase
      .from('meetings')
      .select(
        'title, transcript, summary, detailed_notes, action_items, key_decisions, topics, follow_ups, user_id'
      )
      .eq('id', meetingId)
      .eq('user_id', user.id)
      .single()

    if (!meeting) {
      return new Response('Meeting not found', { status: 404 })
    }

    // Fetch attached sources
    const { data: sources } = await supabase
      .from('meeting_sources')
      .select('name, file_type, content')
      .eq('meeting_id', meetingId)

    // Build context from meeting materials
    let context = `# Meeting: ${meeting.title}\n\n`

    if (meeting.summary) {
      context += `## Summary\n${meeting.summary}\n\n`
    }

    if (meeting.detailed_notes) {
      context += `## Detailed Notes\n${meeting.detailed_notes}\n\n`
    }

    if (Array.isArray(meeting.action_items) && meeting.action_items.length > 0) {
      context += `## Action Items\n`
      for (const item of meeting.action_items as Array<{
        task: string
        owner: string | null
        done: boolean
      }>) {
        context += `- [${item.done ? 'x' : ' '}] ${item.task}${item.owner ? ` (Owner: ${item.owner})` : ''}\n`
      }
      context += '\n'
    }

    if (Array.isArray(meeting.key_decisions) && meeting.key_decisions.length > 0) {
      context += `## Key Decisions\n`
      for (const decision of meeting.key_decisions as string[]) {
        context += `- ${decision}\n`
      }
      context += '\n'
    }

    if (Array.isArray(meeting.topics) && meeting.topics.length > 0) {
      context += `## Topics Discussed\n`
      for (const topic of meeting.topics as string[]) {
        context += `- ${topic}\n`
      }
      context += '\n'
    }

    if (Array.isArray(meeting.follow_ups) && meeting.follow_ups.length > 0) {
      context += `## Follow-ups\n`
      for (const followUp of meeting.follow_ups as string[]) {
        context += `- ${followUp}\n`
      }
      context += '\n'
    }

    if (meeting.transcript) {
      // Truncate transcript if it's very long to stay within context limits
      const transcript = meeting.transcript.length > 300_000
        ? meeting.transcript.slice(0, 300_000) + '\n\n[Transcript truncated due to length]'
        : meeting.transcript
      context += `## Full Transcript\n${transcript}\n\n`
    }

    if (sources && sources.length > 0) {
      context += `## External Sources\n`
      for (const source of sources) {
        // Truncate individual source content if very large
        const content = source.content.length > 50_000
          ? source.content.slice(0, 50_000) + '\n\n[Document truncated due to length]'
          : source.content
        context += `### ${source.name} (${source.file_type})\n${content}\n\n`
      }
    }

    const systemPrompt = `You are noter AI, a helpful meeting assistant. You have access to the full context of a meeting including its transcript, structured notes, and any external documents the user has attached.

Your job is to:
- Answer questions about what happened in the meeting
- Elaborate on specific points discussed
- Verify whether topics or actions were mentioned
- Cross-reference information from external sources with meeting content
- Provide clear, concise, and accurate answers

Rules:
- Only answer based on the provided context. If something wasn't discussed or isn't in the materials, say so honestly.
- When referencing information, mention which source it came from (transcript, notes, or a specific document name).
- Be conversational but professional. Keep answers focused and to the point.
- Format responses with markdown for readability.

Here is the full meeting context:

${context}`

    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const result = streamText({
      model: openai('gpt-4o-mini'),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      abortSignal: req.signal,
    })

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
    })
  } catch (error: unknown) {
    console.error('Chat API error:', error)
    const message =
      error instanceof Error ? error.message : 'Chat failed'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
