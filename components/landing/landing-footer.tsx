export function LandingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1280px] flex-col items-start gap-4 px-4 py-6 sm:px-6 md:flex-row md:items-center md:justify-between md:gap-0 md:px-12 md:py-7">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-[13px]" style={{ fontWeight: 650 }}>
            noter
          </span>
          <span className="text-[12px] text-muted-foreground">
            © 2026 · Focus on the meeting
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
            MIT License
          </span>
          <a
            href="https://github.com/glebstarchikov/noter"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          >
            GitHub
          </a>
          <span className="text-[12px] text-muted-foreground">
            Made for AI Society
          </span>
        </div>
      </div>
    </footer>
  )
}
