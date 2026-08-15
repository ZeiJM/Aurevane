import { parsePublicEnvironment } from '@aurevane/validation/env/public'

export function getPublicSupabaseConfig() {
  const environment = parsePublicEnvironment({
    NEXT_PUBLIC_AUREVANE_ENV: process.env.NEXT_PUBLIC_AUREVANE_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  })

  return {
    environment: environment.NEXT_PUBLIC_AUREVANE_ENV,
    url: environment.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  } as const
}
