import { isFileUIPart, type FileUIPart, type UIMessage } from 'ai'
import { isDocumentAttachment, isImageAttachment } from '@/lib/attachment-kind'

export type ChatAttachmentKind = 'image' | 'document' | 'file'

export interface ChatAttachmentMetadata {
  filename: string
  mediaType: string
  kind: ChatAttachmentKind
}

export interface ChatMessageMetadata {
  attachments?: ChatAttachmentMetadata[]
}

export type RenderableChatAttachment = FileUIPart | ChatAttachmentMetadata

function getAttachmentKind(mediaType: string, filename: string): ChatAttachmentKind {
  if (isImageAttachment(mediaType)) {
    return 'image'
  }

  if (isDocumentAttachment(mediaType, filename)) {
    return 'document'
  }

  return 'file'
}

function isChatAttachmentMetadata(value: unknown): value is ChatAttachmentMetadata {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as ChatAttachmentMetadata).filename === 'string' &&
    typeof (value as ChatAttachmentMetadata).mediaType === 'string' &&
    ((value as ChatAttachmentMetadata).kind === 'image' ||
      (value as ChatAttachmentMetadata).kind === 'document' ||
      (value as ChatAttachmentMetadata).kind === 'file')
  )
}

function getMetadataRecord(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return { ...(metadata as Record<string, unknown>) }
  }

  return {}
}

export function toChatAttachmentMetadata(
  attachment: File | FileUIPart
): ChatAttachmentMetadata {
  const filename =
    attachment instanceof File
      ? attachment.name
      : attachment.filename || 'attachment'
  const mediaType = attachment instanceof File ? attachment.type : attachment.mediaType

  return {
    filename,
    mediaType,
    kind: getAttachmentKind(mediaType, filename),
  }
}

export function getMessageAttachmentMetadata(message: UIMessage): ChatAttachmentMetadata[] {
  const metadata = getMetadataRecord(message.metadata)
  const attachments = metadata.attachments

  if (!Array.isArray(attachments)) {
    return []
  }

  return attachments.filter(isChatAttachmentMetadata)
}

export function setMessageAttachmentMetadata(
  message: UIMessage,
  attachments: ChatAttachmentMetadata[]
): UIMessage {
  const metadata = getMetadataRecord(message.metadata)

  if (attachments.length === 0) {
    delete metadata.attachments

    return {
      ...message,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    }
  }

  return {
    ...message,
    metadata: {
      ...metadata,
      attachments,
    } satisfies ChatMessageMetadata,
  }
}

export function getRenderableMessageAttachments(
  message: UIMessage
): RenderableChatAttachment[] {
  const fileParts = Array.isArray(message.parts)
    ? message.parts.filter(isFileUIPart)
    : []

  if (fileParts.length > 0) {
    return fileParts
  }

  return getMessageAttachmentMetadata(message)
}
