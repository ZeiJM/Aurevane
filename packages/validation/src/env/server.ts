import { z } from 'zod'

import { aurevaneEnvironmentSchema } from './public'

function decodeJwtRole(value: string): string | null {
  const parts = value.split('.')
  if (parts.length !== 3 || !value.startsWith('eyJ')) {
    return null
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const payload = JSON.parse(globalThis.atob(padded)) as { role?: unknown }
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

export function isSupabaseSecretKey(value: string): boolean {
  if (value.startsWith('sb_secret_')) {
    return true
  }

  return decodeJwtRole(value) === 'service_role'
}

const serverEnvironmentSchema = z
  .object({
    AUREVANE_ENV: aurevaneEnvironmentSchema,
    NEXT_PUBLIC_AUREVANE_ENV: aurevaneEnvironmentSchema,
    SUPABASE_SECRET_KEY: z
      .string()
      .min(20)
      .refine(
        isSupabaseSecretKey,
        'must be a Supabase secret key or a local legacy service_role key',
      )
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.AUREVANE_ENV !== value.NEXT_PUBLIC_AUREVANE_ENV) {
      context.addIssue({
        code: 'custom',
        path: ['AUREVANE_ENV'],
        message: 'must match NEXT_PUBLIC_AUREVANE_ENV',
      })
    }
  })

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>

function formatEnvironmentError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
    .join('; ')
}

export function parseServerEnvironment(input: unknown): ServerEnvironment {
  const result = serverEnvironmentSchema.safeParse(input)

  if (!result.success) {
    throw new Error(
      `Invalid server environment configuration: ${formatEnvironmentError(result.error)}`,
    )
  }

  return result.data
}

export function requireSupabaseSecretKey(environment: ServerEnvironment): string {
  if (!environment.SUPABASE_SECRET_KEY) {
    throw new Error('SUPABASE_SECRET_KEY is required for privileged server operations')
  }

  return environment.SUPABASE_SECRET_KEY
}
