-- Meeting sources table stores attached documents for meetings
-- NOTE: This table was already manually created in the Supabase dashboard.
-- This script is kept for reference and reproducibility.

create table if not exists public.meeting_sources (
  id uuid not null default gen_random_uuid(),
  meeting_id uuid not null,
  user_id uuid not null,
  name text not null,
  file_type text not null,
  content text not null,
  created_at timestamptz not null default now(),
  constraint meeting_sources_pkey primary key (id),
  constraint meeting_sources_meeting_id_fkey foreign key (meeting_id) references public.meetings(id) on delete cascade,
  constraint meeting_sources_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

-- Enable Row Level Security
alter table public.meeting_sources enable row level security;

-- RLS policies: users can only access their own sources
create policy "Users can view own sources" on public.meeting_sources for select using (auth.uid() = user_id);
create policy "Users can insert own sources" on public.meeting_sources for insert with check (auth.uid() = user_id);
create policy "Users can delete own sources" on public.meeting_sources for delete using (auth.uid() = user_id);

-- Indexes
create index if not exists meeting_sources_meeting_id_idx on public.meeting_sources using btree (meeting_id);
