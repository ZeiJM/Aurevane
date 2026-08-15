import { NextResponse } from 'next/server'

import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signOut()

  if (error) {
    return NextResponse.json({ error: 'Unable to sign out right now.' }, { status: 503 })
  }

  return NextResponse.redirect(new URL('/', request.url), { status: 303 })
}
