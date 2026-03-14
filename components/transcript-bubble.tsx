"use client";

import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useAssistantShellContextSafe } from "@/components/assistant-shell-context";
import { useAudioVisualizer } from "@/hooks/use-audio-visualizer";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const IDLE_BAR_HEIGHTS = [0.12, 0.15, 0.1, 0.14, 0.11, 0.13];

/* ------------------------------------------------------------------ */
/*  AudioBars                                                          */
/* ------------------------------------------------------------------ */

type BarStyle = "accent" | "muted" | "idle";

function AudioBars({
  barHeights,
  barStyle = "idle",
}: {
  barHeights: number[];
  barStyle?: BarStyle;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-[2px]",
        barStyle === "muted" && "opacity-60 transition-opacity duration-500",
      )}
      aria-hidden
    >
      {barHeights.map((h, i) => (
        <div
          key={i}
          className={cn(
            "w-[3.5px] rounded-full transition-[height] duration-[120ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            barStyle === "accent"
              ? "bg-primary"
              : barStyle === "muted"
                ? "bg-muted-foreground/40"
                : "bg-muted-foreground/40",
          )}
          style={{ height: `${Math.max(4, h * 24)}px` }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TranscriptBubble — h-16 trigger pill with always-visible bars      */
/* ------------------------------------------------------------------ */

export function TranscriptBubble() {
  const shellContext = useAssistantShellContextSafe();
  const ctx = shellContext?.meetingContext;
  const isTranscriptMode = shellContext?.mode === "transcript";

  const isRecording = ctx?.recordingPhase === "recording" && ctx?.live;
  const analyserNode = ctx?.analyserNode ?? null;

  const barHeights = useAudioVisualizer(isRecording ? analyserNode : null);
  const displayBars = isRecording ? barHeights : IDLE_BAR_HEIGHTS;

  const barStyle: BarStyle = isRecording ? "accent" : "idle";

  if (!ctx) return null;

  return (
    <div className="relative shrink-0" style={{ height: 64, width: 56 }}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-slot="transcript-bubble"
            onClick={() => shellContext?.setMode("transcript")}
            data-active={isTranscriptMode ? "true" : "false"}
            className={cn(
              "liquid-glass-dock pointer-events-auto flex h-16 w-14 items-center justify-center rounded-[20px]",
              "transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
              isTranscriptMode &&
                "ring-1 ring-ring/35 shadow-[0_18px_40px_-28px_oklch(0.18_0.01_80/0.24)]",
              "hover:scale-105 active:scale-95",
            )}
            aria-label={
              isRecording ? "Open live transcript" : "Open transcript"
            }
            aria-pressed={isTranscriptMode}
          >
            <AudioBars barHeights={displayBars} barStyle={barStyle} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {isRecording ? "Open live transcript" : "Open transcript"}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
