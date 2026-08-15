import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { getPublicSupabaseConfig } from './config'

export async function updateSupabaseSession(request: NextRequest) {
  const config = getPublicSupabaseConfig()
  let response = NextResponse.next({ request })

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })

        response = NextResponse.next({ request })

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })

        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value)
        })
      },
    },
  })

  // getClaims verifies the current JWT before server-rendered code trusts identity
  // and gives the SSR client an opportunity to refresh expiring auth cookies.
  await supabase.auth.getClaims()

  return response
}
