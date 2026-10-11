import { redirect } from 'next/navigation'

import { requireRoamingCharacter } from '@/server/character/require-roaming-character'

export const dynamic = 'force-dynamic'

export default async function LoadoutPage() {
  await requireRoamingCharacter()
  redirect('/game/nexus')
}
