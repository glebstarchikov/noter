# noter

> AI meeting notes, on your own terms.

[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/glebstarchikov/noter)

Record, transcribe, and generate structured meeting notes with AI. Self-host on Vercel + Supabase in under 10 minutes.

## What it does

- **Real-time transcription** — Deepgram-powered live transcript with speaker diarization
- **AI-generated notes** — One click turns your transcript into structured notes with action items, summaries, and key decisions
- **Fully self-hostable** — Runs on Vercel + Supabase; your meetings stay on your infrastructure

## Tech stack

- **Frontend** — Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Tiptap 3
- **Backend** — Supabase (Postgres + Auth + RLS), Vercel serverless functions
- **AI** — OpenAI via Vercel AI SDK (AI Gateway supported)
- **Transcription** — Deepgram real-time WebSocket

## Self-host quickstart

1. Fork this repo and clone it: `git clone https://github.com/glebstarchikov/noter && cd noter`
2. Install dependencies: `bun install`
3. Copy env vars: `cp .env.example .env.local` and fill in your keys (see `.env.example`)
4. Run Supabase migrations: execute `scripts/001_*.sql` through `scripts/010_*.sql` in the Supabase SQL editor in order
5. Start the dev server: `bun dev` — open [http://localhost:3000](http://localhost:3000)
6. Deploy: push to GitHub, import into Vercel, add env vars, deploy

Full guide: [/docs/self-host](/docs/self-host)

## Development

```bash
bun install       # install dependencies
bun dev           # start dev server at localhost:3000
bun run build     # production build
bun run typecheck # TypeScript check
bun run lint      # ESLint
bun test          # run tests
```

## Contributing

Issues and PRs welcome. Open an issue first for major changes.

## License

[MIT](LICENSE) — © 2026 Gleb Starcikov
