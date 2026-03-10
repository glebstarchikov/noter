export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 p-6 md:p-10">
      <div className="flex flex-col gap-2">
        <div className="h-8 w-28 animate-pulse rounded-full bg-secondary" />
      </div>

      <div className="surface-document divide-y divide-border/60">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start justify-between gap-4 px-4 py-4">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-56 animate-pulse rounded-full bg-secondary" />
              <div className="h-3 w-32 animate-pulse rounded-full bg-secondary" />
            </div>
            <div className="h-8 w-8 animate-pulse rounded-full bg-secondary" />
          </div>
        ))}
      </div>
    </div>
  )
}
