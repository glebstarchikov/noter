"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { DEFAULT_CHAT_MODEL, type ChatModelId } from "@/lib/ai-models";
import { useIsMobile } from "@/hooks/use-mobile";
import { useShellAnimation } from "@/hooks/use-shell-animation";
import {
  clearStoredMessages,
  getComposerPrompt,
  getStoredMessages,
  saveStoredMessages,
} from "@/lib/chat-ui-helpers";
import {
  useAssistantShellContextSafe,
  type AssistantShellMode,
} from "@/components/assistant-shell-context";
import { ASSISTANT_EXPANDED_MAX_WIDTH_REM } from "@/lib/assistant-shell-layout";
import type { ChatSurfaceScope } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChatMessageList } from "@/components/chat/chat-message-list";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatTranscriptContent } from "@/components/chat/chat-transcript-content";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

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

  /* ---- Mode-driven expansion (falls back to local state outside provider) ---- */

  const [localMode, setLocalMode] = useState<AssistantShellMode>("collapsed");
  const mode = shellContext?.mode ?? localMode;
  const setMode = shellContext?.setMode ?? setLocalMode;
  const isExpanded = mode === "chat" || mode === "transcript";

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

  /* ---- Chat state ---- */

  const [activeScope, setActiveScope] =
    useState<ChatSurfaceScope>(defaultScope);
  const [input, setInput] = useState("");
  const [model, setModel] = useState<ChatModelId>(DEFAULT_CHAT_MODEL);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const [hasHydratedMessages, setHasHydratedMessages] = useState(false);

  /* ---- Refs ---- */

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  /* ---- Derived chat state ---- */

  const isLoading = status === "submitted" || status === "streaming";
  const selectedFiles = useMemo(
    () => (files ? Array.from(files) : []),
    [files],
  );
  const submitDisabled =
    isLoading || (!input.trim() && selectedFiles.length === 0);
  const prompt = getComposerPrompt(activeScope);
  const starterPrompts = STARTER_PROMPTS[activeScope];

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
      const hasAttachments =
        authenticated && activeScope !== "support" && Boolean(files?.length);
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
            : { model, searchEnabled },
      });

      resetComposer();
    },
    [
      activeScope,
      authenticated,
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
                  <ChatTranscriptContent
                    isLive={isLive}
                    transcriptSegments={transcriptSegments}
                    transcriptText={transcriptText}
                    onClose={collapse}
                  />
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <ChatMessageList
                      messages={messages}
                      status={status}
                      starterPrompts={starterPrompts}
                      onStarterPrompt={handleStarterPrompt}
                      onCollapse={collapse}
                      endRef={endRef}
                    />

                    <ChatComposer
                      input={input}
                      onInputChange={setInput}
                      onSubmit={handleSubmit}
                      onFocus={() => setMode("chat")}
                      isLoading={isLoading}
                      error={error}
                      activeScope={activeScope}
                      allowGlobalToggle={allowGlobalToggle}
                      onScopeChange={setActiveScope}
                      model={model}
                      onModelChange={setModel}
                      searchEnabled={searchEnabled}
                      onSearchToggle={() =>
                        setSearchEnabled((current) => !current)
                      }
                      selectedFiles={selectedFiles}
                      onRemoveFile={removeSelectedFile}
                      onFilesSelected={setFiles}
                      fileInputRef={fileInputRef}
                      inputRef={inputRef}
                      messagesCount={messages.length}
                      onClearChat={handleClearChat}
                      submitDisabled={submitDisabled}
                    />
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
