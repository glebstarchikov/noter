import Link from 'next/link'

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Access was denied. Please try again or contact support.',
  server_error: 'A server error occurred. Please try again later.',
  temporarily_unavailable: 'The service is temporarily unavailable. Please try again later.',
  unexpected_failure: 'An unexpected error occurred during authentication.',
  user_not_found: 'No account found with these credentials.',
  user_banned: 'This account has been suspended. Please contact support.',
  validation_failed: 'The provided information is invalid. Please check and try again.',
  flow_state_not_found: 'Your session has expired. Please try signing in again.',
  flow_state_expired: 'Your session has expired. Please try signing in again.',
  provider_email_needs_verification: 'Please verify your email address before signing in.',
  email_address_not_authorized: 'This email address is not authorized. Please contact support.',
  bad_code_verifier: 'The verification code is invalid or expired. Please try again.',
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>
}) {
  const params = await searchParams
  const errorCode = params?.error || ''
  const friendlyMessage = ERROR_MESSAGES[errorCode] || (errorCode
    ? `Authentication error: ${errorCode.replace(/_/g, ' ')}`
    : 'An unspecified error occurred during authentication.')

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-6 text-center">
          <Link href="/" className="text-2xl font-semibold tracking-tight text-foreground">
            noter
          </Link>

          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-medium text-foreground">
              Something went wrong
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {friendlyMessage}
            </p>
          </div>

          <Link
            href="/auth/login"
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
