import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse, requireUser } from '@/lib/server/api/route-helpers'
import { z } from 'zod'

export const maxDuration = 30

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}

const deleteSourceSchema = z.object({
  sourceId: z.string().trim().min(1),
})

function isFileLike(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === 'object' &&
    value !== null &&
    'arrayBuffer' in value &&
    'name' in value
  )
}

async function extractTextFromFile(file: File): Promise<string> {
  const type = file.type || ''

  // Plain text / markdown
  if (type === 'text/plain' || type === 'text/markdown' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
    return await file.text()
  }

  // PDF
  if (type === 'application/pdf' || file.name.endsWith('.pdf')) {
    try {
      const pdfParse = (await import('pdf-parse')).default
      const buffer = Buffer.from(await file.arrayBuffer())
      const data = await pdfParse(buffer)
      return data.text
    } catch {
      throw new Error('Failed to parse PDF. The file may be corrupted or password-protected.')
    }
  }

  // DOCX - extract raw text from the XML inside the zip
  if (type.includes('wordprocessingml') || file.name.endsWith('.docx')) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      const text = await extractDocxText(buffer)
      return text
    } catch {
      throw new Error('Failed to parse DOCX file.')
    }
  }

  throw new Error(`Unsupported file type: ${type}`)
}

// Extract text from DOCX by decompressing the ZIP and parsing word/document.xml
async function extractDocxText(buffer: Buffer): Promise<string> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(buffer)
  const docXml = zip.file('word/document.xml')
  if (!docXml) {
    throw new Error('Invalid DOCX: missing word/document.xml')
  }
  const xmlContent = await docXml.async('text')
  const textParts: string[] = []
  const regex = /<w:t[^>]*>([^<]*)<\/w:t>/g
  let match
  while ((match = regex.exec(xmlContent)) !== null) {
    textParts.push(match[1])
  }
  if (textParts.length === 0) {
    return 'Could not extract text from DOCX file.'
  }
  return textParts.join(' ')
}

// POST - Upload a new source
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const authResult = await requireUser(supabase)
    if ('response' in authResult) {
      return authResult.response
    }
    const { user } = authResult

    const formData = await request.formData()
    const fileEntry = formData.get('file')
    const meetingIdEntry = formData.get('meetingId')
    const file = isFileLike(fileEntry) ? fileEntry : null
    const meetingId = typeof meetingIdEntry === 'string' ? meetingIdEntry : null

    if (!file || !meetingId || meetingId.trim().length === 0) {
      return errorResponse('Missing file or meetingId', 'INVALID_REQUEST', 400)
    }

    const hasAllowedMime = file.type && Object.keys(ALLOWED_TYPES).includes(file.type)
    const hasAllowedExtension = /\.(pdf|txt|md|docx)$/i.test(file.name)
    if (!hasAllowedMime && !hasAllowedExtension) {
      return errorResponse('Unsupported file type', 'UNSUPPORTED_FILE_TYPE', 400)
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return errorResponse('File too large. Maximum 10MB.', 'FILE_TOO_LARGE', 400)
    }

    // Verify user owns the meeting
    const { data: meeting } = await supabase
      .from('meetings')
      .select('id')
      .eq('id', meetingId)
      .eq('user_id', user.id)
      .single()

    if (!meeting) {
      return errorResponse('Meeting not found', 'MEETING_NOT_FOUND', 404)
    }

    // Extract text from file
    const content = await extractTextFromFile(file)
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'txt'

    // Save source to database
    const { data: source, error } = await supabase
      .from('meeting_sources')
      .insert({
        meeting_id: meetingId,
        user_id: user.id,
        name: file.name,
        file_type: fileExt,
        content,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ source })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Source upload failed'
    return errorResponse(message, 'SOURCE_UPLOAD_FAILED', 500)
  }
}

// GET - List sources for a meeting
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const authResult = await requireUser(supabase)
    if ('response' in authResult) {
      return authResult.response
    }
    const { user } = authResult

    const meetingId = request.nextUrl.searchParams.get('meetingId')
    if (!meetingId || meetingId.trim().length === 0) {
      return errorResponse('Missing meetingId', 'INVALID_REQUEST', 400)
    }

    // Verify user owns the meeting
    const { data: meeting } = await supabase
      .from('meetings')
      .select('id')
      .eq('id', meetingId)
      .eq('user_id', user.id)
      .single()

    if (!meeting) {
      return errorResponse('Meeting not found', 'MEETING_NOT_FOUND', 404)
    }

    const { data: sources, error } = await supabase
      .from('meeting_sources')
      .select('id, name, file_type, created_at')
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ sources: sources || [] })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch sources'
    return errorResponse(message, 'SOURCES_FETCH_FAILED', 500)
  }
}

// DELETE - Remove a source
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const authResult = await requireUser(supabase)
    if ('response' in authResult) {
      return authResult.response
    }
    const { user } = authResult

    const rawBody = await request.json().catch(() => null)
    const parsedBody = deleteSourceSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return errorResponse('Invalid request body', 'INVALID_REQUEST', 400)
    }
    const { sourceId } = parsedBody.data

    const { error } = await supabase
      .from('meeting_sources')
      .delete()
      .eq('id', sourceId)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete source'
    return errorResponse(message, 'SOURCE_DELETE_FAILED', 500)
  }
}
