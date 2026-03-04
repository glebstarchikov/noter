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
        <div className="flex flex-col items-center justify-center gap-6 p-6 md:p-10" style={{ minHeight: '50vh' }}>
            <AlertCircle className="h-10 w-10 text-destructive" />
            <div className="flex flex-col items-center gap-2 text-center">
                <h2 className="text-lg font-semibold text-foreground">
                    Something went wrong
                </h2>
                <p className="max-w-md text-sm text-muted-foreground">
                    An error occurred while loading the dashboard. Please try again or go back to the home page.
                </p>
            </div>
            <div className="flex items-center gap-3">
                <Button
                    onClick={reset}
                    variant="outline"
                    className="border-border"
                >
                    Try again
                </Button>
                <Button asChild>
                    <Link href="/dashboard">
                        Go to dashboard
                    </Link>
                </Button>
            </div>
        </div>
    )
}
