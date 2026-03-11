import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

let pathname = '/dashboard'
const sendMessageMock = mock(() => Promise.resolve())
const setMessagesMock = mock(() => {})
let mockMessages: Array<Record<string, unknown>> = []

mock.module('next/navigation', () => ({
  usePathname: () => pathname,
}))

mock.module('@ai-sdk/react', () => ({
  useChat: () => ({
    messages: mockMessages,
    sendMessage: sendMessageMock,
    setMessages: setMessagesMock,
    status: 'ready',
    error: null,
  }),
}))

const {
  AssistantShellProvider,
  MeetingAssistantBridge,
} = await import('./assistant-shell-context')
const { AssistantShell } = await import('./assistant-shell')

describe('AssistantShell', () => {
  beforeEach(() => {
    pathname = '/dashboard'
    mockMessages = []
    sendMessageMock.mockClear()
    setMessagesMock.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders an assistant-only collapsed dock on non-meeting pages', () => {
    render(
      <AssistantShellProvider>
        <AssistantShell />
      </AssistantShellProvider>
    )

    expect(screen.getByRole('button', { name: /open assistant/i })).not.toBeNull()
    expect(screen.queryByRole('button', { name: /open transcript/i })).toBeNull()
  })

  it('renders the transcript affordance only when meeting transcript context exists', async () => {
    pathname = '/dashboard/meeting-1'

    render(
      <AssistantShellProvider>
        <MeetingAssistantBridge
          context={{
            sourceId: 'meeting:meeting-1',
            meetingId: 'meeting-1',
            meetingTitle: 'Weekly sync',
            transcriptAvailable: true,
            transcriptText: 'Alice: hello',
            transcriptSegments: [{ speaker: 'Alice', text: 'hello' }],
            recordingPhase: 'done',
            live: false,
            isPaused: false,
            durationSeconds: 62,
          }}
        />
        <AssistantShell />
      </AssistantShellProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open transcript/i })).not.toBeNull()
    })

    fireEvent.click(screen.getByRole('button', { name: /open transcript/i }))

    await waitFor(() => {
      expect(screen.getByText('Weekly sync')).not.toBeNull()
      expect(screen.getByText('Transcript')).not.toBeNull()
    })
  })

  it('opens slash suggestions in chat mode and sends the selected prompt immediately', async () => {
    render(
      <AssistantShellProvider>
        <AssistantShell />
      </AssistantShellProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /open assistant/i }))

    const composer = await screen.findByLabelText(/ask noter/i)
    fireEvent.focus(composer)
    fireEvent.change(composer, { target: { value: '/' } })

    await waitFor(() => {
      expect(screen.getByText('Suggestions')).not.toBeNull()
      expect(screen.getAllByRole('button', { name: /list my todos/i }).length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getAllByRole('button', { name: /list my todos/i })[0])

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalled()
    })

    const firstCall = sendMessageMock.mock.calls[0] as unknown as
      | [Record<string, unknown>]
      | undefined
    expect(firstCall?.[0]).toMatchObject({
      text: 'List my todos',
    })
  })

  it('shows meeting-specific prompts instead of global prompts on meeting pages', async () => {
    pathname = '/dashboard/meeting-2'

    render(
      <AssistantShellProvider>
        <MeetingAssistantBridge
          context={{
            sourceId: 'meeting:meeting-2',
            meetingId: 'meeting-2',
            meetingTitle: 'Customer call',
            transcriptAvailable: true,
            transcriptText: 'Host: quick recap',
            transcriptSegments: [{ speaker: 'Host', text: 'quick recap' }],
            recordingPhase: 'done',
            live: false,
            isPaused: false,
            durationSeconds: 45,
          }}
        />
        <AssistantShell />
      </AssistantShellProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /open assistant/i }))

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: /write follow up email/i }).length
      ).toBeGreaterThan(0)
    })

    expect(screen.queryAllByRole('button', { name: /list my todos/i })).toHaveLength(0)
    expect(
      screen.getAllByRole('button', { name: /list action items/i }).length
    ).toBeGreaterThan(0)
  })

  it('invokes transcript mode recording controls from the same shell', async () => {
    pathname = '/dashboard/meeting-3'
    const togglePauseMock = mock(() => {})
    const stopMock = mock(() => {})

    render(
      <AssistantShellProvider>
        <MeetingAssistantBridge
          context={{
            sourceId: 'meeting:meeting-3',
            meetingId: 'meeting-3',
            meetingTitle: 'Planning',
            transcriptAvailable: true,
            transcriptText: 'Alice: discussing scope',
            transcriptSegments: [{ speaker: 'Alice', text: 'discussing scope' }],
            recordingPhase: 'recording',
            live: true,
            isPaused: false,
            durationSeconds: 128,
            onTogglePause: togglePauseMock,
            onStop: stopMock,
          }}
        />
        <AssistantShell />
      </AssistantShellProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /open transcript/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pause/i })).not.toBeNull()
      expect(screen.getByRole('button', { name: /stop/i })).not.toBeNull()
    })

    fireEvent.click(screen.getByRole('button', { name: /pause/i }))
    fireEvent.click(screen.getByRole('button', { name: /stop/i }))

    expect(togglePauseMock).toHaveBeenCalledTimes(1)
    expect(stopMock).toHaveBeenCalledTimes(1)
  })

  it('collapses back to the dock when the route changes', async () => {
    const { rerender } = render(
      <AssistantShellProvider>
        <AssistantShell />
      </AssistantShellProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /open assistant/i }))
    expect(await screen.findByLabelText(/ask noter/i)).not.toBeNull()

    pathname = '/dashboard/templates'
    rerender(
      <AssistantShellProvider>
        <AssistantShell />
      </AssistantShellProvider>
    )

    await waitFor(() => {
      expect(screen.queryByLabelText(/ask noter/i)).toBeNull()
      expect(screen.getByRole('button', { name: /open assistant/i })).not.toBeNull()
    })
  })
})
