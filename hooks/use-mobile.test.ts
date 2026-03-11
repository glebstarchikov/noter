import { describe, it, expect } from 'bun:test'
import { renderHook, act } from '@testing-library/react'
import { useIsMobile } from './use-mobile'

describe('useIsMobile', () => {
  it('returns false when window width is >= 768', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })

    const listeners: Array<() => void> = []
    Object.defineProperty(window, 'matchMedia', {
      value: () => ({
        addEventListener: (_: string, fn: () => void) => { listeners.push(fn) },
        removeEventListener: () => {},
      }),
      writable: true,
    })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('returns true when window width is < 768', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true })

    Object.defineProperty(window, 'matchMedia', {
      value: () => ({
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
      writable: true,
    })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('updates when media query changes', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })

    let changeHandler: (() => void) | null = null
    Object.defineProperty(window, 'matchMedia', {
      value: () => ({
        addEventListener: (_: string, fn: () => void) => { changeHandler = fn },
        removeEventListener: () => {},
      }),
      writable: true,
    })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)

    // Simulate resize to mobile
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true })
    act(() => {
      changeHandler?.()
    })
    expect(result.current).toBe(true)
  })
})
