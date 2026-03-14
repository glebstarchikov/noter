'use client'

import { useEffect, useRef, useState } from 'react'

function reduceToBars(data: Uint8Array, barCount: number): number[] {
  const sampleCount = data.length
  const samplesPerBar = Math.max(1, Math.floor(sampleCount / barCount))
  const bars: number[] = []

  for (let i = 0; i < barCount; i++) {
    let peak = 0
    let sumSquares = 0

    for (let j = 0; j < samplesPerBar; j++) {
      const sampleIndex = Math.min(sampleCount - 1, i * samplesPerBar + j)
      const centeredSample = (data[sampleIndex] - 128) / 128
      const magnitude = Math.abs(centeredSample)

      peak = Math.max(peak, magnitude)
      sumSquares += centeredSample * centeredSample
    }

    const rms = Math.sqrt(sumSquares / samplesPerBar)
    bars.push(Math.min(1, peak * 0.65 + rms * 2.4))
  }

  return bars
}

export { reduceToBars }

export function useAudioVisualizer(
  analyserNode: AnalyserNode | null | undefined,
  barCount = 6,
): number[] {
  const [barHeights, setBarHeights] = useState<number[]>(() =>
    Array.from({ length: barCount }, () => 0),
  )
  const rafRef = useRef<number>(0)
  const dataRef = useRef<Uint8Array | null>(null)
  const frameRef = useRef(0)
  const smoothedBarsRef = useRef<number[]>(Array.from({ length: barCount }, () => 0))

  useEffect(() => {
    if (!analyserNode) {
      setBarHeights(Array.from({ length: barCount }, () => 0))
      frameRef.current = 0
      smoothedBarsRef.current = Array.from({ length: barCount }, () => 0)
      return
    }

    dataRef.current = new Uint8Array(analyserNode.fftSize)
    smoothedBarsRef.current = Array.from({ length: barCount }, () => 0)

    function tick() {
      if (!analyserNode || !dataRef.current) return

      analyserNode.getByteTimeDomainData(dataRef.current)
      const rawBars = reduceToBars(dataRef.current, barCount)
      const t = frameRef.current++

      const maxVal = Math.max(...rawBars)
      const nextBars = rawBars.map((bar, index) => {
        const target = maxVal < 0.025
          ? 0.08 + 0.045 * (0.5 + 0.5 * Math.sin(t * 0.08 + index * 0.9))
          : Math.max(0.06, bar)
        const previous = smoothedBarsRef.current[index] ?? 0
        const smoothing = target > previous ? 0.36 : 0.18

        return previous + (target - previous) * smoothing
      })

      smoothedBarsRef.current = nextBars
      setBarHeights(nextBars)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [analyserNode, barCount])

  return barHeights
}
