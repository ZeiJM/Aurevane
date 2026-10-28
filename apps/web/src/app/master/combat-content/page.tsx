import { SkillEffectTimingProvider } from '@/components/character/skill-effect-timing-context'
import { CombatContentAuthoringWorkspace } from '@/components/master/combat-content/combat-content-authoring-workspace'
import { MasterPanelShell } from '@/components/master/master-panel-shell'
import { createServerCombatContentResolver } from '@/server/combat/combat-content-resolver'
import { COMBAT_CONTENT_CATEGORIES } from '@/server/combat/combat-content-categories'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import { createSupabaseCombatContentAuthoringStore } from '@/server/master/supabase-combat-content-authoring-store'
import { isAbilityEditorSection } from '@/lib/ability-editor-sections'
import { BASIC_SKILL_IDS } from '@aurevane/game-core/combat/combat-basic-actions'
export const dynamic = 'force-dynamic'
export default async function MasterCombatContentPage({
  searchParams,
}: { searchParams?: Promise<Record<string, string | string[] | undefined>> } = {}) {
  const { actor, access } = await requireMasterPanelPageAccess('content.combat.author')
  const resolver = createServerCombatContentResolver()
  const store = createSupabaseCombatContentAuthoringStore(actor.userId)
  if (!resolver.resolveCurrentCatalogue)
    throw new Error('Authoritative combat catalogue is unavailable.')
  const query = (await searchParams) ?? {}
  const requestedKey =
    typeof query.contentKey === 'string' && /^[a-z0-9][a-z0-9._-]{0,159}$/i.test(query.contentKey)
      ? query.contentKey
      : null
  const initialAbilitySection = isAbilityEditorSection(query.tab) ? query.tab : undefined
  const cataloguePromise = resolver.resolveCurrentCatalogue()
  const linkedRecord = requestedKey ? await store.readRecord(requestedKey) : null
  const [catalogue, initialPage] = await Promise.all([
    cataloguePromise,
    store.listRecords({
      kind: linkedRecord?.contentKind ?? 'discipline',
      sort: 'name-asc',
      limit: 20,
      ...(linkedRecord?.contentKind === 'skill'
        ? {
            category: (BASIC_SKILL_IDS as readonly string[]).includes(linkedRecord.contentKey)
              ? ('basic' as const)
              : ('discipline-skill' as const),
          }
        : {}),
    }),
  ])
  const initialRecord =
    linkedRecord ??
    (initialPage.records[0] ? await store.readRecord(initialPage.records[0].contentKey) : null)
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
    ...('sourceDisciplineId' in entry.definition &&
    typeof entry.definition.sourceDisciplineId === 'string'
      ? { sourceDisciplineId: entry.definition.sourceDisciplineId }
      : {}),
    ...('disciplinePair' in entry.definition && Array.isArray(entry.definition.disciplinePair)
      ? { disciplinePair: entry.definition.disciplinePair as string[] }
      : {}),
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
          key={actor.userId}
          recoveryScope={
            linkedRecord ? `${actor.userId}:linked:${linkedRecord.contentKey}` : actor.userId
          }
          initialAbilitySection={initialAbilitySection}
          categories={categories}
          initialPage={initialPage}
          initialRecord={initialRecord}
          references={references}
          tagPresentations={catalogue.tagPresentations ?? []}
        />
      </MasterPanelShell>
    </SkillEffectTimingProvider>
  )
}
