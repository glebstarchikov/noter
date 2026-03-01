-- Meetings table stores all meeting data
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled Meeting',
  audio_url text,
  audio_duration integer,
  transcript text,
  summary text,
  detailed_notes text,
  action_items jsonb default '[]'::jsonb,
  key_decisions jsonb default '[]'::jsonb,
  topics jsonb default '[]'::jsonb,
  follow_ups jsonb default '[]'::jsonb,
  status text not null default 'recording' check (status in ('recording', 'uploading', 'transcribing', 'generating', 'done', 'error')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.meetings enable row level security;

-- RLS policies: users can only access their own meetings
create policy "Users can view own meetings" on public.meetings for select using (auth.uid() = user_id);
create policy "Users can insert own meetings" on public.meetings for insert with check (auth.uid() = user_id);
create policy "Users can update own meetings" on public.meetings for update using (auth.uid() = user_id);
create policy "Users can delete own meetings" on public.meetings for delete using (auth.uid() = user_id);

-- Indexes for fast queries
create index if not exists meetings_user_id_idx on public.meetings(user_id);
create index if not exists meetings_created_at_idx on public.meetings(created_at desc);
