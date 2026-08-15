import { NextResponse } from 'next/server'

import { getVerifiedAuthClaims } from '@/lib/supabase/auth'

export async function GET() {
  const claims = await getVerifiedAuthClaims()

  return NextResponse.json(
    { authenticated: claims !== null },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  )
}
