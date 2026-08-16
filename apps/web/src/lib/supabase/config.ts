import { parsePublicEnvironment, type AurevaneEnvironment } from '@aurevane/validation/env/public'

interface PublicSupabaseEnvironmentInput {
  NEXT_PUBLIC_AUREVANE_ENV?: string
  NEXT_PUBLIC_SUPABASE_URL?: string
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string
}

interface HostedSupabaseEnvironmentInput {
  AUREVANE_ENV?: string
  VERCEL_ENV?: string
  SUPABASE_URL?: string
  SUPABASE_PUBLISHABLE_KEY?: string
  SUPABASE_ANON_KEY?: string
}

export interface PublicSupabaseConfig {
  environment: AurevaneEnvironment
  url: string
  publishableKey: string
}

export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  return parseRequiredPublicSupabaseConfig(readPublicSupabaseEnvironment())
}

export function getOptionalPublicSupabaseConfig(): PublicSupabaseConfig | null {
  return parseOptionalPublicSupabaseConfig(readPublicSupabaseEnvironment())
}

export function parseOptionalPublicSupabaseConfig(
  input: PublicSupabaseEnvironmentInput,
): PublicSupabaseConfig | null {
  if (isCompletelyUnconfigured(input)) {
    return null
  }

  return parseRequiredPublicSupabaseConfig(input)
}

export function resolvePublicSupabaseEnvironment(
  publicInput: PublicSupabaseEnvironmentInput,
  hostedInput: HostedSupabaseEnvironmentInput,
): PublicSupabaseEnvironmentInput {
  if (!isCompletelyUnconfigured(publicInput)) {
    return publicInput
  }

  const hostedUrl = normalizeOptionalValue(hostedInput.SUPABASE_URL)
  const hostedPublishableKey =
    normalizeOptionalValue(hostedInput.SUPABASE_PUBLISHABLE_KEY) ??
    normalizeOptionalValue(hostedInput.SUPABASE_ANON_KEY)
  const hostedEnvironment =
    normalizeOptionalValue(hostedInput.AUREVANE_ENV) ?? inferVercelEnvironment(hostedInput.VERCEL_ENV)

  if (!hostedUrl && !hostedPublishableKey && !hostedEnvironment) {
    return publicInput
  }

  return {
    NEXT_PUBLIC_AUREVANE_ENV: hostedEnvironment,
    NEXT_PUBLIC_SUPABASE_URL: hostedUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: hostedPublishableKey,
  }
}

function parseRequiredPublicSupabaseConfig(
  input: PublicSupabaseEnvironmentInput,
): PublicSupabaseConfig {
  const environment = parsePublicEnvironment(input)

  return {
    environment: environment.NEXT_PUBLIC_AUREVANE_ENV,
    url: environment.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  }
}

function readPublicSupabaseEnvironment(): PublicSupabaseEnvironmentInput {
  const publicInput = {
    NEXT_PUBLIC_AUREVANE_ENV: process.env.NEXT_PUBLIC_AUREVANE_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  }

  if (typeof window !== 'undefined') {
    return publicInput
  }

  return resolvePublicSupabaseEnvironment(publicInput, {
    AUREVANE_ENV: process.env.AUREVANE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  })
}

function inferVercelEnvironment(value?: string): string | undefined {
  const normalized = normalizeOptionalValue(value)?.toLowerCase()

  if (normalized === 'production') {
    return 'production'
  }

  if (normalized === 'preview') {
    return 'staging'
  }

  return undefined
}

function normalizeOptionalValue(value?: string): string | undefined {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

function isCompletelyUnconfigured(input: PublicSupabaseEnvironmentInput): boolean {
  return [
    input.NEXT_PUBLIC_AUREVANE_ENV,
    input.NEXT_PUBLIC_SUPABASE_URL,
    input.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ].every((value) => value === undefined || value.trim() === '')
}
