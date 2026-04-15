import { describe, test, expect } from 'bun:test'
import { renderHook, act } from '@testing-library/react'
import { useMediaStream } from '@/hooks/use-media-stream'

describe('useMediaStream', () => {
  test('initial state: no system audio, no analyser', () => {
    const { result } = renderHook(() => useMediaStream())
    expect(result.current.recordSystemAudio).toBe(false)
    expect(result.current.hasSystemAudio).toBe(false)
    expect(result.current.analyserNode).toBe(null)
  })

  test('setRecordSystemAudio toggles the flag', () => {
    const { result } = renderHook(() => useMediaStream())
    act(() => {
      result.current.setRecordSystemAudio(true)
    })
    expect(result.current.recordSystemAudio).toBe(true)
  })
})
