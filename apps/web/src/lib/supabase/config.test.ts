import { describe, expect, it } from 'vitest'

import { parseOptionalPublicSupabaseConfig } from './config'

describe('optional public Supabase configuration', () => {
  it('allows a completely unconfigured environment for public shell requests', () => {
    expect(parseOptionalPublicSupabaseConfig({})).toBeNull()
    expect(
      parseOptionalPublicSupabaseConfig({
        NEXT_PUBLIC_AUREVANE_ENV: '',
        NEXT_PUBLIC_SUPABASE_URL: '',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
      }),
    ).toBeNull()
  })

  it('rejects partially configured environments instead of silently disabling auth', () => {
    expect(() =>
      parseOptionalPublicSupabaseConfig({
        NEXT_PUBLIC_AUREVANE_ENV: 'production',
      }),
    ).toThrow('Invalid public environment configuration')
  })

  it('returns a validated config when the environment is complete', () => {
    expect(
      parseOptionalPublicSupabaseConfig({
        NEXT_PUBLIC_AUREVANE_ENV: 'production',
        NEXT_PUBLIC_SUPABASE_URL: 'https://aurevane-prod.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_aurevane_production_test_key',
      }),
    ).toEqual({
      environment: 'production',
      url: 'https://aurevane-prod.supabase.co',
      publishableKey: 'sb_publishable_aurevane_production_test_key',
    })
  })
})
