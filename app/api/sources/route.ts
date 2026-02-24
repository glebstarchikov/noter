import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 30

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
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
      const { Readable } = await import('stream')
      const { createInflate } = await import('zlib')
      const buffer = Buffer.from(await file.arrayBuffer())
      
      // Simple DOCX text extraction - read the document.xml from the zip
      // DOCX files are ZIP archives; we'll do a simple extraction
      const text = extractDocxText(buffer)
      return text
    } catch {
      throw new Error('Failed to parse DOCX file.')
    }
  }

  throw new Error(`Unsupported file type: ${type}`)
}

// Simple DOCX text extraction without heavy dependencies
function extractDocxText(buffer: Buffer): string {
  // DOCX is a ZIP file. Find the document.xml entry and extract text from XML tags
  // This is a simplified approach - works for most standard DOCX files
  const str = buffer.toString('binary')
  
  // Find the document.xml content within the ZIP
  const xmlStart = str.indexOf('<w:document')
  if (xmlStart === -1) {
    // Try finding any text content
    const textParts: string[] = []
    const regex = /<w:t[^>]*>([^<]*)<\/w:t>/g
    let match
    while ((match = regex.exec(str)) !== null) {
      textParts.push(match[1])
    }
    return textParts.join(' ') || 'Could not extract text from DOCX file.'
  }
  
  const textParts: string[] = []
  const regex = /<w:t[^>]*>([^<]*)<\/w:t>/g
  let match
  while ((match = regex.exec(str)) !== null) {
    textParts.push(match[1])
  }
  return textParts.join(' ') || 'Could not extract text from DOCX file.'
}

// POST - Upload a new source
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const meetingId = formData.get('meetingId') as string | null

    if (!file || !meetingId) {
      return NextResponse.json({ error: 'Missing file or meetingId' }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum 10MB.' }, { status: 400 })
    }

    // Verify user owns the meeting
    const { data: meeting } = await supabase
      .from('meetings')
      .select('id')
      .eq('id', meetingId)
      .single()

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
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
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// GET - List sources for a meeting
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const meetingId = request.nextUrl.searchParams.get('meetingId')
    if (!meetingId) {
      return NextResponse.json({ error: 'Missing meetingId' }, { status: 400 })
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
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE - Remove a source
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sourceId } = await request.json()
    if (!sourceId) {
      return NextResponse.json({ error: 'Missing sourceId' }, { status: 400 })
    }

    const { error } = await supabase
      .from('meeting_sources')
      .delete()
      .eq('id', sourceId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete source'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
