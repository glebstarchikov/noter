import Link from 'next/link'
import { Logo } from '@/components/logo'

interface AuthPageLayoutProps {
  title: string
  description: string
  children: React.ReactNode
}

export function AuthPageLayout({ title, description, children }: AuthPageLayoutProps) {
  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center bg-background p-4 md:p-8 relative selection:bg-accent/20">
      
      {/* Centered Auth Card Area */}
      <div className="w-full max-w-[420px] z-10 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Minimalist Centered Logo */}
        <Link 
          href="/" 
          className="mb-8 flex items-center justify-center rounded-2xl size-14 bg-secondary/50 border border-border/50 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group transition-transform hover:-translate-y-1"
        >
          <Logo size="sm" className="bg-foreground text-background" />
        </Link>
        
        {/* Form Container */}
        <div className="surface-document w-full flex flex-col gap-8 px-8 py-10 shadow-lg rounded-3xl">
          
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>

          <div className="flex flex-col gap-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}


