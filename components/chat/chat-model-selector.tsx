"use client";

import { ChevronDown } from "lucide-react";
import {
  CHAT_MODEL_OPTIONS,
  getChatModelLabel,
  type ChatModelId,
} from "@/lib/ai-models";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroupButton } from "@/components/ui/input-group";

interface ChatModelSelectorProps {
  model: ChatModelId;
  onModelChange: (model: ChatModelId) => void;
}

export function ChatModelSelector({
  model,
  onModelChange,
}: ChatModelSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <InputGroupButton
          variant="ghost"
          size="sm"
          className="rounded-lg hover:bg-accent-soft"
        >
          {getChatModelLabel(model)}
          <ChevronDown data-icon="inline-end" />
        </InputGroupButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuRadioGroup
          value={model}
          onValueChange={(value) => onModelChange(value as ChatModelId)}
        >
          {CHAT_MODEL_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
