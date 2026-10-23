import { SkillEffectTimingProvider } from '@/components/character/skill-effect-timing-context'
import { CombatContentAuthoringWorkspace } from '@/components/master/combat-content/combat-content-authoring-workspace'
import { MasterPanelShell } from '@/components/master/master-panel-shell'
import { createServerCombatContentResolver } from '@/server/combat/combat-content-resolver'
import { COMBAT_CONTENT_CATEGORIES } from '@/server/combat/combat-content-categories'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import { createSupabaseCombatContentAuthoringStore } from '@/server/master/supabase-combat-content-authoring-store'
export const dynamic = 'force-dynamic'
export default async function MasterCombatContentPage() {
  const { actor, access } = await requireMasterPanelPageAccess('content.combat.author')
  const resolver = createServerCombatContentResolver()
  const store = createSupabaseCombatContentAuthoringStore(actor.userId)
  if (!resolver.resolveCurrentCatalogue)
    throw new Error('Authoritative combat catalogue is unavailable.')
  const [catalogue, initialPage] = await Promise.all([
    resolver.resolveCurrentCatalogue(),
    store.listRecords({ kind: 'discipline', sort: 'name-asc', limit: 20 }),
  ])
  const initialRecord = initialPage.records[0]
    ? await store.readRecord(initialPage.records[0].contentKey)
    : null
  const order = [
    'discipline',
    'basic',
    'skill',
    'essence',
    'resonance',
    'item',
    'ascension',
    'severence',
    'tag',
    'status',
    'effect-profile',
  ]
  const categories = COMBAT_CONTENT_CATEGORIES.map((entry) => entry.editor).sort(
    (a, b) => order.indexOf(a.category) - order.indexOf(b.category),
  )
  const references = catalogue.entries.map((entry) => ({
    contentKey: entry.contentKey,
    contentKind: entry.contentKind,
    name: String('name' in entry.definition ? entry.definition.name : entry.contentKey),
  }))
  return (
    <SkillEffectTimingProvider policy={catalogue.policy}>
      <MasterPanelShell
        access={access}
        activeSection="combat"
        title="Game Content"
        description="Create, preview and publish complete content records."
      >
        <CombatContentAuthoringWorkspace
          categories={categories}
          initialPage={initialPage}
          initialRecord={initialRecord}
          references={references}
        />
      </MasterPanelShell>
    </SkillEffectTimingProvider>
  )
}
