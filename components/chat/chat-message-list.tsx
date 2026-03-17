"use client";

import type { UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { X } from "lucide-react";
import { ChatMessageAttachments } from "@/components/chat-message-attachments";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getMessageText } from "@/lib/chat-ui-helpers";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Internal sub-components                                            */
/* ------------------------------------------------------------------ */

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
/*  ChatMessageList                                                    */
/* ------------------------------------------------------------------ */

interface ChatMessageListProps {
  messages: UIMessage[];
  status: string;
  starterPrompts: string[];
  onStarterPrompt: (prompt: string) => void;
  onCollapse: () => void;
  endRef: React.RefObject<HTMLDivElement | null>;
}

export function ChatMessageList({
  messages,
  status,
  starterPrompts,
  onStarterPrompt,
  onCollapse,
  endRef,
}: ChatMessageListProps) {
  const isLoading = status === "submitted" || status === "streaming";
  const isStreaming = status === "streaming";

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost-icon"
            size="icon-sm"
            onClick={onCollapse}
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
                    onClick={() => onStarterPrompt(starterPrompt)}
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
                    {isStreaming ? "Writing a response..." : "Thinking..."}
                  </div>
                </div>
              ) : null}

              <div ref={endRef} />
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
