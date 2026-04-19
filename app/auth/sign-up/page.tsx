'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AuthPageLayout } from '@/components/auth-page-layout'
import { SIGNUP_DISABLED } from '@/lib/auth/signup-config'

export default function SignUpPage() {
  if (SIGNUP_DISABLED) {
    return <SignupClosedNotice />
  }
  return <SignUpForm />
}

function SignupClosedNotice() {
  return (
    <AuthPageLayout
      title="Sign-ups are closed"
      description="This deployment isn't accepting new accounts right now. You can self-host noter to run your own instance."
    >
      <div className="flex flex-col gap-4">
        <Link
          href="/auth/login"
          className="text-center text-sm font-medium text-foreground underline underline-offset-4 decoration-border hover:text-accent hover:decoration-accent"
        >
          Sign in to an existing account →
        </Link>
        <a
          href="https://github.com/glebstarchikov/noter"
          target="_blank"
          rel="noopener noreferrer"
          className="text-center text-sm text-muted-foreground hover:text-foreground"
        >
          Self-host noter on GitHub →
        </a>
      </div>
    </AuthPageLayout>
  )
}

function SignUpForm() {
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
    <AuthPageLayout title="Create your account" description="Get started with noter for free">
      <form onSubmit={handleSignUp} className="flex flex-col gap-6">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl bg-background border-border/70 shadow-sm"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-xl bg-background border-border/70 shadow-sm"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="repeat-password">Confirm password</FieldLabel>
            <Input
              id="repeat-password"
              type="password"
              required
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
              className="h-11 rounded-xl bg-background border-border/70 shadow-sm"
            />
          </Field>
        </FieldGroup>

        {error ? <FieldError>{error}</FieldError> : null}

        <Button
          type="submit"
          className="h-12 w-full rounded-xl font-medium shadow-sm transition-transform hover:-translate-y-0.5 active:scale-95"
          disabled={isLoading}
        >
          {isLoading ? (
             <div className="flex items-center gap-1.5 justify-center">
               <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
               <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
               <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
             </div>
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground text-center mt-2">
        Already have an account?{' '}
        <Link
          href="/auth/login"
          className="font-medium text-foreground hover:text-accent transition-colors underline underline-offset-4 decoration-border hover:decoration-accent"
        >
          Sign in
        </Link>
      </p>
    </AuthPageLayout>
  )
}
