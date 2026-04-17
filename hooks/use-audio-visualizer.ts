'use client'

import { useEffect, useRef, useState } from 'react'

const FRAME_INTERVAL_MS = 1000 / 30
const NOISE_FLOOR = 0.045
const BASELINE_HEIGHT = 0.035
const ATTACK_SMOOTHING = 0.38
const RELEASE_SMOOTHING = 0.20

function getBucketRange(index: number, barCount: number, sampleCount: number) {
  const start = Math.floor(Math.pow(index / barCount, 1.7) * sampleCount)
  const end = Math.floor(Math.pow((index + 1) / barCount, 1.7) * sampleCount)

  return {
    start,
    end: Math.max(start + 1, end),
  }
}

export function reduceFrequencyToBars(
  data: Uint8Array,
  barCount: number,
  maxBins?: number,
): number[] {
  const sampleCount = maxBins ? Math.min(maxBins, data.length) : data.length
  const bars: number[] = []

  for (let i = 0; i < barCount; i += 1) {
    const { start, end } = getBucketRange(i, barCount, sampleCount)
    let peak = 0
    let sum = 0
    let samples = 0

    for (let j = start; j < end; j += 1) {
      const normalized = data[Math.min(sampleCount - 1, j)] / 255
      peak = Math.max(peak, normalized)
      sum += normalized
      samples += 1
    }

    const average = samples > 0 ? sum / samples : 0
    bars.push(Math.min(1, average * 0.6 + peak * 0.4))
  }

  return bars
}

export function smoothBarHeights(
  previousBars: number[],
  rawBars: number[],
): number[] {
  return rawBars.map((bar, index) => {
    const target = bar < NOISE_FLOOR ? BASELINE_HEIGHT : Math.max(BASELINE_HEIGHT, bar)
    const previous = previousBars[index] ?? BASELINE_HEIGHT
    const smoothing = target > previous ? ATTACK_SMOOTHING : RELEASE_SMOOTHING

    return previous + (target - previous) * smoothing
  })
}

export function useAudioVisualizer(
  analyserNode: AnalyserNode | null | undefined,
  barCount = 4,
  maxBinRatio = 1.0,
): number[] {
  const [barHeights, setBarHeights] = useState<number[]>(() =>
    Array.from({ length: barCount }, () => 0),
  )
  const rafRef = useRef<number>(0)
  const dataRef = useRef<Uint8Array | null>(null)
  const smoothedBarsRef = useRef<number[]>(
    Array.from({ length: barCount }, () => BASELINE_HEIGHT),
  )
  const lastFrameTimeRef = useRef(0)

  useEffect(() => {
    if (!analyserNode) {
      setBarHeights(Array.from({ length: barCount }, () => 0))
      smoothedBarsRef.current = Array.from({ length: barCount }, () => BASELINE_HEIGHT)
      lastFrameTimeRef.current = 0
      return
    }

    dataRef.current = new Uint8Array(analyserNode.frequencyBinCount)
    smoothedBarsRef.current = Array.from({ length: barCount }, () => BASELINE_HEIGHT)
    lastFrameTimeRef.current = 0

    function tick(now: number) {
      if (!analyserNode || !dataRef.current) return

      if (now - lastFrameTimeRef.current >= FRAME_INTERVAL_MS) {
        analyserNode.getByteFrequencyData(dataRef.current)
        const maxBins = maxBinRatio < 1.0
          ? Math.floor(dataRef.current.length * maxBinRatio)
          : undefined
        const rawBars = reduceFrequencyToBars(dataRef.current, barCount, maxBins)
        const nextBars = smoothBarHeights(smoothedBarsRef.current, rawBars)

        smoothedBarsRef.current = nextBars
        setBarHeights(nextBars)
        lastFrameTimeRef.current = now
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [analyserNode, barCount, maxBinRatio])

  return barHeights
}
