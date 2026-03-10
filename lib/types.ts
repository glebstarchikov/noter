export interface Meeting {
  id: string
  user_id: string
  title: string
  audio_url: string | null
  audio_duration: number | null
  transcript: string | null
  summary: string | null
  action_items: ActionItem[]
  key_decisions: string[]
  topics: string[]
  follow_ups: string[]
  detailed_notes: string | null
  status: MeetingStatus
  error_message: string | null
  is_pinned: boolean
  document_content: Record<string, unknown> | null
  template_id: string | null
  diarized_transcript: DiarizedSegment[] | null
  enhancement_status: EnhancementStatus
  enhancement_state: EnhancementState | null
  created_at: string
  updated_at: string
}

export interface DiarizedSegment {
  speaker: string
  start: number
  end: number
  text: string
}

export interface NoteTemplate {
  id: string
  name: string
  description: string
  prompt: string
  isBuiltin: boolean
  isDefault?: boolean
}

export interface CustomNoteTemplate {
  id: string
  user_id: string
  name: string
  description: string | null
  prompt: string
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface ActionItem {
  task: string
  owner: string | null
  done: boolean
}

export type MeetingStatus =
  | 'recording'
  | 'uploading'
  | 'transcribing'
  | 'generating'
  | 'done'
  | 'error'

export type EnhancementStatus =
  | 'idle'
  | 'error'

export type EnhancementOutcome = 'accepted' | 'dismissed'

export interface EnhancementState {
  lastReviewedSourceHash: string | null
  lastOutcome: EnhancementOutcome | null
  lastReviewedAt: string | null
  lastError: string | null
}

export interface MeetingSource {
  id: string
  meeting_id: string
  user_id: string
  name: string
  file_type: string
  content: string
  created_at: string
}
