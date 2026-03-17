import { describe, expect, it } from 'bun:test'
import {
  reduceFrequencyToBars,
  smoothBarHeights,
} from './use-audio-visualizer'

describe('reduceFrequencyToBars', () => {
  it('returns empty energy for silence', () => {
    const bars = reduceFrequencyToBars(new Uint8Array(128), 6)

    expect(bars).toHaveLength(6)
    expect(bars.every((bar) => bar === 0)).toBe(true)
  })

  it('pushes stronger frequency energy into later bars', () => {
    const data = new Uint8Array(128)
    data.fill(255, 64)

    const bars = reduceFrequencyToBars(data, 6)

    expect(bars).toHaveLength(6)
    expect(Math.max(...bars)).toBeGreaterThan(0.5)
    expect(bars.at(-1) ?? 0).toBeGreaterThan(bars[0] ?? 0)
  })
})

describe('smoothBarHeights', () => {
  it('decays quiet input toward a baseline instead of inventing new pulses', () => {
    const previousBars = [0.62, 0.48, 0.41, 0.33, 0.27, 0.2]
    const nextBars = smoothBarHeights(previousBars, Array(6).fill(0))

    nextBars.forEach((bar, index) => {
      expect(bar).toBeLessThan(previousBars[index] ?? 1)
      expect(bar).toBeGreaterThan(0.03)
    })
  })

  it('rises faster on spikes than it falls after them', () => {
    const baselineBars = Array(6).fill(0.035)
    const spikingBars = smoothBarHeights(baselineBars, Array(6).fill(0.9))
    const fallingBars = smoothBarHeights(spikingBars, Array(6).fill(0))

    const riseDelta = (spikingBars[0] ?? 0) - (baselineBars[0] ?? 0)
    const fallDelta = (spikingBars[0] ?? 0) - (fallingBars[0] ?? 0)

    expect(riseDelta).toBeGreaterThan(fallDelta)
    expect(fallingBars[0] ?? 0).toBeLessThan(spikingBars[0] ?? 1)
    expect(fallingBars[0] ?? 0).toBeGreaterThan(0.03)
  })
})
