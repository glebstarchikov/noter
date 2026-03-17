-- User-managed note templates
CREATE TABLE IF NOT EXISTS public.note_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  prompt      text NOT NULL,
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.note_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own templates"
  ON public.note_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own templates"
  ON public.note_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates"
  ON public.note_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
  ON public.note_templates FOR DELETE
  USING (auth.uid() = user_id);

-- Enforce at most one default per user
CREATE UNIQUE INDEX IF NOT EXISTS note_templates_one_default_per_user
  ON public.note_templates (user_id)
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS note_templates_user_id_idx
  ON public.note_templates (user_id);
