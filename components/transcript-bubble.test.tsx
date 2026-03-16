import React from 'react'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  AssistantShellProvider,
  MeetingAssistantBridge,
  type MeetingAssistantContextValue,
  useAssistantShellContext,
} from './assistant-shell-context'
import {
  ASSISTANT_COLLAPSED_HEIGHT,
  ASSISTANT_EXPANDED_MAX_WIDTH_REM,
  getAssistantExpandedHeightCss,
} from '@/lib/assistant-shell-layout'

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

function ModeControls() {
  const { setMode } = useAssistantShellContext()

  return (
    <div>
      <button type="button" onClick={() => setMode('chat')}>
        Show chat
      </button>
      <button type="button" onClick={() => setMode('transcript')}>
        Show transcript
      </button>
    </div>
  )
}

function renderMeetingShell(
  context: MeetingAssistantContextValue,
  { withModeControls = false }: { withModeControls?: boolean } = {}
) {
  return render(
    <AssistantShellProvider>
      <MeetingAssistantBridge context={context} />
      {withModeControls ? <ModeControls /> : null}
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

    const transcriptButton = screen.getByRole('button', { name: /open transcript/i })

    expect(transcriptButton.getAttribute('data-live')).toBe('false')
    expect(transcriptButton.getAttribute('data-open')).toBe('false')

    fireEvent.click(transcriptButton)

    expect(await screen.findByText('Transcript will appear here')).not.toBeNull()
    expect(
      screen.getByText(
        'Start recording to follow along live. If this meeting already has a transcript, it will show up here automatically.'
      )
    ).not.toBeNull()
    expect(transcriptButton.getAttribute('data-open')).toBe('true')
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

    expect(transcriptButton.getAttribute('data-live')).toBe('true')
    expect(transcriptButton.getAttribute('data-open')).toBe('false')
    expect(transcriptButton.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(transcriptButton)

    expect(await screen.findByText('Live')).not.toBeNull()
    expect(screen.getByText('Alex:')).not.toBeNull()
    expect(screen.getByText('We can ship on Friday.')).not.toBeNull()
    expect(transcriptButton.getAttribute('data-open')).toBe('true')
    expect(screen.getByRole('button', { name: /open live transcript/i }).getAttribute('aria-pressed')).toBe('true')
  })

  it('keeps the same expanded shell size when switching between transcript and chat', async () => {
    renderMeetingShell(
      {
        sourceId: 'meeting:meeting-3',
        meetingId: 'meeting-3',
        meetingTitle: 'Design review',
        transcriptAvailable: true,
        transcriptText: 'Alex: Notes are ready.',
        transcriptSegments: [
          {
            speaker: 'Alex',
            text: 'Notes are ready.',
            isFinal: true,
          },
        ],
        recordingPhase: 'done',
        live: false,
        isPaused: false,
        durationSeconds: 42,
      },
      { withModeControls: true }
    )

    fireEvent.click(screen.getByRole('button', { name: /open transcript/i }))

    const shell = screen
      .getByRole('region', { name: /chat with noter/i })
      .querySelector('[data-slot="chatbar-shell"]') as HTMLDivElement

    await waitFor(() => {
      expect(shell.getAttribute('data-mode')).toBe('transcript')
      expect(shell.style.maxHeight).toBe(getAssistantExpandedHeightCss(false))
      expect(shell.style.height).not.toBe(`${ASSISTANT_COLLAPSED_HEIGHT}px`)
    })

    expect(shell.parentElement?.style.maxWidth).toBe(
      `${ASSISTANT_EXPANDED_MAX_WIDTH_REM}rem`
    )

    const expandedHeight = shell.style.height

    fireEvent.click(screen.getByRole('button', { name: /show chat/i }))

    expect(await screen.findByLabelText('Ask about this note...')).not.toBeNull()

    await waitFor(() => {
      expect(shell.getAttribute('data-mode')).toBe('chat')
      expect(shell.style.height).toBe(expandedHeight)
      expect(shell.style.maxHeight).toBe(getAssistantExpandedHeightCss(false))
    })
  })
})
