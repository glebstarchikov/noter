'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

export interface AudioRecorderState {
  isRecording: boolean
  isPaused: boolean
  duration: number
  audioBlob: Blob | null
}

export interface StartRecordingOptions {
  recordSystemAudio?: boolean
}

export function useAudioRecorder() {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioBlob: null,
  })

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const systemStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
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

  const startRecording = useCallback(async (options?: StartRecordingOptions) => {
    try {
      let finalStream: MediaStream

      // 1. Get Microphone Stream
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      micStreamRef.current = micStream

      // 2. Get System Stream if requested
      if (options?.recordSystemAudio) {
        try {
          const systemStream = await navigator.mediaDevices.getDisplayMedia({
            video: true, // Video is required to use getDisplayMedia
            audio: true,
          })
          systemStreamRef.current = systemStream

          // Check if user actually shared audio
          const systemAudioTracks = systemStream.getAudioTracks()
          if (systemAudioTracks.length === 0) {
            // Stop the stream right away if no audio track exists to avoid confusing "sharing" indicator
            systemStream.getTracks().forEach((track) => track.stop())
            systemStreamRef.current = null

            // Cleanup mic stream before throwing
            micStream.getTracks().forEach((track) => track.stop())
            throw new Error('You must check "Share system/tab audio" when selecting what to share.')
          }

          // 3. Mix streams via Web Audio API
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
          const audioContext = new AudioContextClass()
          audioContextRef.current = audioContext

          const micSource = audioContext.createMediaStreamSource(micStream)
          const systemSource = audioContext.createMediaStreamSource(systemStream)
          const destination = audioContext.createMediaStreamDestination()

          micSource.connect(destination)
          systemSource.connect(destination)

          finalStream = destination.stream

          // Stop recording when system stream ends (e.g. user clicks "Stop sharing" on the browser bar)
          systemStream.getVideoTracks()[0].onended = () => {
            stopRecording()
          }

        } catch (systemErr: any) {
          // If the user denied the screen share, we still need to cleanup the mic we gathered
          micStream.getTracks().forEach((track) => track.stop())
          if (systemErr.message?.includes('check "Share system/tab audio"')) {
            throw systemErr
          }
          throw new Error('System audio access denied or cancelled.')
        }
      } else {
        finalStream = micStream
      }

      // 4. Setup MediaRecorder
      const mediaRecorder = new MediaRecorder(finalStream, {
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

        // Cleanup all tracks and context
        micStreamRef.current?.getTracks().forEach((track) => track.stop())
        systemStreamRef.current?.getTracks().forEach((track) => track.stop())
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(console.error)
        }

        micStreamRef.current = null
        systemStreamRef.current = null
        audioContextRef.current = null
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(1000) // collect data every second
      setState({ isRecording: true, isPaused: false, duration: 0, audioBlob: null })
      startTimer()
    } catch (err: any) {
      throw new Error(err.message || 'Microphone access denied. Please allow microphone permissions.')
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
      if (audioContextRef.current && audioContextRef.current.state === 'running') {
        audioContextRef.current.suspend()
      }
      pausedDurationRef.current = durationRef.current
      stopTimer()
      setState((prev) => ({ ...prev, isPaused: true }))
    }
  }, [stopTimer])

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume()
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume()
      }
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

    // Cleanup all tracks and context
    micStreamRef.current?.getTracks().forEach((track) => track.stop())
    systemStreamRef.current?.getTracks().forEach((track) => track.stop())
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error)
    }

    micStreamRef.current = null
    systemStreamRef.current = null
    audioContextRef.current = null

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
      micStreamRef.current?.getTracks().forEach((track) => track.stop())
      systemStreamRef.current?.getTracks().forEach((track) => track.stop())
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error)
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
