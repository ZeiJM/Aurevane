import {
  parsePublicEnvironment,
  type AurevaneEnvironment,
} from '@aurevane/validation/env/public'

interface PublicSupabaseEnvironmentInput {
  NEXT_PUBLIC_AUREVANE_ENV?: string
  NEXT_PUBLIC_SUPABASE_URL?: string
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string
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
  return {
    NEXT_PUBLIC_AUREVANE_ENV: process.env.NEXT_PUBLIC_AUREVANE_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  }
}

function isCompletelyUnconfigured(input: PublicSupabaseEnvironmentInput): boolean {
  return [
    input.NEXT_PUBLIC_AUREVANE_ENV,
    input.NEXT_PUBLIC_SUPABASE_URL,
    input.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ].every((value) => value === undefined || value.trim() === '')
}
