"use client";

import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useAssistantShellContextSafe } from "@/components/assistant-shell-context";
import { useAudioVisualizer } from "@/hooks/use-audio-visualizer";
import {
  ASSISTANT_COLLAPSED_HEIGHT,
  ASSISTANT_TRANSCRIPT_TRIGGER_WIDTH,
} from "@/lib/assistant-shell-layout";
import { cn } from "@/lib/utils";

const IDLE_BAR_HEIGHTS = [0.12, 0.12, 0.12, 0.12];

type BarStyle = "live" | "active" | "idle";

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
        "flex items-end justify-center gap-[2px]",
        barStyle === "idle" && "opacity-75",
      )}
      aria-hidden
    >
      {barHeights.map((height, index) => (
        <div
          key={index}
          className={cn(
            "rounded-full transition-[height,background-color,opacity] duration-150 ease-out",
            barStyle === "live"
              ? "bg-primary"
              : barStyle === "active"
                ? "bg-foreground/70"
                : "bg-muted-foreground/45",
          )}
          style={{
            width: "2.5px",
            height: `${Math.max(4, height * 20)}px`,
            opacity: barStyle === "live" ? 1 : 0.9,
          }}
        />
      ))}
    </div>
  );
}

export function TranscriptBubble() {
  const shellContext = useAssistantShellContextSafe();
  const ctx = shellContext?.meetingContext;
  const isTranscriptMode = shellContext?.mode === "transcript";

  const isRecording = ctx?.recordingPhase === "recording" && ctx?.live;
  const analyserNode = ctx?.analyserNode ?? null;
  const barHeights = useAudioVisualizer(isRecording ? analyserNode : null);
  const displayBars = isRecording ? barHeights : IDLE_BAR_HEIGHTS;
  const barStyle: BarStyle = isRecording
    ? "live"
    : isTranscriptMode
      ? "active"
      : "idle";

  if (!ctx) return null;

  return (
    <div
      className="relative shrink-0"
      style={{
        height: ASSISTANT_COLLAPSED_HEIGHT,
        width: ASSISTANT_TRANSCRIPT_TRIGGER_WIDTH,
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-slot="transcript-bubble"
            data-live={isRecording ? "true" : "false"}
            data-open={isTranscriptMode ? "true" : "false"}
            onClick={() => shellContext?.setMode("transcript")}
            className={cn(
              "assistant-shell-trigger pointer-events-auto flex size-16 items-center justify-center rounded-full",
              "transition-[border-color,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
              isRecording && "ring-[3px] ring-[var(--recording)]/20",
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
