import { createOpenAI } from '@ai-sdk/openai'
import {
  convertToModelMessages,
  streamText,
  UIMessage,
} from 'ai'
import { createClient } from '@/lib/supabase/server'

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

    const body = await req.json()
    const { messages, meetingId } = body as {
      messages: UIMessage[]
      meetingId: string
    }

    if (!meetingId) {
      return new Response('Missing meetingId', { status: 400 })
    }

    // Fetch meeting data
    const { data: meeting } = await supabase
      .from('meetings')
      .select(
        'title, transcript, summary, action_items, key_decisions, topics, follow_ups'
      )
      .eq('id', meetingId)
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
      context += `## Full Transcript\n${meeting.transcript}\n\n`
    }

    if (sources && sources.length > 0) {
      context += `## External Sources\n`
      for (const source of sources) {
        context += `### ${source.name} (${source.file_type})\n${source.content}\n\n`
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
