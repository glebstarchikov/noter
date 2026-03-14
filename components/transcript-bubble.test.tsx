import React from 'react'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AssistantShellProvider, MeetingAssistantBridge, type MeetingAssistantContextValue } from './assistant-shell-context'

mock.module('@ai-sdk/react', () => ({
  useChat: () => ({
    messages: [],
    status: 'ready',
    error: undefined,
    setMessages() {},
    sendMessage: async () => {},
  }),
}))

mock.module('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))

mock.module('@/hooks/use-audio-visualizer', () => ({
  useAudioVisualizer: () => [0.12, 0.15, 0.1, 0.14, 0.11, 0.13],
}))

const { ChatBar } = await import('./chat-bar')
const { TranscriptBubble } = await import('./transcript-bubble')

function renderMeetingShell(context: MeetingAssistantContextValue) {
  return render(
    <AssistantShellProvider>
      <MeetingAssistantBridge context={context} />
      <ChatBar
        authenticated
        defaultScope="meeting"
        meetingId={context.meetingId}
        reserveInFlow={false}
        transcriptBubble={<TranscriptBubble />}
      />
    </AssistantShellProvider>
  )
}

describe('TranscriptBubble', () => {
  beforeEach(() => {
    window.requestAnimationFrame = ((callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 0)) as typeof window.requestAnimationFrame
    window.cancelAnimationFrame = ((id: number) => window.clearTimeout(id)) as typeof window.cancelAnimationFrame
  })

  afterEach(() => {
    cleanup()
  })

  it('stays visible before recording starts and opens an intentional empty transcript state', async () => {
    renderMeetingShell({
      sourceId: 'meeting:meeting-1',
      meetingId: 'meeting-1',
      meetingTitle: 'Planning',
      transcriptAvailable: false,
      transcriptText: '',
      transcriptSegments: [],
      recordingPhase: 'setup',
      live: false,
      isPaused: false,
      durationSeconds: 0,
    })

    fireEvent.click(screen.getByRole('button', { name: /open transcript/i }))

    expect(await screen.findByText('Transcript will appear here')).not.toBeNull()
    expect(
      screen.getByText(
        'Start recording to follow along live. If this meeting already has a transcript, it will show up here automatically.'
      )
    ).not.toBeNull()
  })

  it('switches to transcript mode and exposes the live state while recording', async () => {
    renderMeetingShell({
      sourceId: 'meeting:meeting-2',
      meetingId: 'meeting-2',
      meetingTitle: 'Weekly sync',
      transcriptAvailable: true,
      transcriptText: '',
      transcriptSegments: [
        {
          speaker: 'Alex',
          text: 'We can ship on Friday.',
          isFinal: false,
        },
      ],
      recordingPhase: 'recording',
      live: true,
      isPaused: false,
      durationSeconds: 12,
    })

    const transcriptButton = screen.getByRole('button', { name: /open live transcript/i })

    expect(transcriptButton.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(transcriptButton)

    expect(await screen.findByText('Live')).not.toBeNull()
    expect(screen.getByText('Alex:')).not.toBeNull()
    expect(screen.getByText('We can ship on Friday.')).not.toBeNull()
    expect(screen.getByRole('button', { name: /open live transcript/i }).getAttribute('aria-pressed')).toBe('true')
  })
})
