import { describe, expect, it } from 'vitest'

import { parsePublicEnvironment } from './public'
import { parseServerEnvironment, requireSupabaseSecretKey } from './server'

function legacyJwt(role: 'anon' | 'service_role'): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url').replace(/=/g, '')

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role })}.signature-placeholder`
}

describe('public environment', () => {
  it('accepts local Supabase with a legacy anon key', () => {
    const environment = parsePublicEnvironment({
      NEXT_PUBLIC_AUREVANE_ENV: 'local',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: legacyJwt('anon'),
    })

    expect(environment.NEXT_PUBLIC_AUREVANE_ENV).toBe('local')
  })

  it('accepts hosted Supabase with a publishable key', () => {
    const environment = parsePublicEnvironment({
      NEXT_PUBLIC_AUREVANE_ENV: 'staging',
      NEXT_PUBLIC_SUPABASE_URL: 'https://staging-example.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${'x'.repeat(32)}`,
    })

    expect(environment.NEXT_PUBLIC_AUREVANE_ENV).toBe('staging')
  })

  it('rejects a service-role credential in a public key slot', () => {
    expect(() =>
      parsePublicEnvironment({
        NEXT_PUBLIC_AUREVANE_ENV: 'local',
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: legacyJwt('service_role'),
      }),
    ).toThrow('publishable key')
  })

  it('rejects localhost for staging or production', () => {
    expect(() =>
      parsePublicEnvironment({
        NEXT_PUBLIC_AUREVANE_ENV: 'production',
        NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${'x'.repeat(32)}`,
      }),
    ).toThrow('must not use a localhost')
  })
})

describe('server environment', () => {
  it('requires server and public environment identities to match', () => {
    expect(() =>
      parseServerEnvironment({
        AUREVANE_ENV: 'production',
        NEXT_PUBLIC_AUREVANE_ENV: 'staging',
      }),
    ).toThrow('must match NEXT_PUBLIC_AUREVANE_ENV')
  })

  it('accepts a hosted secret key only in the server environment', () => {
    const environment = parseServerEnvironment({
      AUREVANE_ENV: 'production',
      NEXT_PUBLIC_AUREVANE_ENV: 'production',
      SUPABASE_SECRET_KEY: `sb_secret_${'x'.repeat(32)}`,
    })

    expect(requireSupabaseSecretKey(environment)).toMatch(/^sb_secret_/)
  })

  it('accepts a local legacy service-role key', () => {
    const environment = parseServerEnvironment({
      AUREVANE_ENV: 'local',
      NEXT_PUBLIC_AUREVANE_ENV: 'local',
      SUPABASE_SECRET_KEY: legacyJwt('service_role'),
    })

    expect(requireSupabaseSecretKey(environment)).toContain('.')
  })

  it('rejects a publishable key in the secret slot', () => {
    expect(() =>
      parseServerEnvironment({
        AUREVANE_ENV: 'staging',
        NEXT_PUBLIC_AUREVANE_ENV: 'staging',
        SUPABASE_SECRET_KEY: `sb_publishable_${'x'.repeat(32)}`,
      }),
    ).toThrow('secret key')
  })

  it('fails privileged access when no elevated key is configured', () => {
    const environment = parseServerEnvironment({
      AUREVANE_ENV: 'local',
      NEXT_PUBLIC_AUREVANE_ENV: 'local',
    })

    expect(() => requireSupabaseSecretKey(environment)).toThrow('SUPABASE_SECRET_KEY is required')
  })
})
