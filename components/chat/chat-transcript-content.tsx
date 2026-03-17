"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TranscriptSegment {
  speaker: string;
  text: string;
  isFinal?: boolean;
}

interface ChatTranscriptContentProps {
  isLive: boolean;
  transcriptSegments: TranscriptSegment[];
  transcriptText: string;
  onClose: () => void;
}

export function ChatTranscriptContent({
  isLive,
  transcriptSegments,
  transcriptText,
  onClose,
}: ChatTranscriptContentProps) {
  const transcriptScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLive) return;

    const viewport = transcriptScrollRef.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );

    if (!viewport) return;

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

    if (distanceFromBottom > 48) return;

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: "auto",
    });
  }, [transcriptSegments, isLive]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/35 px-4 py-3">
        <span className="text-sm font-medium text-foreground">
          Transcript
        </span>
        {isLive && (
          <Badge
            variant="outline"
            className="rounded-full px-2.5 text-[11px] font-medium text-[var(--recording)]"
            style={{
              borderColor: "color-mix(in oklch, var(--recording-soft) 72%, var(--border))",
              background:
                "color-mix(in oklch, var(--recording-soft) 38%, transparent)",
            }}
          >
            Live
          </Badge>
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

      <div ref={transcriptScrollRef} className="min-h-0 flex-1">
        <ScrollArea className="h-full">
          <div className="flex min-h-full flex-col gap-2 px-4 pb-4 pt-3">
            {transcriptSegments.length > 0 ? (
              <>
                {transcriptSegments.map((segment, i) => (
                  <p
                    key={i}
                    className={cn(
                      "text-sm leading-7",
                      segment.isFinal === false && "text-muted-foreground/60",
                    )}
                  >
                    <span className="font-medium text-foreground">
                      {segment.speaker}:
                    </span>{" "}
                    {segment.text}
                  </p>
                ))}
              </>
            ) : transcriptText.trim() ? (
              <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">
                {transcriptText}
              </p>
            ) : (
              <div className="flex min-h-full items-center justify-center py-8">
                <div className="surface-empty flex max-w-sm flex-col items-center gap-2 px-6 py-8 text-center">
                  <p className="text-sm font-medium text-foreground">
                    Transcript will appear here
                  </p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Start recording to follow along live. If this meeting
                    already has a transcript, it will show up here
                    automatically.
                  </p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
