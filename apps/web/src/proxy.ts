import { type NextRequest } from 'next/server'

import { updateSupabaseSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return updateSupabaseSession(request)
}

export const config = {
  // Public media includes audio, video and manifests as well as images.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|media(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
