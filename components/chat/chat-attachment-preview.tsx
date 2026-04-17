"use client";

import { FileText, Image as ImageIcon, X } from "lucide-react";
import type { FileUIPart } from "ai";

interface AttachmentChipProps {
  file: File | FileUIPart;
  onRemove?: () => void;
}

function AttachmentChip({ file, onRemove }: AttachmentChipProps) {
  const filename = "name" in file ? file.name : file.filename || "attachment";
  const mediaType = file instanceof File ? file.type : file.mediaType;
  const isImage = mediaType.startsWith("image/");

  return (
    <div className="bg-secondary border border-border flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-muted-foreground">
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

interface ChatAttachmentPreviewProps {
  attachments: File[];
  onRemove: (index: number) => void;
}

export function ChatAttachmentPreview({
  attachments,
  onRemove,
}: ChatAttachmentPreviewProps) {
  if (attachments.length === 0) return null;

  return (
    <>
      {attachments.map((file, index) => (
        <AttachmentChip
          key={`${file.name}-${index}`}
          file={file}
          onRemove={() => onRemove(index)}
        />
      ))}
    </>
  );
}
