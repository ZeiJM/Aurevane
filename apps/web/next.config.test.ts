import { afterEach, describe, expect, it, vi } from 'vitest'

const environmentKeys = [
  'VERCEL_ENV',
  'NEXT_PUBLIC_AUREVANE_ENV',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
] as const

const originalEnvironment = Object.fromEntries(
  environmentKeys.map((key) => [key, process.env[key]]),
) as Record<(typeof environmentKeys)[number], string | undefined>

async function loadNextConfig(environment: Partial<typeof originalEnvironment>) {
  for (const key of environmentKeys) {
    delete process.env[key]
  }

  for (const [key, value] of Object.entries(environment)) {
    if (value !== undefined) {
      process.env[key] = value
    }
  }

  vi.resetModules()
  return (await import('./next.config')).default
}

afterEach(() => {
  for (const key of environmentKeys) {
    const value = originalEnvironment[key]

    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  vi.resetModules()
})

describe('Vercel public environment mapping', () => {
  it('neutralizes provider-injected Supabase values when production is not provisioned', async () => {
    const config = await loadNextConfig({
      VERCEL_ENV: 'production',
      NEXT_PUBLIC_SUPABASE_URL: 'https://staging-example.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_staging_example_key',
    })

    expect(config.env).toEqual({
      NEXT_PUBLIC_AUREVANE_ENV: '',
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
    })
  })

  it('does not override an explicitly identified production configuration', async () => {
    const config = await loadNextConfig({
      VERCEL_ENV: 'production',
      NEXT_PUBLIC_AUREVANE_ENV: 'production',
      NEXT_PUBLIC_SUPABASE_URL: 'https://production-example.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_production_example_key',
    })

    expect(config.env).toBeUndefined()
  })

  it('rejects a staging identity on a Vercel production deployment', async () => {
    await expect(
      loadNextConfig({
        VERCEL_ENV: 'production',
        NEXT_PUBLIC_AUREVANE_ENV: 'staging',
        NEXT_PUBLIC_SUPABASE_URL: 'https://staging-example.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_staging_example_key',
      }),
    ).rejects.toThrow(
      'Invalid Vercel production environment: NEXT_PUBLIC_AUREVANE_ENV must be "production"',
    )
  })

  it('preserves preview staging defaults and integration fallbacks', async () => {
    const config = await loadNextConfig({
      VERCEL_ENV: 'preview',
      SUPABASE_URL: 'https://staging-example.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_staging_example_key',
    })

    expect(config.env).toEqual({
      NEXT_PUBLIC_AUREVANE_ENV: 'staging',
      NEXT_PUBLIC_SUPABASE_URL: 'https://staging-example.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_staging_example_key',
    })
  })
})
