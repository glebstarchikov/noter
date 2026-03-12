import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { Logo } from '@/components/logo'
import { Badge } from '@/components/ui/badge'

interface AuthPageLayoutProps {
  title: string
  description: string
  children: React.ReactNode
}

const featureHints = [
  'Structured summaries and decisions',
  'Action items you can review quickly',
  'A calm workspace built around your notes',
]

export function AuthPageLayout({ title, description, children }: AuthPageLayoutProps) {
  return (
    <div className="flex min-h-svh w-full bg-background">
      <div className="hidden flex-1 items-center justify-center p-8 lg:flex xl:p-10">
        <div className="surface-utility auth-enter flex w-full max-w-xl flex-col gap-8 px-10 py-10">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Logo size="lg" className="bg-foreground text-background" />
              <div className="flex flex-col gap-1">
                <span className="text-lg font-semibold tracking-tight text-foreground">
                  noter
                </span>
                <Badge variant="secondary">Meeting notes that stay readable</Badge>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                Keep the meeting, skip the mess.
              </h1>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                noter turns recordings into structured notes you can scan, edit, and revisit without the usual dashboard noise.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {featureHints.map((text) => (
              <div
                key={text}
                className="surface-document flex items-center gap-3 rounded-[22px] px-4 py-3"
              >
                <CheckCircle2 className="size-4 text-accent" />
                <span className="text-sm text-muted-foreground">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 lg:p-10">
        <div className="auth-enter surface-document w-full max-w-md px-6 py-8 sm:px-8">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4">
              <Link href="/" className="flex items-center gap-3">
                <Logo className="bg-foreground text-background" />
                <span className="text-lg font-semibold tracking-tight text-foreground">
                  noter
                </span>
              </Link>
              <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  {title}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              </div>
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
