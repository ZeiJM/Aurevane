import type { NextConfig } from 'next'

const vercelEnvironment = process.env.VERCEL_ENV
const explicitAurevaneEnvironment = process.env.NEXT_PUBLIC_AUREVANE_ENV?.trim()

if (
  vercelEnvironment === 'production' &&
  explicitAurevaneEnvironment &&
  explicitAurevaneEnvironment !== 'production'
) {
  throw new Error(
    'Invalid Vercel production environment: NEXT_PUBLIC_AUREVANE_ENV must be "production"',
  )
}

const previewEnvironment =
  vercelEnvironment === 'preview'
    ? {
        NEXT_PUBLIC_AUREVANE_ENV: explicitAurevaneEnvironment || 'staging',
        NEXT_PUBLIC_SUPABASE_URL:
          process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
          process.env.SUPABASE_PUBLISHABLE_KEY ??
          '',
      }
    : undefined

// Vercel integrations can inject browser-safe Supabase values before AUREVANE's
// production database is provisioned. Without an explicit environment identity,
// neutralize those values at build time so Production cannot silently use them.
const unprovisionedProductionEnvironment =
  vercelEnvironment === 'production' && !explicitAurevaneEnvironment
    ? {
        NEXT_PUBLIC_AUREVANE_ENV: '',
        NEXT_PUBLIC_SUPABASE_URL: '',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
      }
    : undefined

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
  env: previewEnvironment ?? unprovisionedProductionEnvironment,
}

export default nextConfig
