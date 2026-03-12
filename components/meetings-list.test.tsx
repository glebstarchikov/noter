import { afterEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import type { Meeting } from '@/lib/types'

mock.module('next/navigation', () => ({
  useRouter: () => ({
    refresh: () => undefined,
  }),
  usePathname: () => '/dashboard',
}))

const { MeetingsList } = await import('./meetings-list')

describe('MeetingsList', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows calmer empty-state copy when no meetings exist', () => {
    render(<MeetingsList meetings={[]} />)

    expect(screen.getByText('Capture your first meeting')).not.toBeNull()
    expect(screen.getByRole('link', { name: /start a meeting/i })).not.toBeNull()
  })

  it('keeps the pin action visible and labels the controls clearly', () => {
    const meeting: Meeting = {
      id: 'meeting-1',
      user_id: 'user-1',
      title: 'Weekly sync',
      status: 'done',
      created_at: '2026-03-10T08:00:00.000Z',
      updated_at: '2026-03-10T08:00:00.000Z',
      audio_duration: 180,
      error_message: null,
      summary: 'Weekly summary',
      topics: ['Roadmap'],
      is_pinned: false,
      transcript: null,
      detailed_notes: '',
      action_items: [],
      key_decisions: [],
      follow_ups: [],
      audio_url: null,
      document_content: null,
      template_id: null,
      diarized_transcript: null,
      enhancement_status: 'idle',
      enhancement_state: null,
    }

    render(
      <MeetingsList meetings={[meeting]} />
    )

    expect(screen.getByRole('button', { name: /sort & filter/i })).not.toBeNull()
    expect(screen.getByRole('button', { name: /pin note/i })).not.toBeNull()
  })
})
