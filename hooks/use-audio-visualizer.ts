'use client'

import { useEffect, useRef, useState } from 'react'

function reduceToBars(data: Uint8Array, barCount: number): number[] {
  const binCount = data.length
  const binsPerBar = Math.floor(binCount / barCount)
  const bars: number[] = []

  for (let i = 0; i < barCount; i++) {
    let sum = 0
    for (let j = 0; j < binsPerBar; j++) {
      sum += data[i * binsPerBar + j]
    }
    bars.push(sum / (binsPerBar * 255))
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

  useEffect(() => {
    if (!analyserNode) {
      setBarHeights(Array.from({ length: barCount }, () => 0))
      frameRef.current = 0
      return
    }

    dataRef.current = new Uint8Array(analyserNode.frequencyBinCount)

    function tick() {
      if (!analyserNode || !dataRef.current) return

      analyserNode.getByteFrequencyData(dataRef.current)
      const bars = reduceToBars(dataRef.current, barCount)
      const t = frameRef.current++

      const maxVal = Math.max(...bars)

      if (maxVal < 0.05) {
        // Idle breathing — gentle sine wave when mic is live but silent
        for (let i = 0; i < bars.length; i++) {
          bars[i] = 0.1 + 0.08 * Math.sin(t * 0.06 + i * 0.9)
        }
      } else {
        // Organic stagger — per-bar phase offset so bars don't move in lockstep
        for (let i = 0; i < bars.length; i++) {
          bars[i] *= 0.85 + 0.15 * Math.sin(i * 1.8 + t * 0.04)
        }
      }

      setBarHeights(bars)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [analyserNode, barCount])

  return barHeights
}
