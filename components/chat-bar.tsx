"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type FileUIPart } from "ai";
import ReactMarkdown from "react-markdown";
import {
  AlertCircle,
  Check,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  Paperclip,
  Search,
  Send,
  X,
} from "lucide-react";
import {
  CHAT_MODEL_OPTIONS,
  DEFAULT_CHAT_MODEL,
  getChatModelLabel,
  type ChatModelId,
} from "@/lib/ai-models";
import { ChatMessageAttachments } from "@/components/chat-message-attachments";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  clearStoredMessages,
  getActiveContextLabel,
  getComposerPrompt,
  getContextDescription,
  getErrorMessage,
  getMessageText,
  getStoredMessages,
  saveStoredMessages,
} from "@/lib/chat-ui-helpers";
import {
  useAssistantShellContextSafe,
  type AssistantShellMode,
} from "@/components/assistant-shell-context";
import {
  ASSISTANT_COLLAPSED_HEIGHT,
  ASSISTANT_EXPANDED_MAX_WIDTH_REM,
  getAssistantExpandedHeightCss,
  resolveAssistantExpandedHeightPx,
} from "@/lib/assistant-shell-layout";
import type { ChatSurfaceScope } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SPRING_EASE = "cubic-bezier(0.16,1,0.3,1)";
const MORPH_DURATION = 300;
const CONTENT_FADE_DURATION = 120;

interface ChatBarProps {
  authenticated: boolean;
  allowGlobalToggle?: boolean;
  defaultScope: ChatSurfaceScope;
  meetingId?: string | null;
  reserveInFlow?: boolean;
  transcriptBubble?: React.ReactNode;
}

