-- Phase 1.5 Task 3: drop unused processing_jobs table
-- The table was used by the /api/processing/worker queue infrastructure
-- (self-host fallback for background job retries). That infrastructure is
-- being removed; self-host users now use the same direct /api/generate-notes
-- path as SaaS.

drop table if exists public.processing_jobs cascade;
