import React from 'react'
import { describe, expect, it, mock } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { RecordingStatusBar } from '@/components/recording-status-bar'

describe('RecordingStatusBar', () => {
  it('renders the timer inline with the status text and exposes both controls', () => {
    const onTogglePause = mock(() => undefined)
    const onStop = mock(() => undefined)

    render(
      <RecordingStatusBar
        isPaused={false}
        isConnected={true}
        hasSystemAudio={true}
        durationLabel="01:24"
        onTogglePause={onTogglePause}
        onStop={onStop}
      />
    )

    expect(screen.getByText(/recording now/i)).not.toBeNull()
    expect(screen.getByLabelText(/elapsed time 01:24/i)).not.toBeNull()
    expect(screen.queryByText(/transcript live/i)).toBeNull()
    expect(screen.getByText(/your notes will update when you stop\./i)).not.toBeNull()
    expect(screen.getByText(/system audio/i)).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /pause/i }))
    fireEvent.click(screen.getByRole('button', { name: /stop recording/i }))

    expect(onTogglePause).toHaveBeenCalledTimes(1)
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('switches its copy when the session is paused and reconnecting', () => {
    render(
      <RecordingStatusBar
        isPaused={true}
        isConnected={false}
        hasSystemAudio={false}
        durationLabel="03:10"
        onTogglePause={() => undefined}
        onStop={() => undefined}
      />
    )

    expect(screen.getByText(/^paused$/i)).not.toBeNull()
    expect(
      screen.getByText(/recording is paused\. resume when you are ready to continue\./i)
    ).not.toBeNull()
    expect(screen.queryByText(/transcript live/i)).toBeNull()
    expect(screen.getByRole('button', { name: /resume/i })).not.toBeNull()
  })
})
