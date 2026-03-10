'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="flex items-center justify-center p-6 md:p-10" style={{ minHeight: '50vh' }}>
      <div className="surface-utility flex max-w-xl flex-col items-center gap-5 px-8 py-10 text-center">
        <AlertCircle className="size-9 text-destructive" />
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            We couldn&apos;t load your notes
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Please try again. If the problem keeps happening, head back to your workspace and reopen the page.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset} variant="outline" className="border-border/70 shadow-none">
            Try again
          </Button>
          <Button asChild>
            <Link href="/dashboard">
              Back to notes
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
