-- Processing jobs queue for server-orchestrated meeting pipeline
create table if not exists public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'retrying', 'completed', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  next_run_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  idempotency_key text not null,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint processing_jobs_meeting_id_key unique (meeting_id),
  constraint processing_jobs_idempotency_key_key unique (idempotency_key)
);

alter table public.processing_jobs enable row level security;

-- Users can only operate on jobs tied to their own user_id.
create policy "Users can view own processing jobs"
  on public.processing_jobs for select
  using (auth.uid() = user_id);

create policy "Users can insert own processing jobs"
  on public.processing_jobs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own processing jobs"
  on public.processing_jobs for update
  using (auth.uid() = user_id);

create policy "Users can delete own processing jobs"
  on public.processing_jobs for delete
  using (auth.uid() = user_id);

create index if not exists processing_jobs_user_id_idx
  on public.processing_jobs (user_id);

create index if not exists processing_jobs_status_next_run_idx
  on public.processing_jobs (status, next_run_at);
