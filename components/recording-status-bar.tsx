'use client'

import { Monitor, Pause, Play, Square } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface RecordingStatusBarProps {
  isPaused: boolean
  isConnected: boolean
  hasSystemAudio: boolean
  durationLabel: string
  onTogglePause: () => void
  onStop: () => void
}

export function RecordingStatusBar({
  isPaused,
  isConnected,
  hasSystemAudio,
  durationLabel,
  onTogglePause,
  onStop,
}: RecordingStatusBarProps) {
  return (
    <section
      aria-label="Recording status"
      className="surface-status flex flex-col gap-4 rounded-[24px] border-border/70 bg-secondary/55 px-5 py-4 md:flex-row md:items-start md:justify-between"
    >
      <div className="min-w-0 flex-1">
        <div className="min-w-0 space-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex size-2 shrink-0 rounded-full',
                !isPaused ? 'bg-accent' : 'bg-muted-foreground/40'
              )}
            />
            <span className="text-sm font-semibold text-foreground">
              {isPaused ? 'Paused' : 'Recording now'}
            </span>
            <span className="sr-only">
              {isPaused ? 'Recording paused' : 'Recording in progress'}
            </span>
            <div
              aria-label={`Elapsed time ${durationLabel}`}
              className="surface-utility shrink-0 rounded-full px-3 py-1 font-mono text-xs tabular-nums text-foreground"
            >
              {durationLabel}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {isPaused
              ? 'Recording is paused. Resume when you are ready to continue.'
              : isConnected
                ? 'Your notes will update when you stop.'
                : 'Connecting your microphone and live transcript…'}
          </p>

          {hasSystemAudio ? (
            <Badge variant="secondary" className="rounded-full">
              <Monitor className="size-3" />
              System audio
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-full gap-2 shadow-none"
          onClick={onTogglePause}
        >
          {isPaused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
          {isPaused ? 'Resume' : 'Pause'}
        </Button>

        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="rounded-full gap-2"
          onClick={onStop}
        >
          <Square className="size-3.5" />
          Stop recording
        </Button>
      </div>
    </section>
  )
}
