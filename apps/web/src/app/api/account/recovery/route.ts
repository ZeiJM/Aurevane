import { NextResponse } from 'next/server'
import {
  INVALID_PASSWORD_RESET_MESSAGE,
  isPasswordRecoveryTokenHash,
} from '@/lib/auth/password-recovery'
import { PASSWORD_RECOVERY_COOKIE } from '@/lib/auth/recovery-session'
import { getAuthRequestOrigin } from '@/lib/auth/request-origin'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCurrentAccountServicesReadiness } from '@/server/account/account-services-readiness'

const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }

export async function POST(request: Request) {
  const origin = getAuthRequestOrigin(request)
  if (!origin || request.headers.get('origin') !== origin) {
    return NextResponse.json(
      { error: 'Request this change from AUREVANE.' },
      { status: 403, headers },
    )
  }
  if (
    !getCurrentAccountServicesReadiness(getOptionalPublicSupabaseConfig(), new URL(origin).host)
      .available
  ) {
    return NextResponse.json(
      { error: 'Account services are not enabled in this environment.' },
      { status: 503, headers },
    )
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid recovery request.' }, { status: 400, headers })
  }
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    !('tokenHash' in body) ||
    !isPasswordRecoveryTokenHash(body.tokenHash)
  ) {
    return NextResponse.json({ error: 'Invalid recovery request.' }, { status: 400, headers })
  }
  const invalid = () =>
    NextResponse.json({ error: INVALID_PASSWORD_RESET_MESSAGE }, { status: 401, headers })
  try {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: body.tokenHash,
      type: 'recovery',
    })
    if (error || !data.user || !data.session || data.session.user.id !== data.user.id)
      return invalid()
    const { data: verified, error: userError } = await supabase.auth.getUser()
    const { data: claims, error: claimsError } = await supabase.auth.getClaims()
    const sessionId = claims?.claims.session_id
    if (
      userError ||
      claimsError ||
      !verified.user?.email_confirmed_at ||
      verified.user.id !== data.user.id ||
      claims?.claims.sub !== verified.user.id ||
      typeof sessionId !== 'string' ||
      !sessionId
    )
      return invalid()
    const response = NextResponse.json({ redirectTo: '/auth/reset-password' }, { headers })
    response.cookies.set(PASSWORD_RECOVERY_COOKIE, sessionId, {
      httpOnly: true,
      secure: new URL(origin).protocol === 'https:',
      sameSite: 'lax',
      path: '/',
      maxAge: 900,
    })
    return response
  } catch {
    return NextResponse.json(
      { error: 'Account services could not be reached. Try again in a moment.' },
      { status: 503, headers },
    )
  }
}
