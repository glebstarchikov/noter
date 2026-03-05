'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AudioLines, Loader2, Sparkles } from 'lucide-react'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      setIsLoading(false)
      return
    }

    if (password !== repeatPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
            `${window.location.origin}/dashboard`,
        },
      })
      if (error) throw error
      router.push('/auth/sign-up-success')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full bg-background">
      {/* Left panel — branding (hidden on mobile) */}
      <div className="relative hidden flex-1 items-center justify-center overflow-hidden border-r border-border lg:flex">
        {/* Dot grid */}
        <div className="dot-grid absolute inset-0" aria-hidden="true" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--background)_80%)]" aria-hidden="true" />

        {/* Accent glow */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[400px] rounded-full bg-accent/[0.06] blur-[80px]"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-foreground text-background">
            <AudioLines className="size-7" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              noter
            </h1>
            <p className="max-w-xs text-center text-sm leading-relaxed text-muted-foreground">
              AI-powered meeting notes. Record, transcribe, and understand.
            </p>
          </div>

          {/* Floating feature hints */}
          <div className="mt-6 flex flex-col gap-3">
            {['Structured summaries', 'Action item tracking', 'AI-powered chat'].map((text, i) => (
              <div
                key={text}
                className="landing-fade flex items-center gap-2.5 rounded-full border border-border bg-card/80 px-4 py-2 text-xs text-muted-foreground"
                style={{ animationDelay: `${300 + i * 150}ms` }}
              >
                <Sparkles className="size-3 text-accent" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="auth-enter w-full max-w-sm">
          <div className="flex flex-col gap-8">
            {/* Mobile logo */}
            <div className="flex flex-col items-center gap-3 lg:items-start">
              <Link href="/" className="flex items-center gap-2.5 lg:hidden">
                <div className="flex size-9 items-center justify-center rounded-xl bg-foreground text-background">
                  <AudioLines className="size-4" />
                </div>
                <span className="text-xl font-semibold tracking-tight text-foreground">
                  noter
                </span>
              </Link>
              <div className="flex flex-col items-center gap-1 lg:items-start">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  Create your account
                </h2>
                <p className="text-sm text-muted-foreground">
                  Get started with noter for free
                </p>
              </div>
            </div>

            <form onSubmit={handleSignUp} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email" className="text-sm text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-lg"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="password" className="text-sm text-muted-foreground">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-lg"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="repeat-password" className="text-sm text-muted-foreground">
                  Confirm password
                </Label>
                <Input
                  id="repeat-password"
                  type="password"
                  required
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                  className="h-11 rounded-lg"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="h-11 w-full rounded-lg bg-accent text-accent-foreground hover:bg-accent/90"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating account…
                  </>
                ) : (
                  'Create account'
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground lg:text-left">
              Already have an account?{' '}
              <Link
                href="/auth/login"
                className="font-medium text-foreground underline underline-offset-4 hover:text-accent"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
