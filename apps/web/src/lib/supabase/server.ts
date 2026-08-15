import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { getPublicSupabaseConfig } from './config'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  const config = getPublicSupabaseConfig()

  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet, _headers) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components cannot write cookies. The request Proxy refreshes
          // sessions and persists refreshed cookies before Server Components run.
        }
      },
    },
  })
}
