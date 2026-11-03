import { LoadoutHeader } from '@/components/character/loadout-header'
import { CharacterItems } from '@/components/character/character-items'
import { requireRoamingCharacter } from '@/server/character/require-roaming-character'
import { loadCharacterItems } from '@/server/character/character-items-service'
import { createSupabaseCharacterItemsRepository } from '@/server/character/supabase-character-items-repository'
export const dynamic = 'force-dynamic'
export default async function ItemsPage() {
  const { actor, character } = await requireRoamingCharacter()
  const view = await Promise.resolve()
    .then(() =>
      loadCharacterItems(actor.userId, character.id, createSupabaseCharacterItemsRepository()),
    )
    .catch(() => null)
  return (
    <section data-composition="correction">
      <LoadoutHeader active="items" />
      <CharacterItems initialView={view} />
    </section>
  )
}
