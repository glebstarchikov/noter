"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { AssistantShellMode } from "@/components/assistant-shell-context";
import {
  ASSISTANT_COLLAPSED_HEIGHT,
  getAssistantExpandedHeightCss,
  resolveAssistantExpandedHeightPx,
} from "@/lib/assistant-shell-layout";

const SPRING_EASE = "cubic-bezier(0.16,1,0.3,1)";
const MORPH_DURATION = 300;
const CONTENT_FADE_DURATION = 120;

interface UseShellAnimationOptions {
  mode: AssistantShellMode;
  setMode: (mode: AssistantShellMode) => void;
  isExpanded: boolean;
  isMobile: boolean;
}

interface UseShellAnimationReturn {
  shellRef: React.RefObject<HTMLDivElement | null>;
  shellStackRef: React.RefObject<HTMLDivElement | null>;
  dockButtonRef: React.RefObject<HTMLButtonElement | null>;
  spacerHeight: number;
  renderedMode: AssistantShellMode;
  revealed: boolean;
  heightStyle: React.CSSProperties;
  collapse: () => void;
}

export function useShellAnimation({
  mode,
  setMode,
  isExpanded,
  isMobile,
}: UseShellAnimationOptions): UseShellAnimationReturn {
  const expandedHeight = getAssistantExpandedHeightCss(isMobile);

  const [targetHeight, setTargetHeight] = useState<number | null>(null);
  const [renderedMode, setRenderedMode] =
    useState<AssistantShellMode>("collapsed");
  const [revealed, setRevealed] = useState(false);
  const [spacerHeight, setSpacerHeight] = useState(
    ASSISTANT_COLLAPSED_HEIGHT + 24,
  );

  const shellRef = useRef<HTMLDivElement>(null);
  const shellStackRef = useRef<HTMLDivElement>(null);
  const dockButtonRef = useRef<HTMLButtonElement>(null);
  const collapsingRef = useRef(false);
  const expandedRef = useRef(false);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heightResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collapseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modeSwitchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---- Cleanup all timeouts on unmount ---- */

  useEffect(() => {
    return () => {
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
      if (heightResetTimeoutRef.current) clearTimeout(heightResetTimeoutRef.current);
      if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
      if (modeSwitchTimeoutRef.current) clearTimeout(modeSwitchTimeoutRef.current);
    };
  }, []);

  /* ---- Spacer height measurement ---- */

  useEffect(() => {
    const measureShell = () => {
      const nextHeight = shellStackRef.current?.getBoundingClientRect().height;
      if (!nextHeight) return;
      setSpacerHeight(Math.ceil(nextHeight) + 24);
    };

    measureShell();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => {
        measureShell();
      });

      if (shellStackRef.current) {
        observer.observe(shellStackRef.current);
      }

      return () => observer.disconnect();
    }

    window.addEventListener("resize", measureShell);
    return () => window.removeEventListener("resize", measureShell);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--floating-chatbar-offset",
      `${spacerHeight}px`,
    );

    return () => {
      document.documentElement.style.removeProperty("--floating-chatbar-offset");
    };
  }, [spacerHeight]);

  /* ---- Expanded content mode ---- */

  useEffect(() => {
    if (!isExpanded) {
      setRenderedMode("collapsed");
      return;
    }

    if (renderedMode === "collapsed") {
      setRenderedMode(mode);
      return;
    }

    if (renderedMode === mode) return;

    setRevealed(false);

    if (modeSwitchTimeoutRef.current) {
      clearTimeout(modeSwitchTimeoutRef.current);
    }

    modeSwitchTimeoutRef.current = setTimeout(() => {
      setRenderedMode(mode);
      requestAnimationFrame(() => {
        setRevealed(true);
      });
    }, CONTENT_FADE_DURATION);
  }, [isExpanded, mode, renderedMode]);

  /* ---- Smooth expand animation ---- */

  useLayoutEffect(() => {
    const wasExpanded = expandedRef.current;
    expandedRef.current = isExpanded;

    if (!isExpanded || wasExpanded || collapsingRef.current) return;

    setTargetHeight(ASSISTANT_COLLAPSED_HEIGHT);
    setRevealed(false);
    setRenderedMode(mode);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const nextHeight = resolveAssistantExpandedHeightPx(isMobile);
        setTargetHeight(nextHeight);

        if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
        if (heightResetTimeoutRef.current) clearTimeout(heightResetTimeoutRef.current);

        revealTimeoutRef.current = setTimeout(() => setRevealed(true), 60);
        heightResetTimeoutRef.current = setTimeout(
          () => setTargetHeight(null),
          MORPH_DURATION + 20,
        );
      });
    });
  }, [isExpanded, isMobile, mode]);

  /* ---- Collapse with animation ---- */

  const collapse = useCallback(() => {
    const el = shellRef.current;
    if (!el || collapsingRef.current) return;

    const currentHeight = el.offsetHeight;

    // No real layout (e.g. test environment) — collapse immediately
    if (currentHeight === 0) {
      setRevealed(false);
      setTargetHeight(null);
      setRenderedMode("collapsed");
      setMode("collapsed");
      requestAnimationFrame(() => dockButtonRef.current?.focus());
      return;
    }

    collapsingRef.current = true;
    setRevealed(false);
    setTargetHeight(currentHeight); // snapshot current

    if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    if (heightResetTimeoutRef.current) clearTimeout(heightResetTimeoutRef.current);
    if (modeSwitchTimeoutRef.current) clearTimeout(modeSwitchTimeoutRef.current);

    requestAnimationFrame(() => {
      setTargetHeight(ASSISTANT_COLLAPSED_HEIGHT);
      if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);

      collapseTimeoutRef.current = setTimeout(() => {
        setMode("collapsed");
        collapsingRef.current = false;
        setTargetHeight(null);
        setRenderedMode("collapsed");
        requestAnimationFrame(() => {
          dockButtonRef.current?.focus();
        });
      }, MORPH_DURATION);
    });
  }, [setMode]);

  /* ---- Height style ---- */

  const heightStyle: React.CSSProperties = {
    height:
      targetHeight != null
        ? `${targetHeight}px`
        : isExpanded
          ? expandedHeight
          : `${ASSISTANT_COLLAPSED_HEIGHT}px`,
    maxHeight: isExpanded ? expandedHeight : undefined,
    transition: `height ${MORPH_DURATION}ms ${SPRING_EASE}`,
  };

  return {
    shellRef,
    shellStackRef,
    dockButtonRef,
    spacerHeight,
    renderedMode,
    revealed,
    heightStyle,
    collapse,
  };
}
