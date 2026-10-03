import { NextResponse } from 'next/server'

import { getSafeInternalRedirect } from '@/lib/auth/redirect'
import { getAuthRequestOrigin } from '@/lib/auth/request-origin'
import { getVerifiedAuthClaims } from '@/lib/supabase/auth'
import {
  claimActiveGameSession,
  readVerifiedGameSessionIdentity,
} from '@/server/account/active-game-session'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const origin = getAuthRequestOrigin(request)
  if (!origin)
    return NextResponse.json({ error: 'Invalid account callback host.' }, { status: 400 })
  const redirectPath = getSafeInternalRedirect(requestUrl.searchParams.get('next'))
  const identity = readVerifiedGameSessionIdentity(await getVerifiedAuthClaims())

  if (!identity) {
    return NextResponse.redirect(new URL('/', origin))
  }

  try {
    await claimActiveGameSession(identity)
  } catch {
    return NextResponse.redirect(new URL('/?account=session-unavailable', origin))
  }

  return NextResponse.redirect(new URL(redirectPath, origin))
}
