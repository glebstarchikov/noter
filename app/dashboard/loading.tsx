import { PageShell } from '@/components/page-shell'
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <PageShell>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="surface-document divide-y divide-border/60">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start justify-between gap-4 px-4 py-4">
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        ))}
      </div>
    </PageShell>
  )
}
