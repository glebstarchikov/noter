"use client";

import { useMemo, useState } from "react";
import {
  useAssistantShellContextSafe,
  type AssistantShellMode,
} from "@/components/assistant-shell-context";
import type { ChatSurfaceScope } from "@/lib/types";
import { useChatSession } from "@/hooks/use-chat-session";
import { ChatShell } from "@/components/chat/chat-shell";
import { ChatMessageList } from "@/components/chat/chat-message-list";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatTranscriptContent } from "@/components/chat/chat-transcript-content";

/* ------------------------------------------------------------------ */
/*  ChatBar                                                            */
/* ------------------------------------------------------------------ */

interface ChatBarProps {
  authenticated: boolean;
  allowGlobalToggle?: boolean;
  defaultScope: ChatSurfaceScope;
  meetingId?: string | null;
  reserveInFlow?: boolean;
  transcriptBubble?: React.ReactNode;
}

export function ChatBar({
  authenticated,
  allowGlobalToggle = false,
  defaultScope,
  meetingId,
  reserveInFlow = true,
  transcriptBubble,
}: ChatBarProps) {
  const shellContext = useAssistantShellContextSafe();

  /* ---- Mode (falls back to local state outside provider) ---- */

  const [localMode, setLocalMode] = useState<AssistantShellMode>("collapsed");
  const mode = shellContext?.mode ?? localMode;
  const setMode = shellContext?.setMode ?? setLocalMode;
  const isExpanded = mode === "chat" || mode === "transcript";

  /* ---- Chat session ---- */

  const chat = useChatSession({ authenticated, defaultScope, meetingId });

  /* ---- Transcript data from meeting context ---- */

  const meetingCtx = shellContext?.meetingContext;
  const transcriptSegments = useMemo(
    () => meetingCtx?.transcriptSegments ?? [],
    [meetingCtx?.transcriptSegments],
  );
  const transcriptText = meetingCtx?.transcriptText ?? "";
  const isLive = meetingCtx?.live ?? false;

  /* ---- Render ---- */

  return (
    <ChatShell
      mode={mode}
      setMode={setMode}
      isExpanded={isExpanded}
      reserveInFlow={reserveInFlow}
      transcriptBubble={transcriptBubble}
      dockPrompt={chat.prompt}
      inputRef={chat.inputRef}
      endRef={chat.endRef}
      messages={chat.messages}
      status={chat.status}
    >
      {({ visibleMode, collapse }) => {
        const isTranscriptMode = visibleMode === "transcript";

        if (isTranscriptMode) {
          return (
            <ChatTranscriptContent
              isLive={isLive}
              transcriptSegments={transcriptSegments}
              transcriptText={transcriptText}
              onClose={collapse}
            />
          );
        }

        return (
          <div className="flex min-h-0 flex-1 flex-col">
            <ChatMessageList
              messages={chat.messages}
              status={chat.status}
              starterPrompts={chat.starterPrompts}
              onStarterPrompt={chat.handleStarterPrompt}
              onCollapse={collapse}
              endRef={chat.endRef}
            />

            <ChatComposer
              input={chat.input}
              onInputChange={chat.setInput}
              onSubmit={chat.handleSubmit}
              onFocus={() => setMode("chat")}
              isLoading={chat.isLoading}
              error={chat.error}
              activeScope={chat.activeScope}
              allowGlobalToggle={allowGlobalToggle}
              onScopeChange={chat.setActiveScope}
              searchEnabled={chat.searchEnabled}
              onSearchToggle={() =>
                chat.setSearchEnabled((current) => !current)
              }
              selectedFiles={chat.selectedFiles}
              onRemoveFile={chat.removeSelectedFile}
              onFilesSelected={chat.setFiles}
              fileInputRef={chat.fileInputRef}
              inputRef={chat.inputRef}
              messagesCount={chat.messages.length}
              onClearChat={chat.handleClearChat}
              submitDisabled={chat.submitDisabled}
            />
          </div>
        );
      }}
    </ChatShell>
  );
}
