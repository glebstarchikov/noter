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
import {
  clearStoredMessages,
  getComposerPrompt,
  getStoredMessages,
  saveStoredMessages,
} from "@/lib/chat/chat-ui-helpers";
import type { ChatSurfaceScope } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

export const STARTER_PROMPTS: Record<ChatSurfaceScope, string[]> = {
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
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface UseChatSessionParams {
  authenticated: boolean;
  defaultScope: ChatSurfaceScope;
  meetingId?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useChatSession({
  authenticated,
  defaultScope,
  meetingId,
}: UseChatSessionParams) {
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

  return {
    /* State */
    activeScope,
    setActiveScope,
    input,
    setInput,
    model,
    setModel,
    searchEnabled,
    setSearchEnabled,
    files,
    setFiles,
    messages,
    status,
    error,

    /* Derived */
    isLoading,
    selectedFiles,
    submitDisabled,
    prompt,
    starterPrompts,

    /* Refs */
    inputRef,
    fileInputRef,
    endRef,

    /* Handlers */
    handleClearChat,
    handleSubmit,
    handleStarterPrompt,
    removeSelectedFile,
  };
}
