-- Add is_pinned flag to meetings
alter table public.meetings add column if not exists is_pinned boolean not null default false;

-- Index for efficient pinned-first sorting per user
create index if not exists meetings_user_pinned_idx on public.meetings(user_id, is_pinned desc, created_at desc);
