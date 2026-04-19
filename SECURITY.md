# Security Policy

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, email **glebstar06@gmail.com** with:

- A description of the vulnerability
- Steps to reproduce (if you can)
- The affected version / commit SHA
- Your assessment of impact (data exposure, RCE, auth bypass, etc.)

You'll get an acknowledgement within 72 hours. If the issue is confirmed:

- For critical issues (auth bypass, data leak, RCE): a fix will land within 7 days
- For lower-severity issues: a fix will land in the next regular release

We don't currently offer a bug bounty, but we'll credit you in the release notes if you'd like.

## Scope

In scope:

- Anything in this repository (`glebstarchikov/noter`)
- The reference deployment at [my-noter.vercel.app](https://my-noter.vercel.app)

Out of scope:

- Self-hosted instances run by third parties (not our infra; report to the operator)
- Bugs in dependencies — please report those upstream (we'll bump our version)
- Social engineering, physical access, denial-of-service via volume

## Self-hoster security checklist

If you self-host noter, please:

- **Set `DEEPGRAM_PROJECT_ID`** in production. Without it, the raw Deepgram API key is returned to the browser. With it, short-lived (5 min, scoped) keys are minted per session.
- **Enable Supabase RLS** — every migration ships with RLS policies; verify they're active after applying migrations
- **Don't expose `SUPABASE_SERVICE_ROLE_KEY`** to the browser or any client-side code
- **Set `Require Verified Commits`** in Vercel if you want to gate deployments to signed commits
- **Rotate API keys** if any environment file is ever accidentally committed (then rewrite history with `git filter-repo`)

## Disabling sign-ups on a deployment

If you want to lock down a deployment so no new accounts can be created, do BOTH of these:

**Step 1 — server-side enforcement (the actual gate).** In your Supabase project: **Authentication → Sign In / Up → toggle "Allow new users to sign up" off**. This is the master switch — Supabase rejects all new account creations at the auth layer regardless of method (email/password, magic link, OAuth). Existing users can still sign in.

**Step 2 — UI (cosmetic).** Set `NEXT_PUBLIC_DISABLE_SIGNUP=true` in your Vercel env vars. This hides the sign-up form, swaps the landing CTA to "Sign in", and removes the sign-up URL from the sitemap. Without this, the sign-up form would still render and just fail with a confusing error when the user submits.

**Why no migration?** An earlier draft of this section pointed at a Postgres trigger on `auth.users` for self-contained enforcement. That was over-engineering — Supabase already exposes the right primitive as a one-click dashboard toggle. Use it.

## Disclosure timeline

After a fix lands, we'll publicly disclose the vulnerability:

- 30 days after the fix for low/medium severity
- 7 days after the fix for high/critical severity (so self-hosters get a chance to update)

Disclosure happens via a GitHub release note + a `SECURITY ADVISORY` issue.
