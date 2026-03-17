import { PageHeader, PageShell } from '@/components/page-shell'
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <PageShell>
      <PageHeader
        title={<Skeleton className="h-9 w-24" />}
        description={<Skeleton className="h-5 w-96 max-w-full mt-2" />}
      />

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Skeleton className="h-11 flex-1 rounded-2xl" />
          <Skeleton className="h-11 w-32 rounded-2xl" />
        </div>

        <div className="surface-document divide-y divide-border/60">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-4">
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <Skeleton className="h-[15px] w-48 mb-2" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-3.5 w-16" />
                  <Skeleton className="h-3.5 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  )
}
