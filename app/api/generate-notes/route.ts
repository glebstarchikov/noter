import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// ~4 chars per token is a rough estimate; gpt-4o-mini supports 128k context
const MAX_TRANSCRIPT_CHARS = 400_000

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

const ratelimit =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      analytics: true,
    })
    : null

export const maxDuration = 60

const SYSTEM_PROMPT = `You are an expert meeting note-taker. Given a meeting transcript, produce structured notes in the following JSON format. Be concise but thorough.

{
  "title": "A short descriptive title for the meeting",
  "summary": "A 1-2 sentence executive summary of the meeting",
  "detailed_notes": "Comprehensive meeting notes in markdown format. Use ## headers for each major topic discussed. Under each header, include detailed bullet points covering: context and background, key discussion points, arguments or perspectives raised, conclusions reached, and any nuances worth capturing. These notes serve as the canonical record of the meeting and should be thorough enough that someone who missed the meeting can fully understand what happened.",
  "action_items": [
    { "task": "Description of the action item", "owner": "Person responsible or null", "done": false }
  ],
  "key_decisions": ["Decision 1", "Decision 2"],
  "topics": ["Topic 1", "Topic 2"],
  "follow_ups": ["Follow-up item 1", "Follow-up item 2"]
}

Rules:
- Extract ALL action items mentioned, even implicit ones
- Identify who is responsible for each action item when mentioned
- List key decisions that were made during the meeting
- List the main topics/themes discussed
- List any follow-ups or next steps mentioned
- The detailed_notes field should be comprehensive markdown with section headers per topic, not a repetition of the summary
- Keep language clear, professional, and concise
- Return ONLY valid JSON, nothing else`

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  let meetingId: string | null = null

  try {
    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (ratelimit) {
      const { success } = await ratelimit.limit(`generate_notes_${user.id}`)
      if (!success) {
        return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 })
      }
    }

    const body = await request.json()
    meetingId = body.meetingId
    const transcript = body.transcript

    if (!meetingId || !transcript) {
      return NextResponse.json({ error: 'Missing meetingId or transcript' }, { status: 400 })
    }

    // Truncate very long transcripts to stay within model context limits
    const truncatedTranscript = typeof transcript === 'string' && transcript.length > MAX_TRANSCRIPT_CHARS
      ? transcript.slice(0, MAX_TRANSCRIPT_CHARS) + '\n\n[Transcript truncated due to length]'
      : transcript

    // Verify user owns the meeting
    const { data: meeting } = await supabase
      .from('meetings')
      .select('id')
      .eq('id', meetingId)
      .eq('user_id', user.id)
      .single()

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // Update status
    await supabase
      .from('meetings')
      .update({ status: 'generating' })
      .eq('id', meetingId)

    // Generate notes with GPT
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Here is the meeting transcript:\n\n${truncatedTranscript}` },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from AI')
    }

    let notes: Record<string, unknown>
    try {
      notes = JSON.parse(content)
    } catch {
      throw new Error('AI returned invalid JSON. Please try again.')
    }

    // Save notes to database
    await supabase
      .from('meetings')
      .update({
        title: (notes.title as string) || 'Untitled Meeting',
        summary: (notes.summary as string) || '',
        detailed_notes: (notes.detailed_notes as string) || '',
        action_items: notes.action_items || [],
        key_decisions: notes.key_decisions || [],
        topics: notes.topics || [],
        follow_ups: notes.follow_ups || [],
        status: 'done',
        updated_at: new Date().toISOString(),
      })
      .eq('id', meetingId)

    return NextResponse.json({ notes, meetingId })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Notes generation failed'

    // Set meeting status to error so it doesn't stay stuck
    if (meetingId) {
      try {
        await supabase
          .from('meetings')
          .update({
            status: 'error',
            error_message: message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', meetingId)
      } catch (dbError) {
        console.error('Failed to update meeting error status:', dbError)
      }
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
