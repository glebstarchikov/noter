export default function DashboardLoading() {
    return (
        <div className="flex flex-col gap-6 p-6 md:p-10">
            <div className="flex flex-col gap-1">
                <div className="h-7 w-32 animate-pulse rounded-md bg-secondary" />
                <div className="h-4 w-64 animate-pulse rounded-md bg-secondary" />
            </div>

            <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between px-5 py-4">
                        <div className="flex flex-col gap-2">
                            <div className="h-4 w-48 animate-pulse rounded-md bg-secondary" />
                            <div className="h-3 w-32 animate-pulse rounded-md bg-secondary" />
                        </div>
                        <div className="h-3 w-16 animate-pulse rounded-md bg-secondary" />
                    </div>
                ))}
            </div>
        </div>
    )
}
