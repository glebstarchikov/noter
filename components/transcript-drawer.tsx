'use client'

import { useState } from 'react'
import { AlignLeft, Dot } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

interface LiveSegmentLike {
  speaker: string
  text: string
  isFinal?: boolean
}

interface TranscriptDrawerProps {
  transcript?: string | null
  liveSegments?: LiveSegmentLike[]
  live?: boolean
  alwaysVisible?: boolean
  emptyMessage?: string
  trigger?: React.ReactNode
}

export function TranscriptDrawer({
  transcript,
  liveSegments = [],
  live = false,
  alwaysVisible = false,
  emptyMessage = 'Transcript will appear here soon.',
  trigger,
}: TranscriptDrawerProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const hasTranscript = alwaysVisible || Boolean(transcript?.trim()) || liveSegments.length > 0

  if (!hasTranscript) return null

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-2 rounded-full shadow-none">
            <span className="relative flex items-center">
              <AlignLeft />
              {live && !open ? (
                <span className="absolute -right-1 -top-1 flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
                  <span className="relative inline-flex size-2 rounded-full bg-accent" />
                </span>
              ) : null}
            </span>
            Transcript
          </Button>
        )}
      </SheetTrigger>

      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'gap-0 overflow-y-auto border-border',
          isMobile ? 'max-h-[75vh] rounded-t-3xl' : 'w-full sm:max-w-md'
        )}
      >
        <SheetHeader className="border-b border-border/60 px-6 py-5">
          <div className="flex items-center gap-2">
            <SheetTitle>Transcript</SheetTitle>
            {live && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                <Dot className="size-4 text-accent" />
                Live
              </span>
            )}
          </div>
          <SheetDescription>
            {live
              ? 'Follow the conversation as it happens.'
              : 'Use the transcript as a source of detail when you need it.'}
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 py-6">
          {liveSegments.length > 0 ? (
            <div className="space-y-3">
              {liveSegments.map((segment, index) => (
                <p
                  key={`${segment.speaker}-${index}`}
                  className={cn(
                    'text-sm leading-7',
                    segment.isFinal === false ? 'text-muted-foreground/60' : 'text-foreground'
                  )}
                >
                  <span className="font-medium text-foreground">{segment.speaker}:</span>{' '}
                  {segment.text}
                </p>
              ))}
            </div>
          ) : transcript?.trim() ? (
            <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/85">
              {transcript}
            </p>
          ) : (
            <p className="text-sm leading-7 text-muted-foreground">
              {emptyMessage}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
