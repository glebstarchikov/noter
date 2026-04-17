export function LandingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1080px] items-center justify-between px-12 py-7">
        <div className="flex items-center gap-4">
          <span className="text-[13px]" style={{ fontWeight: 650 }}>
            noter
          </span>
          <span className="text-[12px] text-muted-foreground">
            © 2026 · Focus on the meeting
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
            MIT License
          </span>
          <a
            href="https://github.com/glebstar06/noter"
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
