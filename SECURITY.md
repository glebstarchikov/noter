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

## Disclosure timeline

After a fix lands, we'll publicly disclose the vulnerability:

- 30 days after the fix for low/medium severity
- 7 days after the fix for high/critical severity (so self-hosters get a chance to update)

Disclosure happens via a GitHub release note + a `SECURITY ADVISORY` issue.
