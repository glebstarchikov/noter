-- Add persistent enhancement session state to meetings
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS enhancement_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS enhancement_state jsonb;
