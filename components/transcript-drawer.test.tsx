import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

mock.module('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))

const { TranscriptDrawer } = await import('./transcript-drawer')

describe('TranscriptDrawer', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    cleanup()
  })

  it('shows the transcript handle before transcript content exists and reveals empty copy when opened', () => {
    render(
      <TranscriptDrawer
        alwaysVisible
        emptyMessage="Transcript will appear here once recording starts."
      />
    )

    const handle = screen.getByRole('button', { name: /transcript/i })
    fireEvent.click(handle)

    expect(handle).not.toBeNull()
    expect(screen.getByText('Transcript will appear here once recording starts.')).not.toBeNull()
  })
})
