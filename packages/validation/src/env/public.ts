import { z } from 'zod'

export const aurevaneEnvironmentSchema = z.enum(['local', 'staging', 'production'])

const supabaseUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol
    return protocol === 'http:' || protocol === 'https:'
  }, 'must use http or https')

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

export function isSupabasePublishableKey(value: string): boolean {
  if (value.startsWith('sb_publishable_')) {
    return true
  }

  return decodeJwtRole(value) === 'anon'
}

const publicEnvironmentSchema = z
  .object({
    NEXT_PUBLIC_AUREVANE_ENV: aurevaneEnvironmentSchema,
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrlSchema,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
      .string()
      .min(20)
      .refine(
        isSupabasePublishableKey,
        'must be a Supabase publishable key or a local legacy anon key',
      ),
  })
  .superRefine((value, context) => {
    const url = new URL(value.NEXT_PUBLIC_SUPABASE_URL)
    const isLocalHost = url.hostname === '127.0.0.1' || url.hostname === 'localhost'

    if (value.NEXT_PUBLIC_AUREVANE_ENV === 'local' && !isLocalHost) {
      context.addIssue({
        code: 'custom',
        path: ['NEXT_PUBLIC_SUPABASE_URL'],
        message: 'local environment must use a localhost Supabase URL',
      })
    }

    if (value.NEXT_PUBLIC_AUREVANE_ENV !== 'local' && isLocalHost) {
      context.addIssue({
        code: 'custom',
        path: ['NEXT_PUBLIC_SUPABASE_URL'],
        message: 'staging and production must not use a localhost Supabase URL',
      })
    }

    if (value.NEXT_PUBLIC_AUREVANE_ENV !== 'local' && url.protocol !== 'https:') {
      context.addIssue({
        code: 'custom',
        path: ['NEXT_PUBLIC_SUPABASE_URL'],
        message: 'staging and production Supabase URLs must use https',
      })
    }
  })

export type AurevaneEnvironment = z.infer<typeof aurevaneEnvironmentSchema>
export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>

function formatEnvironmentError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
    .join('; ')
}

export function parsePublicEnvironment(input: unknown): PublicEnvironment {
  const result = publicEnvironmentSchema.safeParse(input)

  if (!result.success) {
    throw new Error(
      `Invalid public environment configuration: ${formatEnvironmentError(result.error)}`,
    )
  }

  return result.data
}
