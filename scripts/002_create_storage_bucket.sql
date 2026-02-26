-- Create audio storage bucket (private)
insert into storage.buckets (id, name, public)
values ('meeting-audio', 'meeting-audio', false)
on conflict (id) do nothing;

-- RLS policies for storage: users can only manage files in their own folder
create policy "Users can upload own audio" on storage.objects for insert with check (
  bucket_id = 'meeting-audio' and auth.uid() = owner
);

create policy "Users can view own audio" on storage.objects for select using (
  bucket_id = 'meeting-audio' and auth.uid() = owner
);

create policy "Users can update own audio" on storage.objects for update using (
  bucket_id = 'meeting-audio' and auth.uid() = owner
);

create policy "Users can delete own audio" on storage.objects for delete using (
  bucket_id = 'meeting-audio' and auth.uid() = owner
);
