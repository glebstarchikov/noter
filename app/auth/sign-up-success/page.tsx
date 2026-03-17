import Link from 'next/link'
import { AuthPageLayout } from '@/components/auth-page-layout'
import { Button } from '@/components/ui/button'

export default function SignUpSuccessPage() {
  return (
    <AuthPageLayout
      title="Check your email"
      description="We've sent you a confirmation link. Verify your account, then come back to sign in."
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
