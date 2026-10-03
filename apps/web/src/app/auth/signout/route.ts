import { NextResponse } from 'next/server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getAuthRequestOrigin } from '@/lib/auth/request-origin'

export async function POST(request: Request) {
  const origin = getAuthRequestOrigin(request)
  if (!origin) return NextResponse.json({ error: 'Invalid account request host.' }, { status: 400 })
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signOut()

  if (error) {
    return NextResponse.json({ error: 'Unable to sign out right now.' }, { status: 503 })
  }

  return NextResponse.redirect(new URL('/', origin), { status: 303 })
}
