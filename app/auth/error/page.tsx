import Link from 'next/link'
import { AuthPageLayout } from '@/components/auth-page-layout'
import { Button } from '@/components/ui/button'

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
    <AuthPageLayout
      title="Something went wrong"
      description={friendlyMessage}
    >
      <div className="flex flex-col gap-4">
        <Button asChild className="w-full rounded-xl">
          <Link href="/auth/login">Back to sign in</Link>
        </Button>
        <Button asChild variant="ghost" className="w-full rounded-xl text-muted-foreground">
          <Link href="/">Return to home</Link>
        </Button>
      </div>
    </AuthPageLayout>
  )
}
