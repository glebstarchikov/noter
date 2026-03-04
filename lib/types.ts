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

export interface MeetingSource {
  id: string
  meeting_id: string
  user_id: string
  name: string
  file_type: string
  content: string
  created_at: string
}
