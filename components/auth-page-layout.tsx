import Link from 'next/link'
import { Logo } from '@/components/logo'

interface AuthPageLayoutProps {
  title: string
  description: string
  children: React.ReactNode
}

export function AuthPageLayout({ title, description, children }: AuthPageLayoutProps) {
  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center bg-background p-4 md:p-8 relative overflow-hidden selection:bg-accent/20">
      
      {/* Subtle Mesh Background */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute -top-1/4 -left-1/4 w-[60vw] h-[60vw] bg-accent/10 blur-[120px] rounded-full mix-blend-multiply dark:bg-accent/5 dark:mix-blend-lighten" />
        <div className="absolute -bottom-1/4 -right-1/4 w-[60vw] h-[60vw] bg-secondary/80 blur-[120px] rounded-full mix-blend-multiply dark:bg-secondary/20 dark:mix-blend-lighten" />
      </div>

      {/* Centered Auth Card Area */}
      <div className="w-full max-w-[420px] z-10 flex flex-col items-center">
        
        {/* Minimalist Centered Logo */}
        <Link 
          href="/" 
          className="auth-enter mb-10 flex items-center justify-center rounded-[1.25rem] size-16 surface-utility shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group"
        >
          <Logo size="sm" className="bg-foreground text-background transition-transform duration-300 group-hover:scale-105" />
        </Link>
        
        {/* Form Container */}
        <div 
          className="auth-enter surface-document w-full flex flex-col gap-8 px-8 py-10 shadow-2xl relative" 
          style={{ animationDelay: '100ms' }}
        >
          {/* Subtle top highlight on the card */}
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
          
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
        
        {/* Watermark Footer */}
        <div 
          className="auth-enter mt-10 flex items-center gap-2 grayscale opacity-30 pointer-events-none" 
          style={{ animationDelay: '300ms' }}
        >
          <Logo size="sm" className="bg-foreground text-background scale-[0.6]" />
          <span className="text-xs font-semibold tracking-tight text-foreground">noter</span>
        </div>
      </div>
    </div>
  )
}
