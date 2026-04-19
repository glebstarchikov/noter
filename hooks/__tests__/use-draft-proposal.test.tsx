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

  test('wasEverEnhanced is derived from server state — persists across mount', () => {
    // Meeting has a prior AI review (lastReviewedSourceHash) from the server.
    // On a fresh mount, wasEverEnhanced must be true without the user having
    // to click anything — otherwise the regen-prompt indicator disappears on
    // page reload even when the server knows AI ran before.
    const enhancedMeeting = {
      ...fakeMeeting,
      enhancement_state: {
        lastReviewedSourceHash: 'hash-server-reviewed',
        lastOutcome: 'accepted' as const,
        lastReviewedAt: '2026-04-19T10:00:00Z',
        lastError: null,
      },
    } as Meeting

    const { result } = renderHook(() =>
      useDraftProposal(enhancedMeeting, {
        currentDocument: { type: 'doc', content: [] },
        currentHash: 'hash-0',
        actionMode: 'enhance',
        canReview: true,
        meetingStatus: 'done',
        hasDocumentConflict: false,
        persistDocument: async () => {},
        waitForEditor: async () => null,
      }),
    )

    expect(result.current.wasEverEnhanced).toBe(true)
  })
})
