import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function LegacyArsenalRoute() {
  redirect('/game/nexus')
}
