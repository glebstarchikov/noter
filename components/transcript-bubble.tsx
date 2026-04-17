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

const IDLE_BAR_HEIGHTS = [0.2, 0.3, 0.4];

function AudioBars({
  barHeights,
  isIdle,
}: {
  barHeights: number[];
  isIdle: boolean;
}) {
  return (
    // Fixed height prevents the container growing with the tallest bar (which shifts shorter bars down)
    <div
      className={cn("flex items-end justify-center gap-[2.5px]", isIdle && "opacity-50")}
      style={{ height: "16px" }}
      aria-hidden
    >
      {barHeights.map((height, index) => (
        // Fixed-width wrapper prevents horizontal drift as heights animate
        <div key={index} className="flex w-[3px] shrink-0 items-end justify-center">
          <div
            className="w-full rounded-full bg-accent transition-[height] duration-150 ease-out"
            style={{ height: `${Math.max(4, height * 16)}px` }}
          />
        </div>
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
  // 0.18 limits analysis to ~0–4kHz so all 3 bars respond to speech, not silence
  const barHeights = useAudioVisualizer(isRecording ? analyserNode : null, 3, 0.18);
  const displayBars = isRecording ? barHeights : IDLE_BAR_HEIGHTS;

  if (!ctx) return null;

  return (
    <div
      className="flex shrink-0 items-center justify-center"
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
              "pointer-events-auto flex size-11 items-center justify-center rounded-full",
              "bg-card shadow-sm",
              "transition-[box-shadow,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
              "hover:bg-secondary",
              isTranscriptMode && "bg-secondary",
              isRecording && "ring-[3px] ring-[var(--recording)]/20",
            )}
            aria-label={
              isRecording ? "Open live transcript" : "Open transcript"
            }
            aria-pressed={isTranscriptMode}
          >
            <AudioBars barHeights={displayBars} isIdle={!isRecording} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {isRecording ? "Open live transcript" : "Open transcript"}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
