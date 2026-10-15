import {
  defaultBasicSkills,
  type BasicSkillDefinition,
} from '@aurevane/game-core/combat/combat-basic-actions'
import type { BasicContentEditorOption } from '@/components/master/combat-content/basic-content-editor'
import { SkillEffectTimingProvider } from '@/components/character/skill-effect-timing-context'
import {
  currentEssenceDefinitions,
  type EssenceDefinition,
} from '@aurevane/game-core/combat/essence'
import {
  latestEnabledMatureSkills,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import {
  currentResonanceDefinitions,
  type AnyResonanceDefinition,
} from '@aurevane/game-core/combat/resonance'
import type { CombatContentEditorSkillOption } from '@/components/master/combat-content/combat-content-editor'
import { CombatContentAuthoringWorkspace } from '@/components/master/combat-content/combat-content-authoring-workspace'
import type { EssenceContentEditorOption } from '@/components/master/combat-content/essence-content-editor'
import type { ResonanceContentEditorOption } from '@/components/master/combat-content/resonance-content-editor'
import type { CombatContentVersionHistoryEntry } from '@/components/master/combat-content/combat-content-workflow'
import { MasterPanelShell } from '@/components/master/master-panel-shell'
import {
  createServerCombatContentResolver,
  deriveSkillPresentationTags,
  type CombatContentCatalogueEntry,
} from '@/server/combat/combat-content-resolver'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import { createSupabaseCombatContentAuthoringStore } from '@/server/master/supabase-combat-content-authoring-store'

export const dynamic = 'force-dynamic'

async function mapInBatches<T, R>(
  values: readonly T[],
  batchSize: number,
  project: (value: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  for (let index = 0; index < values.length; index += batchSize) {
    results.push(...(await Promise.all(values.slice(index, index + batchSize).map(project))))
  }
  return results
}
function titleSkill(skillId: string): string {
  const tail = skillId.includes('.') ? skillId.slice(skillId.indexOf('.') + 1) : skillId
  return tail
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default async function MasterCombatContentPage() {
  const { actor, access } = await requireMasterPanelPageAccess('content.combat.author')
  const resolver = createServerCombatContentResolver()
  const store = createSupabaseCombatContentAuthoringStore(actor.userId)
  // One authoritative current snapshot includes custom and disabled publications.
  // Per-record drafts/history remain separate from the selected current definition.
  if (!resolver.resolveCurrentCatalogue)
    throw new Error('Authoritative combat catalogue is unavailable.')
  const catalogue = await resolver.resolveCurrentCatalogue()
  const builtinVersions = new Map<string, number>([
    ...defaultBasicSkills().map((row) => [row.id, row.contentVersion] as const),
    ...latestEnabledMatureSkills().map((row) => [row.id, row.contentVersion] as const),
    ...currentEssenceDefinitions().map((row) => [row.essenceId, row.contentVersion] as const),
    ...currentResonanceDefinitions().map((row) => [row.id, row.contentVersion] as const),
  ])
  async function authoringState(entry: CombatContentCatalogueEntry) {
    const [draft, publishedVersions] = await Promise.all([
      store.findDraft(entry.contentKey),
      store.listPublishedVersions(entry.contentKey),
    ])
    if (draft && draft.contentKind !== entry.contentKind) {
      throw new Error(`Draft kind does not match authoritative content ${entry.contentKey}.`)
    }
    const history = new Map<number, CombatContentVersionHistoryEntry>()
    const builtinVersion = builtinVersions.get(entry.contentKey)
    if (builtinVersion !== undefined)
      history.set(builtinVersion, {
        contentVersion: builtinVersion,
        source: 'static-baseline',
        current: builtinVersion === entry.contentVersion,
        publishedAt: null,
      })
    for (const version of publishedVersions) {
      if (version.contentKind !== entry.contentKind) continue
      history.set(version.contentVersion, {
        contentVersion: version.contentVersion,
        source: 'published',
        current: version.contentVersion === entry.contentVersion,
        publishedAt: version.publishedAt,
      })
    }
    // A later history read may race a pointer change; the snapshot remains this page's baseline.
    if (!history.has(entry.contentVersion))
      history.set(entry.contentVersion, {
        contentVersion: entry.contentVersion,
        source: entry.source === 'builtin' ? 'static-baseline' : 'published',
        current: true,
        publishedAt: null,
      })
    return {
      currentVersion: entry.contentVersion,
      baseVersion: draft ? draft.baseVersion : entry.contentVersion,
      draftVersion: draft?.draftVersion ?? null,
      history: [...history.values()].sort(
        (left, right) => left.contentVersion - right.contentVersion,
      ),
      draft,
    }
  }
  const basics = await mapInBatches(
    catalogue.entries.filter((entry) => entry.category === 'basic'),
    4,
    async (entry): Promise<BasicContentEditorOption> => {
      const { draft, ...state } = await authoringState(entry)
      const current = structuredClone(entry.definition)
      return {
        ...state,
        id: current.id,
        label: current.name,
        definition: current,
        ...(draft
          ? { initialDraft: structuredClone(draft.definition) as unknown as BasicSkillDefinition }
          : {}),
      }
    },
  )
  const basicOrder = defaultBasicSkills().map((row) => row.id)
  basics.sort((left, right) => basicOrder.indexOf(left.id) - basicOrder.indexOf(right.id))
  const options = await mapInBatches(
    catalogue.entries.filter((entry) => entry.category === 'skill'),
    4,
    async (entry): Promise<CombatContentEditorSkillOption> => {
      const { draft, ...state } = await authoringState(entry)
      const current = structuredClone(entry.definition)
      return {
        ...state,
        id: current.id,
        sourceDisciplineId: current.sourceDisciplineId,
        label: titleSkill(current.id),
        derivedTags: [...deriveSkillPresentationTags(current)],
        definition: current,
        ...(draft
          ? { initialDraft: structuredClone(draft.definition) as unknown as MatureSkillDefinition }
          : {}),
      }
    },
  )
  options.sort(
    (left, right) =>
      left.sourceDisciplineId.localeCompare(right.sourceDisciplineId) ||
      left.id.localeCompare(right.id),
  )
  const essences = await mapInBatches(
    catalogue.entries.filter((entry) => entry.category === 'essence'),
    4,
    async (entry): Promise<EssenceContentEditorOption> => {
      const { draft, ...state } = await authoringState(entry)
      const current = structuredClone(entry.definition)
      return {
        ...state,
        id: current.essenceId,
        sourceDisciplineId: current.sourceDisciplineId,
        label: current.name,
        derivedTags: [...deriveSkillPresentationTags(current.skill)],
        definition: current,
        ...(draft
          ? { initialDraft: structuredClone(draft.definition) as unknown as EssenceDefinition }
          : {}),
      }
    },
  )
  essences.sort(
    (left, right) =>
      left.sourceDisciplineId.localeCompare(right.sourceDisciplineId) ||
      left.id.localeCompare(right.id),
  )
  const resonances = await mapInBatches(
    catalogue.entries.filter((entry) => entry.category === 'resonance'),
    4,
    async (entry): Promise<ResonanceContentEditorOption> => {
      const { draft, ...state } = await authoringState(entry)
      const current = structuredClone(entry.definition)
      return {
        ...state,
        id: current.id,
        label: current.name,
        disciplinePair: current.disciplinePair,
        definition: current,
        ...(draft
          ? { initialDraft: structuredClone(draft.definition) as unknown as AnyResonanceDefinition }
          : {}),
      }
    },
  )
  resonances.sort((left, right) => left.label.localeCompare(right.label))
  return (
    <SkillEffectTimingProvider policy={catalogue.policy}>
      <MasterPanelShell
        access={access}
        activeSection="combat"
        title="Combat Content"
        description="Create and refine typed, versioned Skills without stepping outside the canonical combat engine."
      >
        <CombatContentAuthoringWorkspace
          key={[
            ...basics.map(
              (option) =>
                `basic:${option.id}:${option.currentVersion}:${option.draftVersion ?? 'none'}`,
            ),
            ...options.map(
              (option) =>
                `skill:${option.id}:${option.currentVersion}:${option.draftVersion ?? 'none'}`,
            ),
            ...essences.map(
              (option) =>
                `essence:${option.id}:${option.currentVersion}:${option.draftVersion ?? 'none'}`,
            ),
            ...resonances.map(
              (option) =>
                `resonance:${option.id}:${option.currentVersion}:${option.draftVersion ?? 'none'}`,
            ),
          ].join('|')}
          basics={basics}
          skills={options}
          essences={essences}
          resonances={resonances}
        />
      </MasterPanelShell>
    </SkillEffectTimingProvider>
  )
}
