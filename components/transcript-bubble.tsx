'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AlignLeft, FileText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useAssistantShellContextSafe } from '@/components/assistant-shell-context'
import { useAudioVisualizer } from '@/hooks/use-audio-visualizer'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/*  AudioBars — bouncy, organic bar visualization                     */
/* ------------------------------------------------------------------ */

function AudioBars({
  barHeights,
  accent = false,
  muted = false,
}: {
  barHeights: number[]
  accent?: boolean
  muted?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-[2px]',
        muted && 'opacity-60 transition-opacity duration-500',
      )}
      aria-hidden
    >
      {barHeights.map((h, i) => (
        <div
          key={i}
          className={cn(
            'w-[3.5px] rounded-full transition-[height] duration-[120ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]',
            accent
              ? 'bg-primary'
              : muted
                ? 'bg-muted-foreground/40'
                : 'bg-muted-foreground/70',
          )}
          style={{ height: `${Math.max(4, h * 20)}px` }}
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  CollapsedContent — icon / bars inside the pill                    */
/* ------------------------------------------------------------------ */

function CollapsedContent({
  isRecording,
  isStopped,
  barHeights,
  frozenBarHeights,
  transcriptAvailable,
}: {
  isRecording: boolean
  isStopped: boolean
  barHeights: number[]
  frozenBarHeights: number[] | null
  transcriptAvailable: boolean
}) {
  return (
    <div className="flex size-11 shrink-0 items-center justify-center">
      {isRecording ? (
        <AudioBars barHeights={barHeights} accent />
      ) : isStopped && frozenBarHeights ? (
        <AudioBars barHeights={frozenBarHeights} muted />
      ) : transcriptAvailable ? (
        <AlignLeft className="size-4 text-muted-foreground" />
      ) : (
        <FileText className="size-4 text-muted-foreground/50" />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  ExpandedContent — header + scrollable transcript                  */
/* ------------------------------------------------------------------ */

function ExpandedContent({
  isLive,
  transcriptSegments,
  transcriptText,
  transcriptEndRef,
  revealed,
  onClose,
}: {
  isLive: boolean
  transcriptSegments: { speaker: string; text: string; isFinal?: boolean }[]
  transcriptText: string
  transcriptEndRef: React.RefObject<HTMLDivElement | null>
  revealed: boolean
  onClose: () => void
}) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div
        className={cn(
          'flex shrink-0 items-center gap-2 px-4 pt-3 pb-1 transition-opacity duration-200',
          revealed ? 'opacity-100 delay-[120ms]' : 'opacity-0',
        )}
      >
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Transcript
        </span>
        {isLive && (
          <span className="flex items-center gap-1.5">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-red-500" />
            </span>
            <span className="text-[11px] font-medium text-red-500">Live</span>
          </span>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost-icon"
              size="icon-sm"
              onClick={onClose}
              aria-label="Close transcript"
              className="liquid-glass-control ml-auto rounded-full border border-border/40"
            >
              <X />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Close</TooltipContent>
        </Tooltip>
      </div>

      {/* Content */}
      <ScrollArea
        className={cn(
          'min-h-0 flex-1 transition-opacity duration-200',
          revealed ? 'opacity-100 delay-[180ms]' : 'opacity-0',
        )}
      >
        <div className="flex min-h-full flex-col gap-2 px-4 pb-4 pt-2">
          {transcriptSegments.length > 0 ? (
            <>
              {transcriptSegments.map((segment, i) => (
                <p
                  key={i}
                  className={cn(
                    'text-sm leading-7',
                    segment.isFinal === false && 'text-muted-foreground/60',
                  )}
                >
                  <span className="font-medium text-foreground">
                    {segment.speaker}:
                  </span>{' '}
                  {segment.text}
                </p>
              ))}
              <div ref={transcriptEndRef} />
            </>
          ) : transcriptText.trim() ? (
            <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">
              {transcriptText}
            </p>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Transcript will appear here once recording starts.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  TranscriptBubble — single morphing container                      */
/* ------------------------------------------------------------------ */

const COLLAPSED_SIZE = 44
const SPRING_EASE = 'cubic-bezier(0.16,1,0.3,1)'

export function TranscriptBubble() {
  const shellContext = useAssistantShellContextSafe()
  const isMobile = useIsMobile()
  const containerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  const mode = shellContext?.mode
  const setMode = shellContext?.setMode
  const ctx = shellContext?.meetingContext
  const isExpanded = mode === 'transcript'

  const isLive = ctx?.live ?? false
  const recordingPhase = ctx?.recordingPhase ?? 'done'
  const transcriptSegments = useMemo(
    () => ctx?.transcriptSegments ?? [],
    [ctx?.transcriptSegments],
  )
  const transcriptText = ctx?.transcriptText ?? ''
  const transcriptAvailable = ctx?.transcriptAvailable ?? false
  const analyserNode = ctx?.analyserNode ?? null
  const frozenBarHeights = ctx?.frozenBarHeights ?? null

  const barHeights = useAudioVisualizer(analyserNode)

  // Track whether the expand animation is in flight
  const [morphing, setMorphing] = useState(false)
  // Content reveal: true once container has started expanding
  const [revealed, setRevealed] = useState(false)
  // Explicit height for morph transition (null = auto)
  const [explicitHeight, setExplicitHeight] = useState<number | null>(null)

  const isRecording = recordingPhase === 'recording' && isLive
  const isStopped = recordingPhase === 'done' || recordingPhase === 'stopping'

  /* ---- Expand / collapse handlers ---- */

  const handleOpen = useCallback(() => {
    setMode?.('transcript')
  }, [setMode])

  const handleClose = useCallback(() => {
    // Snapshot current height for collapse animation
    if (containerRef.current) {
      setExplicitHeight(containerRef.current.offsetHeight)
    }
    setRevealed(false)
    setMorphing(true)

    // Next frame: set collapsed size to trigger CSS transition
    requestAnimationFrame(() => {
      setExplicitHeight(COLLAPSED_SIZE)
      // After transition, switch to collapsed mode
      setTimeout(() => {
        setMode?.('collapsed')
        setMorphing(false)
        setExplicitHeight(null)
      }, 250)
    })
  }, [setMode])

  /* ---- Measure expanded height for morph ---- */

  useLayoutEffect(() => {
    if (!isExpanded || morphing) return

    const el = containerRef.current
    if (!el) return

    // Measure the natural expanded height
    const targetHeight = Math.min(
      el.scrollHeight,
      window.innerHeight * 0.7,
      isMobile ? 448 : 512, // 28rem mobile, 32rem desktop
    )

    setExplicitHeight(targetHeight)
    setMorphing(true)

    // Start content reveal after a short delay
    const revealTimer = setTimeout(() => setRevealed(true), 50)

    // After morph completes, switch to auto height
    const autoTimer = setTimeout(() => {
      setExplicitHeight(null)
      setMorphing(false)
    }, 320)

    return () => {
      clearTimeout(revealTimer)
      clearTimeout(autoTimer)
    }
  }, [isExpanded, isMobile]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- Auto-scroll live transcript ---- */

  useEffect(() => {
    if (isExpanded && isLive) {
      transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [transcriptSegments, isExpanded, isLive])

  // Don't render on non-meeting pages
  if (!ctx) return null

  /* ---- Compute container styles ---- */

  const heightStyle =
    explicitHeight != null
      ? { height: `${explicitHeight}px` }
      : isExpanded
        ? { maxHeight: isMobile ? 'min(60vh, 28rem)' : 'min(70vh, 32rem)' }
        : { height: `${COLLAPSED_SIZE}px` }

  const widthStyle =
    isExpanded || morphing
      ? { width: '100%' }
      : { width: `${COLLAPSED_SIZE}px` }

  return (
    <div className="relative shrink-0" style={!isExpanded && !morphing ? { width: COLLAPSED_SIZE, height: COLLAPSED_SIZE } : undefined}>
      {/* Recording pulse ring */}
      {isRecording && !isExpanded && !morphing && (
        <span
          className="absolute inset-0 rounded-full border-[1.5px] border-red-400/40"
          style={{ animation: `recording-ring-pulse 2s ${SPRING_EASE} infinite` }}
          aria-hidden
        />
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <div
            ref={containerRef}
            role="button"
            tabIndex={isExpanded ? -1 : 0}
            onClick={!isExpanded ? handleOpen : undefined}
            onKeyDown={
              !isExpanded
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleOpen()
                    }
                  }
                : undefined
            }
            data-slot="transcript-bubble"
            data-state={isExpanded ? 'expanded' : 'collapsed'}
            className={cn(
              'pointer-events-auto overflow-hidden',
              'transition-[width,height,border-radius,box-shadow,border-color]',
              'ease-[cubic-bezier(0.16,1,0.3,1)]',
              isExpanded || morphing
                ? 'liquid-glass-shell max-w-[44rem] rounded-[30px] duration-300'
                : 'liquid-glass-dock rounded-full duration-300 hover:scale-105 active:scale-95',
            )}
            style={{ ...heightStyle, ...widthStyle }}
            aria-label={isExpanded ? 'Transcript panel' : 'Open transcript'}
            aria-expanded={isExpanded}
          >
            <div ref={innerRef}>
              {isExpanded || morphing ? (
                <ExpandedContent
                  isLive={isLive}
                  transcriptSegments={transcriptSegments}
                  transcriptText={transcriptText}
                  transcriptEndRef={transcriptEndRef}
                  revealed={revealed}
                  onClose={handleClose}
                />
              ) : (
                <CollapsedContent
                  isRecording={isRecording}
                  isStopped={isStopped}
                  barHeights={barHeights}
                  frozenBarHeights={frozenBarHeights}
                  transcriptAvailable={transcriptAvailable}
                />
              )}
            </div>
          </div>
        </TooltipTrigger>
        {!isExpanded && !morphing && (
          <TooltipContent side="top">
            {isRecording ? 'Live transcript' : 'Transcript'}
          </TooltipContent>
        )}
      </Tooltip>
    </div>
  )
}
