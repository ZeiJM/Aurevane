import { AurevaneError } from '@aurevane/game-core/errors'
import { NextResponse } from 'next/server'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'

const MAX_AVATAR_URL_LENGTH = 2048

function normalizeAvatarUrl(input: unknown): string {
  if (typeof input !== 'string') {
    throw new AurevaneError('INVALID_REQUEST', 'Paste a direct HTTPS image URL.')
  }
  const value = input.trim()
  if (!value || value.length > MAX_AVATAR_URL_LENGTH) {
    throw new AurevaneError('INVALID_REQUEST', 'Paste a direct HTTPS image URL up to 2048 characters.')
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new AurevaneError('INVALID_REQUEST', 'That avatar URL is not valid.')
  }
  if (url.protocol !== 'https:') {
    throw new AurevaneError('INVALID_REQUEST', 'Avatar images must use HTTPS.')
  }
  return url.toString()
}

async function saveAvatarUrl(userId: string, avatarUrl: string | null) {
  const supabase = createSupabaseAdminClient()
  const { error } = await supabase
    .from('player_profiles')
    .update({ avatar_url: avatarUrl })
    .eq('user_id', userId)

  if (error) {
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Avatar settings could not be saved.')
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await getAuthenticatedActor()
    const body = (await request.json()) as { avatarUrl?: unknown }
    const avatarUrl = normalizeAvatarUrl(body.avatarUrl)
    await saveAvatarUrl(actor.userId, avatarUrl)
    return NextResponse.json({ avatarUrl }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function DELETE() {
  try {
    const actor = await getAuthenticatedActor()
    await saveAvatarUrl(actor.userId, null)
    return NextResponse.json({ avatarUrl: null }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
