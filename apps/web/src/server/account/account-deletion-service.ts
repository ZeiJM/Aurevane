import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'
import { createClient } from '@supabase/supabase-js'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getPublicSupabaseConfig } from '@/lib/supabase/config'

export interface AccountDeletionState {
  requestedAt: string
  deleteAfter: string
}

export async function getAccountDeletionState(
  userId: string,
): Promise<AccountDeletionState | null> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('get_account_deletion_state_v1', {
    p_user_id: userId,
  })

  if (error) throw unavailable()

  const row = Array.isArray(data) && data.length === 1 ? data[0] : null
  if (!row) return null
  if (typeof row.requested_at !== 'string' || typeof row.delete_after !== 'string') {
    throw unavailable()
  }

  return {
    requestedAt: row.requested_at,
    deleteAfter: row.delete_after,
  }
}

export async function requestAccountDeletion(
  userId: string,
  password: string,
): Promise<AccountDeletionState> {
  if (password.length < 1 || password.length > 1024) {
    throw new AurevaneError('INVALID_REQUEST', 'Enter your current account password to continue.')
  }

  await verifyCurrentPassword(userId, password)

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('request_account_deletion_v1', {
    p_user_id: userId,
  })

  if (error) throw unavailable()

  const row = Array.isArray(data) && data.length === 1 ? data[0] : null
  if (!row || typeof row.requested_at !== 'string' || typeof row.delete_after !== 'string') {
    throw unavailable()
  }

  return {
    requestedAt: row.requested_at,
    deleteAfter: row.delete_after,
  }
}

export async function cancelAccountDeletion(userId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('cancel_account_deletion_v1', {
    p_user_id: userId,
  })

  if (error || typeof data !== 'boolean') throw unavailable()
  return data
}

async function verifyCurrentPassword(userId: string, password: string): Promise<void> {
  const admin = createSupabaseAdminClient()
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId)
  const email = userData.user?.email

  if (userError || !email) {
    throw new AurevaneError('UNAUTHENTICATED', 'Your account could not be verified. Sign in again.')
  }

  const publicConfig = getPublicSupabaseConfig()
  const verifier = createClient(publicConfig.url, publicConfig.publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })

  const { data, error } = await verifier.auth.signInWithPassword({ email, password })
  if (error || data.user?.id !== userId) {
    throw new AurevaneError(
      'FORBIDDEN',
      'That password is incorrect. Account deletion was not scheduled.',
    )
  }

  if (data.session) {
    await verifier.auth.signOut({ scope: 'local' })
  }
}

function unavailable(): AurevaneError {
  return new AurevaneError(
    'PERSISTENCE_UNAVAILABLE',
    'Account deletion services are unavailable right now. Nothing was deleted.',
  )
}
