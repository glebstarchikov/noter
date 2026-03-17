import {
  convertToModelMessages,
  isFileUIPart,
  isTextUIPart,
  type ModelMessage,
  type TextUIPart,
  type UIMessage,
} from 'ai'
import {
  decodeDataUrl,
  extractTextFromBuffer,
} from '@/lib/file-text'
import { isDocumentAttachment, isImageAttachment } from '@/lib/attachment-kind'

type ChatUIPart = UIMessage['parts'][number]

function attachmentTextPart(filename: string, text: string): TextUIPart {
  return {
    type: 'text',
    text: `Attachment: ${filename}\n${text}`,
  }
}

export function getMessageText(message: UIMessage) {
  if (!Array.isArray(message.parts)) return ''

  return message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join('\n')
}

export function getLastUserText(messages: UIMessage[]) {
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user')

  return lastUserMessage ? getMessageText(lastUserMessage) : ''
}

async function normalizePart(part: ChatUIPart): Promise<ChatUIPart> {
  if (!isFileUIPart(part)) {
    return part
  }

  const filename = part.filename || 'attachment'

  if (isImageAttachment(part.mediaType)) {
    return part
  }

  if (isDocumentAttachment(part.mediaType, filename)) {
    try {
      const { buffer } = decodeDataUrl(part.url)
      const extractedText = await extractTextFromBuffer(buffer, filename, part.mediaType)
      return attachmentTextPart(filename, extractedText)
    } catch {
      return attachmentTextPart(filename, '[Attachment could not be parsed.]')
    }
  }

  return {
    type: 'text',
    text: `Attachment: ${filename}`,
  }
}

export async function buildChatModelMessages(messages: UIMessage[]): Promise<ModelMessage[]> {
  const normalizedMessages: Array<Omit<UIMessage, 'id'>> = await Promise.all(
    messages.map(async (message) => {
      const normalizedParts = await Promise.all((message.parts ?? []).map(normalizePart))

      return {
        role: message.role,
        metadata: message.metadata,
        parts: normalizedParts,
      }
    })
  )

  return convertToModelMessages(normalizedMessages)
}
