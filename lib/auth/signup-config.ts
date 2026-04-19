/**
 * Reads NEXT_PUBLIC_DISABLE_SIGNUP. When `'true'`, the sign-up route renders
 * a closed-for-signups message and the in-app CTAs that link to it are
 * hidden / redirected to login. Defaults to `false` so self-hosters get the
 * normal sign-up flow without configuring anything.
 *
 * Used by the public reference deployment at my-noter.vercel.app to prevent
 * unrestricted account creation during the OSS launch period.
 */
export const SIGNUP_DISABLED =
  process.env.NEXT_PUBLIC_DISABLE_SIGNUP === 'true'
