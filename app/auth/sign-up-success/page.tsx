import Link from 'next/link'

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-6 text-center">
          <Link href="/" className="text-2xl font-semibold tracking-tight text-foreground">
            noter
          </Link>

          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-medium text-foreground">
              Check your email
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {"We've sent you a confirmation link. Please check your email to verify your account before signing in."}
            </p>
          </div>

          <Link
            href="/auth/login"
            className="text-sm text-foreground underline underline-offset-4 hover:text-accent"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
