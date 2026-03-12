# Application Architecture

> Read this file when working on the processing pipeline, meeting status flow, async jobs, or chat storage.

---

## Meeting Status Lifecycle

```
recording → uploading → transcribing → generating → done
                                 ↘          ↘
                                   error ←←←←←
```

- Always transition **forward** or to `error`. Never skip steps or go backward.
- On any processing failure: set `status = 'error'` and `error_message` in the catch block.

---

## Async Processing System

1. `/api/meetings/[id]/process` — enqueues a job (`processing_jobs` table, requires `SUPABASE_SERVICE_ROLE_KEY`)
2. `/api/processing/worker` — background worker secured with `CRON_SECRET` bearer token
   - Lock-based concurrency (10-minute lock timeout), retry with exponential backoff
   - `MAX_TRANSCRIPT_CHARS = 400,000`
   - Skips Whisper transcription if `diarized_transcript` is already present

Client-side polling: `waitForMeetingCompletion()` in `lib/meeting-pipeline.ts`.

---

## Chat Storage

Persisted client-side via `lib/chat-storage.ts`:
- Per-meeting: key `noter-chat-{meetingId}`, capped at 50 messages
- Global: key `noter-chat-__global__`, same cap
- Do not store sensitive data or large payloads.

---

## Meeting Page States

The `/dashboard/[id]` page is a tri-state surface routed through `meeting-detail-wrapper.tsx`:
- `recording` → `MeetingRecordingView` (live recording with real-time Deepgram transcript)
- `uploading` / `transcribing` / `generating` → `ProcessingView` (progress polling)
- `done` / `error` → `MeetingDetail` (notes editor + chat + sources)
