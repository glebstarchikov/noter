import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

export const maxDuration = 60

const SYSTEM_PROMPT = `You are an expert meeting note-taker. Given a meeting transcript, produce structured notes in the following JSON format. Be concise but thorough.

{
  "title": "A short descriptive title for the meeting",
  "summary": "A 2-4 sentence executive summary of the meeting",
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

    const body = await request.json()
    meetingId = body.meetingId
    const transcript = body.transcript

    if (!meetingId || !transcript) {
      return NextResponse.json({ error: 'Missing meetingId or transcript' }, { status: 400 })
    }

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
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Here is the meeting transcript:\n\n${transcript}` },
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
      await supabase
        .from('meetings')
        .update({
          status: 'error',
          error_message: message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', meetingId)
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
