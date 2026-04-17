"use client";

import { useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useShellAnimation } from "@/hooks/use-shell-animation";
import type { AssistantShellMode } from "@/components/assistant-shell-context";
import { ASSISTANT_EXPANDED_MAX_WIDTH_REM } from "@/lib/assistant-shell-layout";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ChatShellProps {
  mode: AssistantShellMode;
  setMode: (mode: AssistantShellMode) => void;
  isExpanded: boolean;
  reserveInFlow: boolean;
  transcriptBubble?: React.ReactNode;
  dockPrompt: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  endRef: React.RefObject<HTMLDivElement | null>;
  messages: unknown[];
  status: string;
  children: (ctx: { visibleMode: AssistantShellMode; revealed: boolean; collapse: () => void }) => React.ReactNode;
}

/* ------------------------------------------------------------------ */
/*  ChatShell                                                          */
/* ------------------------------------------------------------------ */

export function ChatShell({
  mode,
  setMode,
  isExpanded,
  reserveInFlow,
  transcriptBubble,
  dockPrompt,
  inputRef,
  endRef,
  messages,
  status,
  children,
}: ChatShellProps) {
  const isMobile = useIsMobile();

  /* ---- Shell animation ---- */

  const {
    shellRef,
    shellStackRef,
    dockButtonRef,
    spacerHeight,
    renderedMode,
    revealed,
    heightStyle,
    collapse,
  } = useShellAnimation({ mode, setMode, isExpanded, isMobile });

  /* ---- Focus input when chat opens ---- */

  useEffect(() => {
    if (mode !== "chat") return;

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [mode, inputRef]);

  /* ---- Auto-scroll chat messages ---- */

  useEffect(() => {
    if (mode !== "chat") return;

    const frame = window.requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ block: "end" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [mode, messages, status, endRef]);

  /* ---- Keyboard shortcuts ---- */

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        if (isExpanded) {
          collapse();
        } else {
          setMode("chat");
        }
      }

      if (event.key === "Escape" && isExpanded) {
        event.preventDefault();
        collapse();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [collapse, isExpanded, setMode]);

  /* ---- Click outside ---- */

  useEffect(() => {
    if (!isExpanded) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (shellRef.current?.contains(target)) return;
      if (target.closest("[data-slot=dropdown-menu-content]")) return;
      if (target.closest("[data-radix-popper-content-wrapper]")) return;
      if (target.closest("[data-slot=popover-content]")) return;
      if (target.closest("[data-slot=transcript-bubble]")) return;
      collapse();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [collapse, isExpanded, shellRef]);

  /* ---- Derived ---- */

  const isLoading = status === "submitted" || status === "streaming";
  const visibleMode = renderedMode === "collapsed" ? mode : renderedMode;

  /* ---- Render ---- */

  return (
    <>
      {reserveInFlow ? (
        <div aria-hidden="true" style={{ height: spacerHeight }} />
      ) : null}

      <section
        role="region"
        aria-label="Chat with noter"
        className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-2 md:px-4"
        style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div
          ref={shellStackRef}
          className="flex w-full max-w-[48rem] items-end gap-2"
          style={{ maxWidth: `${ASSISTANT_EXPANDED_MAX_WIDTH_REM}rem` }}
        >
          {transcriptBubble}
          <div
            ref={shellRef}
            data-slot="chatbar-shell"
            data-state={isExpanded ? "expanded" : "collapsed"}
            data-mode={visibleMode}
            data-generating={isLoading ? "true" : "false"}
            className={cn(
              "pointer-events-auto flex flex-1 origin-bottom flex-col overflow-hidden rounded-[28px] border border-border/60 bg-card shadow-lg",
              "transition-[box-shadow,border-color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
              isExpanded ? "translate-y-0 scale-100" : "translate-y-1 scale-[0.992]",
            )}
            style={heightStyle}
          >
            {isExpanded ? (
              <div
                className={cn(
                  "flex min-h-0 flex-1 flex-col transition-opacity duration-150",
                  revealed ? "opacity-100" : "opacity-0",
                )}
              >
                {children({ visibleMode, revealed, collapse })}
              </div>
            ) : (
              <button
                ref={dockButtonRef}
                type="button"
                onClick={() => setMode("chat")}
                className="flex h-full w-full items-center justify-between gap-4 rounded-full bg-card border border-border/60 px-5 text-left transition-[background-color,border-color,transform] hover:bg-card/80 hover:border-border shadow-sm"
                aria-expanded="false"
                aria-label="Open chat"
              >
                <span className="truncate text-sm text-muted-foreground">
                  {dockPrompt}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  ⌘J
                </span>
              </button>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
