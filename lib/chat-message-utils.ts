import { convertToModelMessages, type ModelMessage, type UIMessage } from 'ai'
import {
  decodeDataUrl,
  extractTextFromBuffer,
  isDocumentAttachment,
  isImageAttachment,
} from '@/lib/file-text'

type FileLikePart = {
  type: 'file'
  filename?: string
  mediaType?: string
  url?: string
}

type TextLikePart = {
  type: 'text'
  text: string
}

function isFileLikePart(part: unknown): part is FileLikePart {
  return Boolean(part && typeof part === 'object' && (part as FileLikePart).type === 'file')
}

function isTextLikePart(part: unknown): part is TextLikePart {
  return Boolean(
    part &&
    typeof part === 'object' &&
    (part as TextLikePart).type === 'text' &&
    typeof (part as TextLikePart).text === 'string'
  )
}

export function getMessageText(message: UIMessage) {
  if (!Array.isArray(message.parts)) return ''

  return message.parts
    .filter(isTextLikePart)
    .map((part) => part.text)
    .join('\n')
}

export function getLastUserText(messages: UIMessage[]) {
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user')

  return lastUserMessage ? getMessageText(lastUserMessage) : ''
}

export async function buildChatModelMessages(messages: UIMessage[]): Promise<ModelMessage[]> {
  const normalizedMessages = await Promise.all(
    messages.map(async (message) => {
      const normalizedParts = await Promise.all(
        (message.parts ?? []).map(async (part) => {
          if (!isFileLikePart(part)) {
            return part
          }

          const filename = part.filename || 'attachment'
          const mediaType = part.mediaType || ''

          if (isImageAttachment(mediaType)) {
            return part
          }

          if (part.url && isDocumentAttachment(mediaType, filename)) {
            try {
              const { buffer } = decodeDataUrl(part.url)
              const extractedText = await extractTextFromBuffer(buffer, filename, mediaType)
              return {
                type: 'text',
                text: `Attachment: ${filename}\n${extractedText}`,
              }
            } catch {
              return {
                type: 'text',
                text: `Attachment: ${filename}\n[Attachment could not be parsed.]`,
              }
            }
          }

          return {
            type: 'text',
            text: `Attachment: ${filename}`,
          }
        })
      )

      return {
        ...message,
        parts: normalizedParts,
      }
    })
  )

  return convertToModelMessages(
    normalizedMessages.map(({ id: _id, ...message }) => message)
  )
}
