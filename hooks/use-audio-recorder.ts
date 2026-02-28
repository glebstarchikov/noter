'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

export interface AudioRecorderState {
  isRecording: boolean
  isPaused: boolean
  duration: number
  audioBlob: Blob | null
}

export function useAudioRecorder() {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioBlob: null,
  })

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)
  const pausedDurationRef = useRef<number>(0)
  const durationRef = useRef<number>(0)

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now() - pausedDurationRef.current * 1000
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      durationRef.current = elapsed
      setState((prev) => ({ ...prev, duration: elapsed }))
    }, 200)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      })

      chunksRef.current = []
      pausedDurationRef.current = 0
      durationRef.current = 0

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setState((prev) => ({ ...prev, audioBlob: blob, isRecording: false, isPaused: false }))
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(1000) // collect data every second
      setState({ isRecording: true, isPaused: false, duration: 0, audioBlob: null })
      startTimer()
    } catch {
      throw new Error('Microphone access denied. Please allow microphone permissions.')
    }
  }, [startTimer])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      stopTimer()
    }
  }, [stopTimer])

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause()
      pausedDurationRef.current = durationRef.current
      stopTimer()
      setState((prev) => ({ ...prev, isPaused: true }))
    }
  }, [stopTimer])

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume()
      startTimer()
      setState((prev) => ({ ...prev, isPaused: false }))
    }
  }, [startTimer])

  const resetRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null // Prevent saving the blob
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    stopTimer()
    chunksRef.current = []
    pausedDurationRef.current = 0
    durationRef.current = 0
    setState({ isRecording: false, isPaused: false, duration: 0, audioBlob: null })
  }, [stopTimer])

  // Cleanup on unmount: stop timer and release microphone
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }, [])

  return {
    ...state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
  }
}
