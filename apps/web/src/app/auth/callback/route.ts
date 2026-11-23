import { NextResponse } from 'next/server'

import { getSafeInternalRedirect } from '@/lib/auth/redirect'
import { PASSWORD_RECOVERY_COOKIE } from '@/lib/auth/recovery-session'
import { getAuthRequestOrigin } from '@/lib/auth/request-origin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const origin = getAuthRequestOrigin(request)
  if (!origin)
    return NextResponse.json({ error: 'Invalid account callback host.' }, { status: 400 })
  const code = requestUrl.searchParams.get('code')
  const recovery = requestUrl.searchParams.get('flow') === 'recovery'
  const invalidRecovery = () =>
    NextResponse.redirect(new URL('/auth/reset-password?error=invalid-link', origin))
  const redirectPath = getSafeInternalRedirect(requestUrl.searchParams.get('next'))

  if (!code) {
    return invalidRecovery()
  }

  try {
    const supabase = await createSupabaseServerClient()
    const flowId = requestUrl.searchParams.get('sb_flow_id')
    const { data, error } = await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    )

    if (error) {
      return invalidRecovery()
    }

    // PKCE's stored recovery marker distinguishes this from normal confirmation/sign-in.
    if ('redirectType' in data && data.redirectType === 'recovery') {
      const { data: verified, error: verificationError } = await supabase.auth.getClaims()
      const sessionId = verified?.claims.session_id
      if (verificationError || typeof sessionId !== 'string') return invalidRecovery()
      const response = NextResponse.redirect(new URL('/auth/reset-password', origin))
      response.cookies.set(PASSWORD_RECOVERY_COOKIE, sessionId, {
        httpOnly: true,
        secure: requestUrl.protocol === 'https:',
        sameSite: 'lax',
        path: '/',
        maxAge: 900,
      })
      return response
    }
    if (recovery) return invalidRecovery()

    const claimUrl = new URL('/auth/claim', origin)
    claimUrl.searchParams.set('next', redirectPath)
    return NextResponse.redirect(claimUrl)
  } catch {
    return invalidRecovery()
  }
}
