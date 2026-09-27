import {
  resolveEssenceForBuild,
  validateEssenceDefinition,
  type EssenceDefinition,
} from '@aurevane/game-core/combat/essence'
import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import {
  resolveResonanceForPair,
  validateResonanceDefinition,
  type ResonanceDefinition,
} from '@aurevane/game-core/combat/resonance'
import type { CombatContentEditorSkillOption } from '@/components/master/combat-content/combat-content-editor'
import {
  CombatContentAuthoringWorkspace,
} from '@/components/master/combat-content/combat-content-authoring-workspace'
import type { EssenceContentEditorOption } from '@/components/master/combat-content/essence-content-editor'
import type { ResonanceContentEditorOption } from '@/components/master/combat-content/resonance-content-editor'
import { MasterPanelShell } from '@/components/master/master-panel-shell'
import {
  createServerCombatContentResolver,
  deriveSkillPresentationTags,
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
  const catalog = latestEnabledMatureSkills()

  const options = (
    await mapInBatches(
      catalog,
      4,
      async (staticDefinition): Promise<CombatContentEditorSkillOption | null> => {
        const [current, draft, publishedVersions] = await Promise.all([
          resolver.resolveCurrentSkillDefinition(staticDefinition.id),
          store.findDraft(staticDefinition.id),
          store.listPublishedVersions(staticDefinition.id),
        ])
        if (!current) return null

        const historyByVersion = new Map<
          number,
          NonNullable<CombatContentEditorSkillOption['history']>[number]
        >()
        historyByVersion.set(staticDefinition.contentVersion, {
          contentVersion: staticDefinition.contentVersion,
          source: 'static-baseline',
          current: current.contentVersion === staticDefinition.contentVersion,
          publishedAt: null,
        })
        for (const version of publishedVersions) {
          historyByVersion.set(version.contentVersion, {
            contentVersion: version.contentVersion,
            source: 'published',
            current: current.contentVersion === version.contentVersion,
            publishedAt: version.publishedAt,
          })
        }

        return {
          id: current.id,
          sourceDisciplineId: current.sourceDisciplineId,
          label: titleSkill(current.id),
          currentVersion: current.contentVersion,
          baseVersion: draft?.baseVersion ?? current.contentVersion,
          draftVersion: draft?.draftVersion ?? null,
          derivedTags: [...deriveSkillPresentationTags(current)],
          definition: structuredClone(current),
          history: [...historyByVersion.values()].sort(
            (left, right) => left.contentVersion - right.contentVersion,
          ),
        }
      },
    )
  )
    .filter((option): option is CombatContentEditorSkillOption => option !== null)
    .sort(
      (left, right) =>
        left.sourceDisciplineId.localeCompare(right.sourceDisciplineId) ||
        left.id.localeCompare(right.id),
    )


  const disciplineIds = [...new Set(catalog.map((skill) => skill.sourceDisciplineId))]
  const staticEssences = disciplineIds
    .map((disciplineId) => resolveEssenceForBuild(disciplineId, null))
    .filter((definition): definition is EssenceDefinition => definition !== null)

  const essences = (
    await mapInBatches(
      staticEssences,
      4,
      async (staticDefinition): Promise<EssenceContentEditorOption> => {
        const [published, draft, publishedVersions] = await Promise.all([
          store.findPublished(staticDefinition.essenceId),
          store.findDraft(staticDefinition.essenceId),
          store.listPublishedVersions(staticDefinition.essenceId),
        ])
        const current =
          published?.contentKind === 'essence'
            ? (structuredClone(published.definition) as unknown as EssenceDefinition)
            : structuredClone(staticDefinition)
        if (validateEssenceDefinition(current).length > 0) {
          throw new Error(`Invalid authoritative Essence ${staticDefinition.essenceId}.`)
        }

        const historyByVersion = new Map<
          number,
          EssenceContentEditorOption['history'][number]
        >()
        historyByVersion.set(staticDefinition.contentVersion, {
          contentVersion: staticDefinition.contentVersion,
          source: 'static-baseline',
          current: current.contentVersion === staticDefinition.contentVersion,
          publishedAt: null,
        })
        for (const version of publishedVersions) {
          if (version.contentKind !== 'essence') continue
          historyByVersion.set(version.contentVersion, {
            contentVersion: version.contentVersion,
            source: 'published',
            current: current.contentVersion === version.contentVersion,
            publishedAt: version.publishedAt,
          })
        }

        const initialDraft =
          draft?.contentKind === 'essence'
            ? (structuredClone(draft.definition) as unknown as EssenceDefinition)
            : undefined

        return {
          id: current.essenceId,
          sourceDisciplineId: current.sourceDisciplineId,
          label: current.name,
          currentVersion: current.contentVersion,
          baseVersion: draft?.baseVersion ?? current.contentVersion,
          draftVersion: draft?.draftVersion ?? null,
          derivedTags: [...deriveSkillPresentationTags(current.skill)],
          definition: current,
          ...(initialDraft ? { initialDraft } : {}),
          history: [...historyByVersion.values()].sort(
            (left, right) => left.contentVersion - right.contentVersion,
          ),
        }
      },
    )
  ).sort(
    (left, right) =>
      left.sourceDisciplineId.localeCompare(right.sourceDisciplineId) ||
      left.id.localeCompare(right.id),
  )


  const staticResonances: ResonanceDefinition[] = []
  for (let firstIndex = 0; firstIndex < disciplineIds.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < disciplineIds.length; secondIndex += 1) {
      const definition = resolveResonanceForPair(
        disciplineIds[firstIndex]!,
        disciplineIds[secondIndex]!,
      )
      if (definition && !staticResonances.some((candidate) => candidate.id === definition.id)) {
        staticResonances.push(definition)
      }
    }
  }

  const resonances = (
    await mapInBatches(
      staticResonances,
      4,
      async (staticDefinition): Promise<ResonanceContentEditorOption> => {
        const [published, draft, publishedVersions] = await Promise.all([
          store.findPublished(staticDefinition.id),
          store.findDraft(staticDefinition.id),
          store.listPublishedVersions(staticDefinition.id),
        ])
        const current =
          published?.contentKind === 'resonance'
            ? (structuredClone(published.definition) as unknown as ResonanceDefinition)
            : structuredClone(staticDefinition)
        if (validateResonanceDefinition(current).length > 0) {
          throw new Error(`Invalid authoritative Resonance ${staticDefinition.id}.`)
        }

        const historyByVersion = new Map<
          number,
          ResonanceContentEditorOption['history'][number]
        >()
        historyByVersion.set(staticDefinition.contentVersion, {
          contentVersion: staticDefinition.contentVersion,
          source: 'static-baseline',
          current: current.contentVersion === staticDefinition.contentVersion,
          publishedAt: null,
        })
        for (const version of publishedVersions) {
          if (version.contentKind !== 'resonance') continue
          historyByVersion.set(version.contentVersion, {
            contentVersion: version.contentVersion,
            source: 'published',
            current: current.contentVersion === version.contentVersion,
            publishedAt: version.publishedAt,
          })
        }

        const initialDraft =
          draft?.contentKind === 'resonance'
            ? (structuredClone(draft.definition) as unknown as ResonanceDefinition)
            : undefined

        return {
          id: current.id,
          label: current.name,
          disciplinePair: current.disciplinePair,
          currentVersion: current.contentVersion,
          baseVersion: draft?.baseVersion ?? current.contentVersion,
          draftVersion: draft?.draftVersion ?? null,
          definition: current,
          ...(initialDraft ? { initialDraft } : {}),
          history: [...historyByVersion.values()].sort(
            (left, right) => left.contentVersion - right.contentVersion,
          ),
        }
      },
    )
  ).sort((left, right) => left.label.localeCompare(right.label))

  return (
    <MasterPanelShell
      access={access}
      activeSection="combat"
      title="Combat Content"
      description="Create and refine typed, versioned Skills without stepping outside the canonical combat engine."
    >
      <CombatContentAuthoringWorkspace
        key={[
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
        skills={options}
        essences={essences}
        resonances={resonances}
      />
    </MasterPanelShell>
  )
}
