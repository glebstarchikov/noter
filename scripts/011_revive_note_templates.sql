-- Migration 011: revive note templates (custom per-user) and user preferences.
-- Built-in templates live in code (lib/note-template.ts) and are not stored here.

create table if not exists public.note_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  description text check (description is null or char_length(description) <= 200),
  prompt      text not null check (char_length(prompt) between 20 and 10000),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.note_templates enable row level security;

create policy "Users can select own templates"
  on public.note_templates for select
  using (auth.uid() = user_id);

create policy "Users can insert own templates"
  on public.note_templates for insert
  with check (auth.uid() = user_id);

create policy "Users can update own templates"
  on public.note_templates for update
  using (auth.uid() = user_id);

create policy "Users can delete own templates"
  on public.note_templates for delete
  using (auth.uid() = user_id);

create index if not exists note_templates_user_id_idx
  on public.note_templates (user_id);

-- user_preferences holds the user's default template id (built-in string or custom UUID).
-- Kept as `text` deliberately so it can reference either source.
create table if not exists public.user_preferences (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  default_template_id  text not null default 'builtin-general',
  updated_at           timestamptz default now()
);

alter table public.user_preferences enable row level security;

create policy "Users can select own preferences"
  on public.user_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert own preferences"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update own preferences"
  on public.user_preferences for update
  using (auth.uid() = user_id);
