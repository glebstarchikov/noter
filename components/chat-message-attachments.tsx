import { FileText, Image as ImageIcon } from "lucide-react";
import type { UIMessage } from "ai";
import {
  getRenderableMessageAttachments,
  type ChatAttachmentMetadata,
  type RenderableChatAttachment,
} from "@/lib/chat/chat-attachments";

function isStoredAttachment(
  attachment: RenderableChatAttachment,
): attachment is ChatAttachmentMetadata {
  return "kind" in attachment;
}

function AttachmentChip({
  attachment,
}: {
  attachment: RenderableChatAttachment;
}) {
  const filename = isStoredAttachment(attachment)
    ? attachment.filename
    : attachment.filename || "attachment";
  const isImage = isStoredAttachment(attachment)
    ? attachment.kind === "image"
    : attachment.mediaType.startsWith("image/");

  return (
    <div className="liquid-glass-chip flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-muted-foreground">
      {isImage ? (
        <ImageIcon className="size-3.5" />
      ) : (
        <FileText className="size-3.5" />
      )}
      <span className="max-w-40 truncate">{filename}</span>
    </div>
  );
}

export function ChatMessageAttachments({ message }: { message: UIMessage }) {
  const attachments = getRenderableMessageAttachments(message);

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div
      className={
        message.role === "user"
          ? "flex max-w-[85%] self-end flex-wrap gap-2"
          : "flex max-w-[38rem] flex-wrap gap-2"
      }
    >
      {attachments.map((attachment, index) => (
        <AttachmentChip
          key={`${message.id}-attachment-${index}`}
          attachment={attachment}
        />
      ))}
    </div>
  );
}
