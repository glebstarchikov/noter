-- Add document editor, template, and diarised transcript columns to meetings
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS document_content    jsonb,
  ADD COLUMN IF NOT EXISTS template_id         text,
  ADD COLUMN IF NOT EXISTS diarized_transcript jsonb;
