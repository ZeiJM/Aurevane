import 'server-only'

import { parseServerEnvironment, requireSupabaseSecretKey } from '@aurevane/validation/env/server'
import { createClient } from '@supabase/supabase-js'

import { getPublicSupabaseConfig } from './config'

export function createSupabaseAdminClient() {
  const publicConfig = getPublicSupabaseConfig()
  const serverEnvironment = parseServerEnvironment({
    AUREVANE_ENV: process.env.AUREVANE_ENV,
    NEXT_PUBLIC_AUREVANE_ENV: process.env.NEXT_PUBLIC_AUREVANE_ENV,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  })
  const secretKey = requireSupabaseSecretKey(serverEnvironment)

  return createClient(publicConfig.url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}
