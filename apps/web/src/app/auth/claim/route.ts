import { NextResponse } from 'next/server'

import { getSafeInternalRedirect } from '@/lib/auth/redirect'
import { getVerifiedAuthClaims } from '@/lib/supabase/auth'
import {
  claimActiveGameSession,
  readVerifiedGameSessionIdentity,
} from '@/server/account/active-game-session'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const redirectPath = getSafeInternalRedirect(requestUrl.searchParams.get('next'))
  const identity = readVerifiedGameSessionIdentity(await getVerifiedAuthClaims())

  if (!identity) {
    return NextResponse.redirect(new URL('/', requestUrl.origin))
  }

  try {
    await claimActiveGameSession(identity)
  } catch {
    return NextResponse.redirect(new URL('/?account=session-unavailable', requestUrl.origin))
  }

  return NextResponse.redirect(new URL(redirectPath, requestUrl.origin))
}
