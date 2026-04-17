'use client'

import { useState, useRef, useCallback } from 'react'

export interface AcquiredMediaStream {
  finalStream: MediaStream
  analyser: AnalyserNode
}

export interface UseMediaStreamReturn {
  recordSystemAudio: boolean
  hasSystemAudio: boolean
  setRecordSystemAudio: (value: boolean) => void
  analyserNode: AnalyserNode | null
  acquireStream: () => Promise<AcquiredMediaStream>
  stopAllStreams: () => void
  closeAudioSession: () => void
  suspendAudioContext: () => void
  resumeAudioContext: () => void
}

export function useMediaStream(): UseMediaStreamReturn {
  const [recordSystemAudio, setRecordSystemAudio] = useState(false)
  const [hasSystemAudio, setHasSystemAudio] = useState(false)
  const [analyserReady, setAnalyserReady] = useState(false)

  const streamRef = useRef<MediaStream | null>(null)
  const sourceStreamsRef = useRef<MediaStream[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)

  const stopAllStreams = useCallback(() => {
    const seenTracks = new Set<MediaStreamTrack>()

    for (const stream of [streamRef.current, ...sourceStreamsRef.current]) {
      if (!stream) continue

      for (const track of stream.getTracks()) {
        if (seenTracks.has(track)) continue
        seenTracks.add(track)
        track.stop()
      }
    }

    streamRef.current = null
    sourceStreamsRef.current = []
  }, [])

  const closeAudioSession = useCallback(() => {
    analyserRef.current = null
    setAnalyserReady(false)

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close()
    }

    audioContextRef.current = null
  }, [])

  const suspendAudioContext = useCallback(() => {
    void audioContextRef.current?.suspend()
  }, [])

  const resumeAudioContext = useCallback(() => {
    void audioContextRef.current?.resume()
  }, [])

  const acquireStream = useCallback(async (): Promise<AcquiredMediaStream> => {
    setHasSystemAudio(false)

    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    let systemStream: MediaStream | null = null

    if (recordSystemAudio) {
      try {
        systemStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        })
        const systemAudioTracks = systemStream.getAudioTracks()
        if (systemAudioTracks.length === 0) {
          systemStream.getTracks().forEach((track) => track.stop())
          micStream.getTracks().forEach((track) => track.stop())
          throw new Error('Check "Share system/tab audio" when selecting what to share.')
        }

        systemStream.getVideoTracks()[0]?.stop()
      } catch (error) {
        systemStream?.getTracks().forEach((track) => track.stop())
        micStream.getTracks().forEach((track) => track.stop())
        throw error
      }
    }

    const audioContext = new AudioContext()
    audioContextRef.current = audioContext

    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.6

    const silentMonitor = audioContext.createGain()
    silentMonitor.gain.value = 0
    analyser.connect(silentMonitor)
    silentMonitor.connect(audioContext.destination)

    let finalStream: MediaStream

    if (systemStream) {
      const micSource = audioContext.createMediaStreamSource(micStream)
      const systemSource = audioContext.createMediaStreamSource(systemStream)
      const destination = audioContext.createMediaStreamDestination()

      micSource.connect(destination)
      systemSource.connect(destination)
      micSource.connect(analyser)
      systemSource.connect(analyser)

      finalStream = destination.stream
      setHasSystemAudio(true)
    } else {
      const micSource = audioContext.createMediaStreamSource(micStream)
      micSource.connect(analyser)
      finalStream = micStream
    }

    sourceStreamsRef.current = systemStream ? [micStream, systemStream] : [micStream]
    analyserRef.current = analyser
    setAnalyserReady(true)
    streamRef.current = finalStream

    return { finalStream, analyser }
  }, [recordSystemAudio])

  return {
    recordSystemAudio,
    hasSystemAudio,
    setRecordSystemAudio,
    analyserNode: analyserReady ? analyserRef.current : null,
    acquireStream,
    stopAllStreams,
    closeAudioSession,
    suspendAudioContext,
    resumeAudioContext,
  }
}