const STARTER_PROMPTS: Record<ChatSurfaceScope, string[]> = {
  support: [
    "How do I get started with noter?",
    "How do I upload a meeting?",
    "How do I use the dashboard?",
  ],
  meeting: [
    "Summarize this note",
    "List action items from this note",
    "Extract key decisions from this note",
  ],
  global: [
    "Summarize notes from this week",
    "List all action items across notes",
    "Find recurring themes across notes",
  ],
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ContextChip({ label }: { label: string }) {
  return (
    <div className="liquid-glass-context-chip flex items-center rounded-full px-3 py-1.5 text-xs font-medium text-foreground">
      {label}
    </div>
  );
}

function AttachmentChip({
  file,
  onRemove,
}: {
  file: File | FileUIPart;
  onRemove?: () => void;
}) {
  const filename = "name" in file ? file.name : file.filename || "attachment";
  const mediaType = file instanceof File ? file.type : file.mediaType;
  const isImage = mediaType.startsWith("image/");

  return (
    <div className="liquid-glass-chip flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-muted-foreground">
      {isImage ? (
        <ImageIcon className="size-3.5" />
      ) : (
        <FileText className="size-3.5" />
      )}
      <span className="max-w-32 truncate">{filename}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full text-muted-foreground transition-colors hover:text-foreground"
          aria-label={`Remove ${filename}`}
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function TranscriptContent({
  isLive,
  transcriptSegments,
  transcriptText,
  onClose,
}: {
  isLive: boolean;
  transcriptSegments: { speaker: string; text: string; isFinal?: boolean }[];
  transcriptText: string;
  onClose: () => void;
}) {
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

function MessageBubble({
  role,
  text,
}: {
  role: "user" | "assistant";
  text: string;
}) {
  if (role === "user") {
    return (
      <div className="liquid-glass-chip max-w-[85%] self-end rounded-[22px] px-4 py-2.5 text-sm leading-7 text-foreground">
        <div className="whitespace-pre-wrap">{text}</div>
      </div>
    );
  }

  return (
    <div className="surface-utility w-full max-w-[38rem] rounded-[24px] px-4 py-3 text-foreground">
      <div className="prose prose-sm max-w-none break-words leading-relaxed text-foreground dark:prose-invert [&>p]:mb-3 [&>p:last-child]:mb-0 [&>ul]:mb-3 [&>ul]:pl-5 [&>ol]:mb-3 [&>ol]:pl-5">
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ChatBar                                                            */
/* ------------------------------------------------------------------ */

export function ChatBar({
  authenticated,
  allowGlobalToggle = false,
  defaultScope,
  meetingId,
  reserveInFlow = true,
  transcriptBubble,
}: ChatBarProps) {
  const shellContext = useAssistantShellContextSafe();
  const isMobile = useIsMobile();
  const expandedHeight = getAssistantExpandedHeightCss(isMobile);

  /* ---- Mode-driven expansion (falls back to local state outside provider) ---- */

  const [localMode, setLocalMode] = useState<AssistantShellMode>("collapsed");
  const mode = shellContext?.mode ?? localMode;
  const setMode = shellContext?.setMode ?? setLocalMode;
  const isExpanded = mode === "chat" || mode === "transcript";

  /* ---- Height animation state ---- */

  const [targetHeight, setTargetHeight] = useState<number | null>(null);
  const [renderedMode, setRenderedMode] =
    useState<AssistantShellMode>("collapsed");
  const [revealed, setRevealed] = useState(false);
  const collapsingRef = useRef(false);

  /* ---- Chat state ---- */

  const [activeScope, setActiveScope] =
    useState<ChatSurfaceScope>(defaultScope);
  const [input, setInput] = useState("");
  const [model, setModel] = useState<ChatModelId>(DEFAULT_CHAT_MODEL);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const [hasHydratedMessages, setHasHydratedMessages] = useState(false);
  const [spacerHeight, setSpacerHeight] = useState(
    ASSISTANT_COLLAPSED_HEIGHT + 24,
  );

  /* ---- Refs ---- */

  const shellRef = useRef<HTMLDivElement>(null);
  const shellStackRef = useRef<HTMLDivElement>(null);
  const dockButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heightResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const collapseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modeSwitchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const expandedRef = useRef(false);

  /* ---- Scope sync ---- */

  useEffect(() => {
    setActiveScope(defaultScope);
  }, [defaultScope, meetingId]);

  /* ---- Chat transport ---- */

  const transport = useMemo(() => {
    if (activeScope === "support") {
      return new DefaultChatTransport({ api: "/api/chat/support" });
    }

    if (activeScope === "global") {
      return new DefaultChatTransport({ api: "/api/chat/global" });
    }

    return new DefaultChatTransport({
      api: "/api/chat",
      body: meetingId ? { meetingId } : undefined,
    });
  }, [activeScope, meetingId]);

  const chatId = useMemo(() => {
    if (activeScope === "support") return "__support__";
    if (activeScope === "global") return "__global__";
    return meetingId ?? "__global__";
  }, [activeScope, meetingId]);

  const { messages, sendMessage, setMessages, status, error } = useChat({
    id: chatId,
    transport,
  });

  /* ---- Composer helpers ---- */

  const resetComposer = useCallback(() => {
    setInput("");
    setFiles(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  useEffect(() => {
    resetComposer();
  }, [activeScope, resetComposer]);

  /* ---- Message persistence ---- */

  useEffect(() => {
    setHasHydratedMessages(false);
    const storedMessages = getStoredMessages(activeScope, meetingId);
    setMessages(storedMessages ?? []);
    setHasHydratedMessages(true);
  }, [activeScope, meetingId, setMessages]);

  useEffect(() => {
    if (!hasHydratedMessages || messages.length === 0) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveStoredMessages(activeScope, messages, meetingId);
    }, 300);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [activeScope, hasHydratedMessages, meetingId, messages]);

  useEffect(() => {
    return () => {
      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current);
      }
      if (heightResetTimeoutRef.current) {
        clearTimeout(heightResetTimeoutRef.current);
      }
      if (collapseTimeoutRef.current) {
        clearTimeout(collapseTimeoutRef.current);
      }
      if (modeSwitchTimeoutRef.current) {
        clearTimeout(modeSwitchTimeoutRef.current);
      }
    };
  }, []);

  /* ---- Focus input when chat opens ---- */

  useEffect(() => {
    if (mode !== "chat") return;

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [mode]);

  /* ---- Auto-scroll chat messages ---- */

  useEffect(() => {
    if (mode !== "chat") return;

    const frame = window.requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ block: "end" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [mode, messages, status]);

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
      document.documentElement.style.removeProperty(
        "--floating-chatbar-offset",
      );
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

        if (revealTimeoutRef.current) {
          clearTimeout(revealTimeoutRef.current);
        }
        if (heightResetTimeoutRef.current) {
          clearTimeout(heightResetTimeoutRef.current);
        }

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

    if (revealTimeoutRef.current) {
      clearTimeout(revealTimeoutRef.current);
    }
    if (heightResetTimeoutRef.current) {
      clearTimeout(heightResetTimeoutRef.current);
    }
    if (modeSwitchTimeoutRef.current) {
      clearTimeout(modeSwitchTimeoutRef.current);
    }

    requestAnimationFrame(() => {
      setTargetHeight(ASSISTANT_COLLAPSED_HEIGHT);
      if (collapseTimeoutRef.current) {
        clearTimeout(collapseTimeoutRef.current);
      }

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
  }, [collapse, isExpanded]);

  /* ---- Derived chat state ---- */

  const isLoading = status === "submitted" || status === "streaming";
  const isStreaming = status === "streaming";
  const canAttach = authenticated && activeScope !== "support";
  const canUseTools = activeScope !== "support";
  const canShowContext = activeScope !== "support";
  const selectedFiles = useMemo(
    () => (files ? Array.from(files) : []),
    [files],
  );
  const submitDisabled =
    isLoading || (!input.trim() && selectedFiles.length === 0);
  const errorMessage = getErrorMessage(error);
  const prompt = getComposerPrompt(activeScope);
  const activeContextLabel = getActiveContextLabel(activeScope);
  const starterPrompts = STARTER_PROMPTS[activeScope];
  const showContextRow = selectedFiles.length > 0;

  /* ---- Transcript data from meeting context ---- */

  const meetingCtx = shellContext?.meetingContext;
  const transcriptSegments = useMemo(
    () => meetingCtx?.transcriptSegments ?? [],
    [meetingCtx?.transcriptSegments],
  );
  const transcriptText = meetingCtx?.transcriptText ?? "";
  const isLive = meetingCtx?.live ?? false;
  const visibleMode = renderedMode === "collapsed" ? mode : renderedMode;
  const isTranscriptMode = visibleMode === "transcript";

  /* ---- Chat handlers ---- */

  const handleClearChat = useCallback(() => {
    clearStoredMessages(activeScope, meetingId);
    setMessages([]);
  }, [activeScope, meetingId, setMessages]);

  const handleSubmit = useCallback(
    (text: string) => {
      const trimmedText = text.trim();
      const hasAttachments = canAttach && Boolean(files?.length);
      if (isLoading || (!trimmedText && !hasAttachments)) return;

      const payload = hasAttachments
        ? trimmedText
          ? { text: trimmedText, files }
          : { files: files as FileList }
        : { text: trimmedText };

      void sendMessage(payload, {
        body:
          activeScope === "support"
            ? undefined
            : {
                model,
                searchEnabled,
              },
      });

      resetComposer();
    },
    [
      activeScope,
      canAttach,
      files,
      isLoading,
      model,
      resetComposer,
      searchEnabled,
      sendMessage,
    ],
  );

  const handleStarterPrompt = useCallback(
    (starterPrompt: string) => {
      handleSubmit(starterPrompt);
    },
    [handleSubmit],
  );

  const removeSelectedFile = useCallback(
    (index: number) => {
      const remainingFiles = selectedFiles.filter(
        (_, fileIndex) => fileIndex !== index,
      );
      if (remainingFiles.length === 0) {
        setFiles(undefined);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }

      const nextFiles = new DataTransfer();
      remainingFiles.forEach((remainingFile) =>
        nextFiles.items.add(remainingFile),
      );
      setFiles(nextFiles.files);
    },
    [selectedFiles],
  );

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
              "liquid-glass-shell pointer-events-auto flex flex-1 origin-bottom flex-col overflow-hidden rounded-[30px]",
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
                {isTranscriptMode ? (
                  <TranscriptContent
                    isLive={isLive}
                    transcriptSegments={transcriptSegments}
                    transcriptText={transcriptText}
                    onClose={collapse}
                  />
                ) : (
                  <div className="relative flex min-h-0 flex-1 flex-col">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost-icon"
                          size="icon-sm"
                          onClick={collapse}
                          aria-label="Close"
                          className="liquid-glass-control absolute right-3 top-3 z-10 rounded-full border border-border/40"
                        >
                          <X />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Close</TooltipContent>
                    </Tooltip>

                    <ScrollArea className="min-h-0 flex-1">
                      <div
                        className={cn(
                          "flex min-h-full flex-col gap-4 px-4 pb-2",
                          messages.length === 0 && !isLoading
                            ? "justify-end pt-8"
                            : "justify-end pt-14",
                        )}
                      >
                        {messages.length === 0 && !isLoading ? (
                          <div className="flex w-full flex-col items-center justify-end pb-2">
                            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 max-w-[36rem]">
                              {starterPrompts.map((starterPrompt) => (
                                <Button
                                  key={starterPrompt}
                                  type="button"
                                  variant="ghost"
                                  onClick={() =>
                                    handleStarterPrompt(starterPrompt)
                                  }
                                  className="liquid-glass-prompt h-auto justify-start rounded-[20px] px-4 py-3 text-left whitespace-normal text-sm"
                                >
                                  {starterPrompt}
                                </Button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div
                            role="log"
                            aria-live="polite"
                            aria-relevant="additions text"
                            className="flex flex-col gap-6"
                          >
                            {messages.map((message) => {
                              const text = getMessageText(message);
                              const isUser = message.role === "user";

                              return (
                                <div
                                  key={message.id}
                                  className={cn(
                                    "flex flex-col gap-1.5",
                                    isUser ? "items-end" : "items-start",
                                  )}
                                >
                                  <span className="px-2 text-[11px] font-medium text-muted-foreground">
                                    {isUser ? "You" : "Noter"}
                                  </span>

                                  <ChatMessageAttachments message={message} />

                                  {text ? (
                                    <MessageBubble
                                      role={isUser ? "user" : "assistant"}
                                      text={text}
                                    />
                                  ) : null}
                                </div>
                              );
                            })}

                            {isLoading ? (
                              <div className="flex items-start pb-2">
                                <div className="flex px-2 py-2 items-center gap-3 text-sm text-muted-foreground">
                                  <span className="relative flex size-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-muted-foreground opacity-75"></span>
                                    <span className="relative inline-flex rounded-full size-2 bg-muted-foreground"></span>
                                  </span>
                                  {isStreaming
                                    ? "Writing a response..."
                                    : "Thinking..."}
                                </div>
                              </div>
                            ) : null}

                            <div ref={endRef} />
                          </div>
                        )}
                      </div>
                    </ScrollArea>

                    <div className="px-3 pb-3 pt-2">
                      {errorMessage ? (
                        <Alert
                          variant="destructive"
                          className="mb-3 border-destructive/20 bg-destructive/5"
                        >
                          <AlertCircle />
                          <AlertDescription>{errorMessage}</AlertDescription>
                        </Alert>
                      ) : null}

                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          handleSubmit(input);
                        }}
                      >
                        <InputGroup className="liquid-glass-input h-auto rounded-[26px] border-border/60 shadow-none">
                          {showContextRow ? (
                            <div className="flex w-full flex-wrap gap-2 px-4 pt-4 pb-0">
                              {canShowContext ? (
                                <ContextChip label={activeContextLabel} />
                              ) : null}
                              {selectedFiles.map((file, index) => (
                                <AttachmentChip
                                  key={`${file.name}-${index}`}
                                  file={file}
                                  onRemove={() => removeSelectedFile(index)}
                                />
                              ))}
                            </div>
                          ) : null}

                          <InputGroupTextarea
                            ref={inputRef}
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            onFocus={() => setMode("chat")}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                handleSubmit(input);
                              }
                            }}
                            placeholder={prompt}
                            disabled={isLoading}
                            aria-label={prompt}
                            className="min-h-[3rem] max-h-32 overflow-y-auto px-4 py-3 text-sm leading-6"
                          />

                          <InputGroupAddon
                            align="block-end"
                            className="flex-wrap gap-2 pt-2"
                          >
                            {canShowContext ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <InputGroupButton
                                    variant="ghost"
                                    size="sm"
                                    className="liquid-glass-control border border-border/40"
                                  >
                                    Context
                                    <ChevronDown data-icon="inline-end" />
                                  </InputGroupButton>
                                </PopoverTrigger>
                                <PopoverContent
                                  align="start"
                                  className="liquid-glass-popover w-[18rem] rounded-[24px] border-border/40 p-4"
                                >
                                  <div className="flex flex-col gap-4">
                                    <div className="flex flex-col gap-1">
                                      <p className="text-sm font-medium text-foreground">
                                        Active context
                                      </p>
                                      <p className="text-sm leading-6 text-muted-foreground">
                                        {getContextDescription(
                                          activeScope,
                                          selectedFiles.length,
                                          allowGlobalToggle,
                                        )}
                                      </p>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                      <ContextChip label={activeContextLabel} />
                                      {selectedFiles.length > 0 ? (
                                        <Badge
                                          variant="outline"
                                          className="rounded-full"
                                        >
                                          {selectedFiles.length}{" "}
                                          {selectedFiles.length === 1
                                            ? "file"
                                            : "files"}
                                        </Badge>
                                      ) : null}
                                    </div>

                                    {allowGlobalToggle ? (
                                      <>
                                        <Separator />
                                        <div className="flex flex-col gap-2">
                                          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                            Scope
                                          </p>
                                          <ToggleGroup
                                            type="single"
                                            variant="outline"
                                            size="sm"
                                            value={
                                              activeScope === "meeting"
                                                ? "meeting"
                                                : "global"
                                            }
                                            onValueChange={(value) => {
                                              if (
                                                value === "meeting" ||
                                                value === "global"
                                              ) {
                                                setActiveScope(value);
                                              }
                                            }}
                                            aria-label="Chat scope"
                                            className="liquid-glass-toolbar w-full"
                                          >
                                            <ToggleGroupItem
                                              value="meeting"
                                              aria-label="This note"
                                            >
                                              This note
                                            </ToggleGroupItem>
                                            <ToggleGroupItem
                                              value="global"
                                              aria-label="All notes"
                                            >
                                              All notes
                                            </ToggleGroupItem>
                                          </ToggleGroup>
                                        </div>
                                      </>
                                    ) : null}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            ) : null}

                            {canAttach ? (
                              <>
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  multiple
                                  accept=".pdf,.txt,.md,.docx,.png,.jpg,.jpeg,.webp"
                                  className="hidden"
                                  onChange={(event) => {
                                    if (event.target.files) {
                                      setFiles(event.target.files);
                                    }
                                  }}
                                />
                                <InputGroupButton
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => fileInputRef.current?.click()}
                                  className="liquid-glass-control border border-border/40"
                                >
                                  <Paperclip data-icon="inline-start" />
                                  Add files
                                </InputGroupButton>
                              </>
                            ) : null}

                            {canUseTools ? (
                              <>
                                <InputGroupButton
                                  variant="ghost"
                                  size="sm"
                                  aria-pressed={searchEnabled}
                                  data-active={searchEnabled ? "true" : "false"}
                                  onClick={() =>
                                    setSearchEnabled((current) => !current)
                                  }
                                  className="liquid-glass-control border border-border/40"
                                >
                                  <Search data-icon="inline-start" />
                                  Search web
                                  {searchEnabled ? (
                                    <Check data-icon="inline-end" />
                                  ) : null}
                                </InputGroupButton>

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <InputGroupButton
                                      variant="ghost"
                                      size="sm"
                                      className="liquid-glass-control border border-border/40"
                                    >
                                      {getChatModelLabel(model)}
                                      <ChevronDown data-icon="inline-end" />
                                    </InputGroupButton>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="start"
                                    className="w-52"
                                  >
                                    <DropdownMenuRadioGroup
                                      value={model}
                                      onValueChange={(value) =>
                                        setModel(value as ChatModelId)
                                      }
                                    >
                                      {CHAT_MODEL_OPTIONS.map((option) => (
                                        <DropdownMenuRadioItem
                                          key={option.value}
                                          value={option.value}
                                        >
                                          {option.label}
                                        </DropdownMenuRadioItem>
                                      ))}
                                    </DropdownMenuRadioGroup>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </>
                            ) : null}

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <InputGroupButton
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="More chat actions"
                                  className="liquid-glass-control border border-border/40"
                                >
                                  <MoreHorizontal />
                                </InputGroupButton>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  disabled={messages.length === 0}
                                  onSelect={() => handleClearChat()}
                                >
                                  Clear conversation
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <InputGroupButton
                                  type="submit"
                                  variant="default"
                                  size="icon-sm"
                                  disabled={submitDisabled}
                                  aria-label="Send message"
                                  className="liquid-glass-button ml-auto"
                                >
                                  {isLoading ? (
                                    <Loader2 className="animate-spin" />
                                  ) : (
                                    <Send />
                                  )}
                                </InputGroupButton>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                Send message
                              </TooltipContent>
                            </Tooltip>
                          </InputGroupAddon>
                        </InputGroup>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                ref={dockButtonRef}
                type="button"
                onClick={() => setMode("chat")}
                className="liquid-glass-dock flex h-full w-full items-center justify-between gap-4 rounded-[30px] px-4 text-left transition-transform"
                aria-expanded="false"
                aria-label="Open chat"
              >
                <span className="truncate text-sm text-muted-foreground">
                  {prompt}
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
