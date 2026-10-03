export const ACCOUNT_PASSWORD_MINIMUM_LENGTH = 8
export const PASSWORD_RESET_REQUEST_MESSAGE =
  'If an account exists for that email, a password reset link is on its way. Check your inbox and spam folder.'
export const INVALID_PASSWORD_RESET_MESSAGE =
  'This account link has expired or could not be verified. Request a new password reset link and open it in the same browser.'

export async function requestAccountPasswordReset(
  client: {
    auth: {
      resetPasswordForEmail: (
        email: string,
        options: { redirectTo: string },
      ) => Promise<{ error: unknown }>
    }
  },
  email: string,
  origin: string,
): Promise<{ message: string; tone: 'neutral' | 'error' }> {
  const { error } = await client.auth.resetPasswordForEmail(email, {
    // Reuse the existing confirmation redirect allow-list entry; PKCE carries recovery type.
    redirectTo: `${origin}/auth/callback?next=/game`,
  })
  return error
    ? {
        message: 'A reset link could not be requested right now. Wait a moment and try again.',
        tone: 'error',
      }
    : { message: PASSWORD_RESET_REQUEST_MESSAGE, tone: 'neutral' }
}

export function validateNewAccountPassword(
  password: unknown,
  confirmation: unknown,
): string | null {
  if (typeof password !== 'string' || password.length < ACCOUNT_PASSWORD_MINIMUM_LENGTH) {
    return `Choose a password of at least ${ACCOUNT_PASSWORD_MINIMUM_LENGTH} characters.`
  }
  if (password !== confirmation) return 'Your passwords do not match.'
  return null
}
