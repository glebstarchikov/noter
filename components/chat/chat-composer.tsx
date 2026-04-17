"use client";

import { AlertCircle, Check, ChevronDown, Loader2, MoreHorizontal, Paperclip, Search, Send } from "lucide-react";
import type { ChatModelId } from "@/lib/ai-models";
import { getActiveContextLabel, getComposerPrompt, getContextDescription, getErrorMessage } from "@/lib/chat/chat-ui-helpers";
import type { ChatSurfaceScope } from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChatModelSelector } from "@/components/chat/chat-model-selector";
import { ChatAttachmentPreview } from "@/components/chat/chat-attachment-preview";

function ContextChip({ label }: { label: string }) {
  return (
    <div className="liquid-glass-context-chip flex items-center rounded-full px-3 py-1.5 text-xs font-medium text-foreground">
      {label}
    </div>
  );
}

interface ChatComposerProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (text: string) => void;
  onFocus: () => void;
  isLoading: boolean;
  error: Error | undefined;
  activeScope: ChatSurfaceScope;
  allowGlobalToggle: boolean;
  onScopeChange: (scope: "meeting" | "global") => void;
  model: ChatModelId;
  onModelChange: (model: ChatModelId) => void;
  searchEnabled: boolean;
  onSearchToggle: () => void;
  selectedFiles: File[];
  onRemoveFile: (index: number) => void;
  onFilesSelected: (files: FileList) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  messagesCount: number;
  onClearChat: () => void;
  submitDisabled: boolean;
}

export function ChatComposer({
  input,
  onInputChange,
  onSubmit,
  onFocus,
  isLoading,
  error,
  activeScope,
  allowGlobalToggle,
  onScopeChange,
  model,
  onModelChange,
  searchEnabled,
  onSearchToggle,
  selectedFiles,
  onRemoveFile,
  onFilesSelected,
  fileInputRef,
  inputRef,
  messagesCount,
  onClearChat,
  submitDisabled,
}: ChatComposerProps) {
  const canAttach = activeScope !== "support";
  const canUseTools = activeScope !== "support";
  const canShowContext = activeScope !== "support";
  const showContextRow = selectedFiles.length > 0;
  const activeContextLabel = getActiveContextLabel(activeScope);
  const errorMessage = getErrorMessage(error);
  const prompt = getComposerPrompt(activeScope);

  return (
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
          onSubmit(input);
        }}
      >
        <InputGroup className="liquid-glass-input h-auto rounded-[26px] border-border/60 shadow-none">
          {showContextRow ? (
            <div className="flex w-full flex-wrap gap-2 px-4 pt-4 pb-0">
              {canShowContext ? (
                <ContextChip label={activeContextLabel} />
              ) : null}
              <ChatAttachmentPreview
                attachments={selectedFiles}
                onRemove={onRemoveFile}
              />
            </div>
          ) : null}

          <InputGroupTextarea
            ref={inputRef}
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            onFocus={onFocus}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSubmit(input);
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
                          {selectedFiles.length === 1 ? "file" : "files"}
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
                              activeScope === "meeting" ? "meeting" : "global"
                            }
                            onValueChange={(value) => {
                              if (value === "meeting" || value === "global") {
                                onScopeChange(value);
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
                      onFilesSelected(event.target.files);
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
                  onClick={onSearchToggle}
                  className="liquid-glass-control border border-border/40"
                >
                  <Search data-icon="inline-start" />
                  Search web
                  {searchEnabled ? (
                    <Check data-icon="inline-end" />
                  ) : null}
                </InputGroupButton>

                <ChatModelSelector
                  model={model}
                  onModelChange={onModelChange}
                />
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
                  disabled={messagesCount === 0}
                  onSelect={() => onClearChat()}
                >
                  Clear conversation
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger asChild>
                <InputGroupButton
                  type="submit"
                  variant="primary"
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
              <TooltipContent side="top">Send message</TooltipContent>
            </Tooltip>
          </InputGroupAddon>
        </InputGroup>
      </form>
    </div>
  );
}
