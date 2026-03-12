# Database & Data Model

> Read this file when writing SQL, creating migrations, querying Supabase, or working with the data model.

---

## Tables

### `meetings`
- `id`, `user_id`, `title`, `audio_url`, `audio_duration`
- `transcript`, `summary`, `detailed_notes` (nullable text)
- `action_items`, `key_decisions`, `topics`, `follow_ups` (JSONB arrays)
- `document_content` (JSONB — Tiptap editor document)
- `template_id` (references `note_templates`)
- `diarized_transcript` (JSONB array of `DiarizedSegment`)
- `status` (`MeetingStatus`), `error_message`
- `is_pinned` (boolean, default false)
- `enhancement_status`, `enhancement_state` (JSONB)
- RLS enabled.

### `meeting_sources`
- `id`, `meeting_id`, `user_id`, `name`, `file_type`, `content`
- Cascade deletes. RLS enabled.

### `processing_jobs`
- Async processing queue; see `scripts/004_create_processing_jobs_table.sql`.

### `note_templates`
- Custom user note templates; see `app/api/note-templates/`.

### `meeting-audio` storage bucket (private)
- Path: `{user_id}/{meeting_id}.{ext}`

---

## Schema Changes

Add a new numbered SQL script in `scripts/` (e.g., `006_*.sql`). Keep app code backward-compatible until applied.

**Applied migrations:** `001` → `005` (meetings table, storage bucket, sources, processing jobs, is_pinned column).

---

## Supabase Client Selection

| Context | Import |
|---|---|
| Client component | `@/lib/supabase/client` |
| Server component / API route | `@/lib/supabase/server` |
| Middleware session refresh | `@/lib/supabase/proxy` |
| Admin / privileged ops | `@/lib/supabase/admin` |

Never cross-use server vs. client Supabase clients.

---

## Ownership Enforcement

Every server-side query must scope to the authenticated user:
```typescript
.eq('user_id', user.id)
```
Never skip this. RLS is a safety net, not a substitute.
