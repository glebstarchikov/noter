import Link from 'next/link'
import { Github } from 'lucide-react'

export function LandingNav() {
  return (
    <nav aria-label="Site navigation" className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/90 px-4 py-4 backdrop-blur-sm sm:px-6 md:px-12">
      <span className="text-[15px] tracking-tight" style={{ fontWeight: 650 }}>
        noter
      </span>
      <div className="flex items-center gap-3">
        <Link
          href="/auth/login"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Sign in
        </Link>
        <a
          href="https://github.com/glebstar06/noter"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Github className="size-3.5" />
          <span className="hidden sm:inline">View on GitHub</span>
          <span className="sm:hidden">GitHub</span>
        </a>
      </div>
    </nav>
  )
}
