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
  status: MeetingStatus
  error_message: string | null
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
