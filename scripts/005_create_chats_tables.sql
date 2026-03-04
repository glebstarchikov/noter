create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New Chat',
  source_meeting_id uuid references public.meetings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chats enable row level security;

create policy "Users can view own chats"
  on public.chats for select
  using (auth.uid() = user_id);

create policy "Users can insert own chats"
  on public.chats for insert
  with check (auth.uid() = user_id);

create policy "Users can update own chats"
  on public.chats for update
  using (auth.uid() = user_id);

create policy "Users can delete own chats"
  on public.chats for delete
  using (auth.uid() = user_id);

create index if not exists chats_user_id_idx
  on public.chats (user_id);

create index if not exists chats_updated_at_desc_idx
  on public.chats (updated_at desc);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

create policy "Users can view own chat messages"
  on public.chat_messages for select
  using (auth.uid() = user_id);

create policy "Users can insert own chat messages"
  on public.chat_messages for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own chat messages"
  on public.chat_messages for delete
  using (auth.uid() = user_id);

create index if not exists chat_messages_chat_id_idx
  on public.chat_messages (chat_id);

create index if not exists chat_messages_chat_created_at_idx
  on public.chat_messages (chat_id, created_at asc);
