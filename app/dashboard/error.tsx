'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { PageShell } from '@/components/page-shell'
import { StatusPanel } from '@/components/status-panel'
import { Button } from '@/components/ui/button'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <PageShell className="min-h-[50vh] justify-center">
      <StatusPanel
        tone="destructive"
        icon={<AlertCircle className="text-destructive" />}
        title="We couldn&apos;t load your notes"
        description="Please try again. If the problem keeps happening, head back to your workspace and reopen the page."
        actions={
          <>
            <Button onClick={reset} variant="ghost" className="shadow-none">
              Try again
            </Button>
            <Button asChild>
              <Link href="/dashboard">Back to notes</Link>
            </Button>
          </>
        }
      />
    </PageShell>
  )
}
