import {
  INVALID_PASSWORD_RESET_MESSAGE,
  validateNewAccountPassword,
} from '@/lib/auth/password-recovery'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { hasVerifiedRecoverySession, PASSWORD_RECOVERY_COOKIE } from '@/lib/auth/recovery-session'
import { cookies } from 'next/headers'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'
import { getCurrentAccountServicesReadiness } from '@/server/account/account-services-readiness'

const headers = { 'Cache-Control': 'private, no-store' }

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return Response.json({ error: 'Request this change from AUREVANE.' }, { status: 403, headers })
  }
  if (
    !getCurrentAccountServicesReadiness(
      getOptionalPublicSupabaseConfig(),
      new URL(request.url).host,
    ).available
  ) {
    return Response.json(
      { error: 'Account services are not enabled in this environment.' },
      { status: 503, headers },
    )
  }
  try {
    const body: unknown = await request.json()
    if (
      !body ||
      typeof body !== 'object' ||
      !('password' in body) ||
      !('confirmPassword' in body)
    ) {
      return Response.json(
        { error: 'Enter and confirm your new password.' },
        { status: 400, headers },
      )
    }
    const validation = validateNewAccountPassword(body.password, body.confirmPassword)
    if (validation) return Response.json({ error: validation }, { status: 400, headers })
    const supabase = await createSupabaseServerClient()
    // getUser revalidates with Auth; unverified cookie contents never authorize an update.
    if (!(await hasVerifiedRecoverySession(supabase))) {
      return Response.json({ error: INVALID_PASSWORD_RESET_MESSAGE }, { status: 401, headers })
    }
    const { error: updateError } = await supabase.auth.updateUser({
      password: body.password as string,
    })
    if (updateError) {
      const message =
        updateError.code === 'same_password'
          ? 'Choose a password different from your previous password.'
          : updateError.code === 'weak_password'
            ? 'Choose a stronger password, then try again.'
            : 'Your password could not be changed. Request a new reset link or try again in a moment.'
      return Response.json({ error: message }, { status: 400, headers })
    }
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' })
    if (signOutError) {
      return Response.json(
        {
          error:
            'Your password changed, but sign-out could not finish. Try signing out before signing in again.',
        },
        { status: 503, headers },
      )
    }
    const cookieStore = await cookies()
    cookieStore.delete(PASSWORD_RECOVERY_COOKIE)
    return Response.json({ redirectTo: '/?account=password-reset' }, { headers })
  } catch {
    return Response.json(
      { error: 'Account services could not be reached. Try again in a moment.' },
      { status: 503, headers },
    )
  }
}
