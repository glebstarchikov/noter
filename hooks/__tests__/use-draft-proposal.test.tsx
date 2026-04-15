import { describe, test, expect } from 'bun:test'
import { renderHook } from '@testing-library/react'
import { useDraftProposal } from '@/hooks/use-draft-proposal'
import type { Meeting } from '@/lib/types'

const fakeMeeting = {
  id: 'test-id',
  user_id: 'user-1',
  title: 'Test',
  status: 'done',
  enhancement_state: null,
  audio_url: null,
  audio_duration: null,
  transcript: null,
  summary: null,
  action_items: [],
  key_decisions: [],
  topics: [],
  follow_ups: [],
  detailed_notes: null,
  error_message: null,
  is_pinned: false,
  document_content: null,
  template_id: null,
  diarized_transcript: null,
  enhancement_status: 'idle',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
} as Meeting

describe('useDraftProposal', () => {
  test('initial state is idle with null review state', () => {
    const { result } = renderHook(() =>
      useDraftProposal(fakeMeeting, {
        currentDocument: { type: 'doc', content: [] },
        currentHash: 'hash-0',
        actionMode: 'generate',
        canReview: false,
        meetingStatus: 'done',
        hasDocumentConflict: false,
        persistDocument: async () => {},
        waitForEditor: async () => null,
      }),
    )
    expect(result.current.draftState).toBe('idle')
    expect(result.current.wasEverEnhanced).toBe(false)
  })
})
