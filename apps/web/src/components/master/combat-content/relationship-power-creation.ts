import { canonicalResonancePair } from '@aurevane/game-core/combat/resonance'
import { newResonanceAbility } from './new-resonance-ability'
import type {
  CombatContentDefinition,
  CompleteCombatContentRecord,
} from '@aurevane/db/combat-content'
import type { EssenceDefinition } from '@aurevane/game-core/combat/essence'
import type {
  AnyResonanceDefinition,
  ResonanceSkillMatcher,
} from '@aurevane/game-core/combat/resonance'
import type { AbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { createDisciplineSkillDraft } from './discipline-skill-creation'

export function createRelationshipPowerDraft(
  kind: 'essence' | 'resonance',
  source: CombatContentDefinition,
  disciplineId: string,
  partner: string | null,
  contentKey: string,
): CombatContentDefinition {
  const cooldowns = new Map<string, string>()
  const ability = (value: AbilityDefinition | undefined): AbilityDefinition | undefined =>
    value && {
      ...structuredClone(value),
      tagPresentation: undefined,
      behaviors: value.behaviors.map((row) => {
        if (row.cooldown && !cooldowns.has(row.cooldown.key))
          cooldowns.set(row.cooldown.key, `${contentKey}.cooldown-${cooldowns.size + 1}`)
        return {
          ...structuredClone(row),
          cooldown: row.cooldown
            ? { ...row.cooldown, key: cooldowns.get(row.cooldown.key)! }
            : null,
        }
      }),
    }
  if (kind === 'essence') {
    if (partner !== null) throw new Error('An Essence belongs to one Discipline.')
    const original = structuredClone(source) as unknown as EssenceDefinition
    const skill = createDisciplineSkillDraft(original.skill, disciplineId, contentKey)
    return {
      ...original,
      essenceId: contentKey,
      contentVersion: 1,
      sourceDisciplineId: disciplineId,
      name: 'New Essence',
      description: 'Describe this Essence.',
      flavorLine: 'A focused surge breaks the stillness.',
      authoring: { ...original.authoring, status: 'representative' },
      relationshipOverrideDisciplineId: undefined,
      ...(original.ability ? { ability: ability(original.ability) } : {}),
      skill: {
        ...skill,
        name: 'New Essence',
        description: 'Describe this Essence.',
        flavorLine: 'A focused surge breaks the stillness.',
        tagPresentation: undefined,
        ...(original.skill.ability ? { ability: ability(original.skill.ability) } : {}),
      },
    }
  }
  if (!partner || partner === disciplineId)
    throw new Error('Choose a different partner Discipline.')
  const original = structuredClone(source) as unknown as AnyResonanceDefinition
  const mapping = new Map([
    [original.disciplinePair[0], disciplineId],
    [original.disciplinePair[1], partner],
  ])
  const matcher = (value: ResonanceSkillMatcher): ResonanceSkillMatcher => ({
    ...value,
    sourceDisciplineId: mapping.get(value.sourceDisciplineId) ?? value.sourceDisciplineId,
  })
  const trigger =
    original.trigger.kind === 'skill-sequence'
      ? {
          ...original.trigger,
          setup: matcher(original.trigger.setup),
          payoff: matcher(original.trigger.payoff),
        }
      : {
          ...original.trigger,
          setup: original.trigger.setup ? matcher(original.trigger.setup) : null,
          trigger: matcher(original.trigger.trigger),
        }
  return {
    ...original,
    id: contentKey,
    contentVersion: 1,
    disciplinePair: canonicalResonancePair(disciplineId, partner),
    name: 'New Resonance',
    description: 'Describe this Resonance.',
    flavorLine: undefined,
    authoring: { ...original.authoring, status: 'representative' },
    relationshipOverrideDisciplineId: undefined,
    tagPresentation: undefined,
    trigger,
    ability: ability(original.ability) ?? newResonanceAbility(),
  }
}

type Selection = { withDisciplineId: string; resonanceId: string }

export class DisciplineRelationshipCommitError extends Error {}

/** Preflight changed slots only; publication still rechecks everything atomically. */
export async function assertDisciplineRelationshipsReady(
  base: CombatContentDefinition | null,
  next: CombatContentDefinition,
  read: (key: string) => Promise<CompleteCombatContentRecord | null>,
): Promise<void> {
  const previous = (base?.resonanceSelections as Selection[] | undefined) ?? []
  const selections: { partner: string | null; key: unknown; before: unknown }[] = [
    { partner: null, key: next.essenceId, before: base?.essenceId },
    ...((next.resonanceSelections as Selection[] | undefined) ?? []).map((row) => ({
      partner: row.withDisciplineId,
      key: row.resonanceId,
      before: previous.find((old) => old.withDisciplineId === row.withDisciplineId)?.resonanceId,
    })),
  ]
  const rows = selections.filter(
    (row): row is { partner: string | null; key: string; before: unknown } =>
      typeof row.key === 'string' && !!row.key && row.key !== row.before,
  )
  // This is a bounded authoring-only check, never a gameplay read or child write.
  const records = await Promise.all(rows.map((row) => read(row.key)))
  for (const [index, row] of rows.entries()) {
    const record = records[index]
    const definition = record?.current?.definition
    const kind = row.partner === null ? 'essence' : 'resonance'
    const owned =
      row.partner === null
        ? definition?.sourceDisciplineId === next.id
        : Array.isArray(definition?.disciplinePair) &&
          definition.disciplinePair.length === 2 &&
          definition.disciplinePair.includes(next.id) &&
          definition.disciplinePair.includes(row.partner)
    if (
      !record ||
      record.contentKey !== row.key ||
      record.contentKind !== kind ||
      record.lifecycle !== 'active' ||
      !definition ||
      definition.enabled === false ||
      !owned
    ) {
      const label = row.partner === null ? 'Essence' : 'Resonance'
      const reason =
        record?.lifecycle === 'draft' || (record && !record.current)
          ? 'Commit the power in its editor first.'
          : 'The selected power is missing, disabled or belongs to another relationship.'
      throw new DisciplineRelationshipCommitError(
        `${label} selection needs attention. ${reason} Change or clear this relationship in Resonances; your other edits are retained.`,
      )
    }
  }
}

/** Save the reviewed slot only, even if the same power is referenced elsewhere. */
export function disciplineRelationshipCommit(
  base: CombatContentDefinition,
  local: CombatContentDefinition,
  powerKey: string,
  partner: string | null,
): CombatContentDefinition | null {
  const before =
    partner === null
      ? base.essenceId
      : (base.resonanceSelections as Selection[] | undefined)?.find(
          (row) => row.withDisciplineId === partner,
        )?.resonanceId
  const after =
    partner === null
      ? local.essenceId
      : (local.resonanceSelections as Selection[] | undefined)?.find(
          (row) => row.withDisciplineId === partner,
        )?.resonanceId
  if (before === after || (after !== powerKey && (after || before !== powerKey))) return null
  const clearOverride =
    !after &&
    (base.relationshipOverride as { withDisciplineId?: string | null } | undefined)
      ?.withDisciplineId === partner
      ? { relationshipOverride: null }
      : {}
  if (partner === null) return { ...base, essenceId: after ?? null, ...clearOverride }
  const rows = (base.resonanceSelections as Selection[] | undefined) ?? []
  return {
    ...base,
    ...clearOverride,
    resonanceSelections: after
      ? rows.some((row) => row.withDisciplineId === partner)
        ? rows.map((row) =>
            row.withDisciplineId === partner ? { ...row, resonanceId: after } : row,
          )
        : [...rows, { withDisciplineId: partner, resonanceId: after }]
      : rows.filter((row) => row.withDisciplineId !== partner),
  }
}
