import type { NextConfig } from 'next'

const previewEnvironment =
  process.env.VERCEL_ENV === 'preview'
    ? {
        NEXT_PUBLIC_AUREVANE_ENV: process.env.NEXT_PUBLIC_AUREVANE_ENV ?? 'staging',
        NEXT_PUBLIC_SUPABASE_URL:
          process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
          process.env.SUPABASE_PUBLISHABLE_KEY ??
          '',
      }
    : undefined

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
  env: previewEnvironment,
}

export default nextConfig
