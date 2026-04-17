-- Phase 2 Task 2: drop templates feature entirely
-- The templates feature was removed in Phase 2 (per the Workspace redesign spec §4.1).
-- User decision: drop both the table AND the meetings.template_id column (no historical data to preserve).

drop table if exists public.note_templates cascade;

-- Also drop the foreign key column from meetings — no longer referenced by any code.
alter table public.meetings drop column if exists template_id;
