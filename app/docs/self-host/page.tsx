import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Self-host noter',
  description: 'Deploy noter on your own infrastructure with Vercel and Supabase.',
}

export default function SelfHostPage() {
  return (
    <div className="mx-auto max-w-[720px] px-6 py-16 text-foreground">
      <Link
        href="/"
        className="mb-8 inline-block text-[13px] text-muted-foreground hover:text-foreground"
      >
        ← Back to noter
      </Link>

      <h1
        className="mb-3 text-[32px] tracking-tight"
        style={{ fontWeight: 650 }}
      >
        Self-host noter
      </h1>
      <p className="mb-12 text-[15px] text-muted-foreground">
        Deploy noter on your own Vercel + Supabase stack. No custom
        infrastructure needed.
      </p>

      {/* Prerequisites */}
      <section className="mb-12">
        <h2 className="mb-4 text-[18px] font-semibold">Prerequisites</h2>
        <ul className="space-y-1.5 text-[14px] text-muted-foreground">
          <li>
            Node.js 18+ and{' '}
            <a
              href="https://bun.sh"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Bun
            </a>
          </li>
          <li>
            A{' '}
            <a
              href="https://supabase.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Supabase
            </a>{' '}
            account (free tier works)
          </li>
          <li>
            A{' '}
            <a
              href="https://vercel.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Vercel
            </a>{' '}
            account
          </li>
          <li>
            An{' '}
            <a
              href="https://platform.openai.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              OpenAI
            </a>{' '}
            API key
          </li>
          <li>
            Optional: A{' '}
            <a
              href="https://deepgram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Deepgram
            </a>{' '}
            API key for real-time transcription
          </li>
        </ul>
      </section>

      {/* Step-by-step */}
      <section className="mb-12">
        <h2 className="mb-6 text-[18px] font-semibold">Step-by-step</h2>
        <ol className="space-y-8 text-[14px]">
          <li>
            <div className="mb-2 font-semibold">1. Fork and clone</div>
            <pre className="overflow-x-auto rounded-xl bg-foreground p-4 font-mono text-[12px] text-[#a8b4a0]">
              <code>{`git clone https://github.com/glebstar06/noter
cd noter
bun install`}</code>
            </pre>
          </li>
          <li>
            <div className="mb-2 font-semibold">
              2. Set up environment variables
            </div>
            <p className="mb-2 text-muted-foreground">
              Copy the example and fill in your keys:
            </p>
            <pre className="overflow-x-auto rounded-xl bg-foreground p-4 font-mono text-[12px] text-[#a8b4a0]">
              <code>cp .env.example .env.local</code>
            </pre>
            <p className="mt-2 text-muted-foreground">
              See the{' '}
              <a href="#env-vars" className="text-accent hover:underline">
                environment variable reference
              </a>{' '}
              below for all required and optional keys.
            </p>
          </li>
          <li>
            <div className="mb-2 font-semibold">3. Run Supabase migrations</div>
            <p className="mb-2 text-muted-foreground">
              In your Supabase dashboard, go to the SQL editor and run each
              migration file in order:
            </p>
            <pre className="overflow-x-auto rounded-xl bg-foreground p-4 font-mono text-[12px] text-[#a8b4a0]">
              <code>{`scripts/001_initial.sql  → run first
scripts/002_*.sql
... (run each in ascending order)
scripts/010_drop_note_templates.sql  → run last`}</code>
            </pre>
          </li>
          <li>
            <div className="mb-2 font-semibold">4. Verify locally</div>
            <pre className="overflow-x-auto rounded-xl bg-foreground p-4 font-mono text-[12px] text-[#a8b4a0]">
              <code>bun dev</code>
            </pre>
            <p className="mt-2 text-muted-foreground">
              Open{' '}
              <span className="font-mono text-foreground">
                http://localhost:3000
              </span>
              . Sign up with email — Supabase sends a confirmation link.
            </p>
          </li>
          <li>
            <div className="mb-2 font-semibold">5. Deploy to Vercel</div>
            <p className="text-muted-foreground">
              Push your fork to GitHub, then import it into Vercel. Add all
              environment variables from{' '}
              <span className="font-mono text-foreground">.env.local</span> in
              the Vercel dashboard under{' '}
              <em>Settings → Environment Variables</em>. Framework preset:{' '}
              <strong>Next.js</strong>.
            </p>
          </li>
        </ol>
      </section>

      {/* Env var reference */}
      <section className="mb-12" id="env-vars">
        <h2 className="mb-4 text-[18px] font-semibold">
          Environment variable reference
        </h2>
        <div className="overflow-hidden rounded-xl border border-border text-[13px]">
          <table className="w-full">
            <thead className="bg-card">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Variable</th>
                <th className="px-4 py-3 text-left font-medium">Required</th>
                <th className="px-4 py-3 text-left font-medium">
                  Where to get it
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(
                [
                  [
                    'NEXT_PUBLIC_SUPABASE_URL',
                    'Yes',
                    'Supabase project → Settings → API',
                  ],
                  [
                    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
                    'Yes',
                    'Supabase project → Settings → API',
                  ],
                  ['OPENAI_API_KEY', 'Yes', 'platform.openai.com/api-keys'],
                  [
                    'DEEPGRAM_API_KEY',
                    'For live transcription',
                    'console.deepgram.com',
                  ],
                  [
                    'DEEPGRAM_PROJECT_ID',
                    'For live transcription',
                    'console.deepgram.com → project settings',
                  ],
                  [
                    'UPSTASH_REDIS_REST_URL',
                    'For rate limiting',
                    'console.upstash.com',
                  ],
                  [
                    'UPSTASH_REDIS_REST_TOKEN',
                    'For rate limiting',
                    'console.upstash.com',
                  ],
                  [
                    'NEXT_PUBLIC_SENTRY_DSN',
                    'Optional',
                    'sentry.io → project → settings',
                  ],
                  ['TAVILY_API_KEY', 'Optional', 'app.tavily.com'],
                  [
                    'NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL',
                    'Local dev only',
                    'Set to http://localhost:3000/auth/callback',
                  ],
                ] as [string, string, string][]
              ).map(([name, required, where]) => (
                <tr key={name}>
                  <td className="px-4 py-3 font-mono text-[12px] text-foreground">
                    {name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{required}</td>
                  <td className="px-4 py-3 text-muted-foreground">{where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Troubleshooting */}
      <section>
        <h2 className="mb-4 text-[18px] font-semibold">Troubleshooting</h2>
        <div className="space-y-6 text-[14px]">
          <div>
            <h3 className="mb-1 font-semibold">
              Auth redirect doesn&apos;t work locally
            </h3>
            <p className="text-muted-foreground">
              Set{' '}
              <span className="font-mono text-foreground">
                NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/auth/callback
              </span>{' '}
              in{' '}
              <span className="font-mono text-foreground">.env.local</span>.
              Also add{' '}
              <span className="font-mono text-foreground">
                http://localhost:3000/**
              </span>{' '}
              to your Supabase project&apos;s allowed redirect URLs.
            </p>
          </div>
          <div>
            <h3 className="mb-1 font-semibold">
              Supabase RLS blocks all reads
            </h3>
            <p className="text-muted-foreground">
              Make sure you ran all migrations — they include the RLS policies.
              If you created tables manually, verify that{' '}
              <span className="font-mono text-foreground">
                ALTER TABLE ... ENABLE ROW LEVEL SECURITY
              </span>{' '}
              ran and the appropriate{' '}
              <span className="font-mono text-foreground">CREATE POLICY</span>{' '}
              statements exist.
            </p>
          </div>
          <div>
            <h3 className="mb-1 font-semibold">
              Deepgram transcription doesn&apos;t start
            </h3>
            <p className="text-muted-foreground">
              You need both{' '}
              <span className="font-mono text-foreground">
                DEEPGRAM_API_KEY
              </span>{' '}
              and{' '}
              <span className="font-mono text-foreground">
                DEEPGRAM_PROJECT_ID
              </span>{' '}
              set. Without a project ID, noter falls back to returning the raw
              API key in the browser — insecure in production. Check Vercel
              function logs for the{' '}
              <span className="font-mono text-foreground">
                /api/transcribe/realtime-token
              </span>{' '}
              route.
            </p>
          </div>
          <div>
            <h3 className="mb-1 font-semibold">
              CORS errors when calling API routes
            </h3>
            <p className="text-muted-foreground">
              This typically means{' '}
              <span className="font-mono text-foreground">
                NEXT_PUBLIC_SUPABASE_URL
              </span>{' '}
              is wrong, or the Supabase project&apos;s CORS settings don&apos;t
              include your Vercel domain. Go to Supabase → Settings → API and
              add your Vercel deployment URL to the allowed origins.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
