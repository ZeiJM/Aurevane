import { NextResponse } from 'next/server'

import { getSafeInternalRedirect } from '@/lib/auth/redirect'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirectPath = getSafeInternalRedirect(requestUrl.searchParams.get('next'))

  if (!code) {
    return NextResponse.json({ error: 'Missing authentication code.' }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.json({ error: 'Authentication callback failed.' }, { status: 400 })
  }

  return NextResponse.redirect(new URL(redirectPath, requestUrl.origin))
}
