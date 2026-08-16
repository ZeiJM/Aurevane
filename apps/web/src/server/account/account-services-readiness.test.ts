import { describe, expect, it } from 'vitest'

import {
  resolveAccountServicesReadiness,
  type AccountServicesReadiness,
} from './account-services-readiness'

const localConfig = {
  environment: 'local' as const,
  url: 'http://127.0.0.1:54321',
  publishableKey: 'local-key',
}

const stagingConfig = {
  environment: 'staging' as const,
  url: 'https://staging.example.supabase.co',
  publishableKey: 'staging-key',
}

const productionConfig = {
  environment: 'production' as const,
  url: 'https://production.example.supabase.co',
  publishableKey: 'production-key',
}

describe('resolveAccountServicesReadiness', () => {
  it('keeps completely unconfigured environments unavailable', () => {
    expectReadiness(resolveAccountServicesReadiness({ publicConfig: null }), false, 'unconfigured')
  })

  it('keeps local and normal staging environments available when public config is valid', () => {
    expectReadiness(resolveAccountServicesReadiness({ publicConfig: localConfig }), true, 'ready')
    expectReadiness(
      resolveAccountServicesReadiness({
        publicConfig: stagingConfig,
        vercelEnvironment: 'preview',
        requestHost: 'aurevane-preview.vercel.app',
        productionHost: 'aurevane.vercel.app',
      }),
      true,
      'ready',
    )
  })

  it(
    'requires an explicit readiness opt-in before production auth is exposed without a complete integration',
    () => {
      expectReadiness(
        resolveAccountServicesReadiness({
          publicConfig: productionConfig,
          vercelEnvironment: 'production',
        }),
        false,
        'production_not_ready',
      )

      expectReadiness(
        resolveAccountServicesReadiness({
          publicConfig: productionConfig,
          vercelEnvironment: 'production',
          productionReady: 'true',
        }),
        true,
        'ready',
      )
    },
  )

  it('accepts a valid server-only Supabase integration on a real production deployment', () => {
    expectReadiness(
      resolveAccountServicesReadiness({
        publicConfig: productionConfig,
        vercelEnvironment: 'production',
        privilegedServerKey: 'sb_secret_aurevane_production_test_key',
      }),
      true,
      'ready',
    )
  })

  it('rejects malformed or preview-only privileged integration credentials', () => {
    expectReadiness(
      resolveAccountServicesReadiness({
        publicConfig: productionConfig,
        vercelEnvironment: 'production',
        privilegedServerKey: 'not-a-service-role-key',
      }),
      false,
      'production_not_ready',
    )

    expectReadiness(
      resolveAccountServicesReadiness({
        publicConfig: productionConfig,
        vercelEnvironment: 'preview',
        privilegedServerKey: 'sb_secret_aurevane_preview_test_key',
      }),
      false,
      'production_not_ready',
    )
  })

  it('blocks a staging-configured preview when it is served on the production hostname', () => {
    expectReadiness(
      resolveAccountServicesReadiness({
        publicConfig: stagingConfig,
        vercelEnvironment: 'preview',
        requestHost: 'AUREVANE.VERCEL.APP:443',
        productionHost: 'aurevane.vercel.app',
        productionReady: 'true',
      }),
      false,
      'production_environment_mismatch',
    )
  })

  it('allows a production-host request only with production config and explicit readiness', () => {
    expectReadiness(
      resolveAccountServicesReadiness({
        publicConfig: productionConfig,
        vercelEnvironment: 'preview',
        requestHost: 'aurevane.vercel.app',
        productionHost: 'aurevane.vercel.app',
        productionReady: 'TRUE',
      }),
      true,
      'ready',
    )
  })
})

function expectReadiness(
  actual: AccountServicesReadiness,
  available: boolean,
  reason: AccountServicesReadiness['reason'],
) {
  expect(actual).toEqual({ available, reason })
}
