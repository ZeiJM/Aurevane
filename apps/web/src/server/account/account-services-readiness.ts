import { isSupabaseSecretKey } from '@aurevane/validation/env/server'

import type { PublicSupabaseConfig } from '../../lib/supabase/config'

export type AccountServicesReadinessReason =
  'ready' | 'unconfigured' | 'production_environment_mismatch' | 'production_not_ready'

export interface AccountServicesReadiness {
  available: boolean
  reason: AccountServicesReadinessReason
}

interface AccountServicesReadinessInput {
  publicConfig: PublicSupabaseConfig | null
  vercelEnvironment?: string
  requestHost?: string | null
  productionHost?: string
  productionReady?: string
  privilegedServerKey?: string
}

export function getCurrentAccountServicesReadiness(
  publicConfig: PublicSupabaseConfig | null,
  requestHost: string | null,
): AccountServicesReadiness {
  return resolveAccountServicesReadiness({
    publicConfig,
    vercelEnvironment: process.env.VERCEL_ENV,
    requestHost,
    productionHost: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    productionReady: process.env.AUREVANE_ACCOUNT_SERVICES_READY,
    privilegedServerKey:
      process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
  })
}

export function resolveAccountServicesReadiness(
  input: AccountServicesReadinessInput,
): AccountServicesReadiness {
  if (!input.publicConfig) {
    return { available: false, reason: 'unconfigured' }
  }

  const productionRequest =
    input.publicConfig.environment === 'production' ||
    input.vercelEnvironment === 'production' ||
    hostsMatch(input.requestHost, input.productionHost)

  if (!productionRequest) {
    return { available: true, reason: 'ready' }
  }

  if (input.publicConfig.environment !== 'production') {
    return { available: false, reason: 'production_environment_mismatch' }
  }

  const explicitlyReady = input.productionReady?.trim().toLowerCase() === 'true'
  const integratedProductionReady =
    input.vercelEnvironment === 'production' &&
    typeof input.privilegedServerKey === 'string' &&
    isSupabaseSecretKey(input.privilegedServerKey.trim())

  if (!explicitlyReady && !integratedProductionReady) {
    return { available: false, reason: 'production_not_ready' }
  }

  return { available: true, reason: 'ready' }
}

function hostsMatch(requestHost?: string | null, productionHost?: string): boolean {
  const request = normalizeHost(requestHost)
  const production = normalizeHost(productionHost)

  return request !== null && production !== null && request === production
}

function normalizeHost(value?: string | null): string | null {
  if (!value) {
    return null
  }

  const normalized = value.trim().toLowerCase().replace(/\.$/, '')
  if (!normalized) {
    return null
  }

  const colonIndex = normalized.lastIndexOf(':')
  if (colonIndex > -1 && normalized.indexOf(':') === colonIndex) {
    return normalized.slice(0, colonIndex)
  }

  return normalized
}
