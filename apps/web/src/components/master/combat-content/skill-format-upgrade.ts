import { combatTargetAllowsHostileHit } from '@aurevane/game-core/combat/combat-targeting-shapes'
import type {
  MatureSkillDefinition,
  MatureSkillEffectDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import type { RequirementNode } from '@aurevane/game-core/combat/combat-requirements'
import type { CombatUseRequirement } from '@aurevane/game-core/combat/actions'
import type { CombatTagPayload } from '@aurevane/game-core/combat/combat-tag-registry'
import { statusDefinitionIdsForGameplayTag } from '@aurevane/game-core/combat/gameplay-tags'
import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-combat-content'

export function skillHasDifferentContextRules(value: MatureSkillDefinition): boolean {
  return Object.values(value.overrides).some(
    (row) =>
      row &&
      ((row.apCost !== undefined && row.apCost !== value.apCost) ||
        (row.cooldownOwnerTurns !== undefined &&
          row.cooldownOwnerTurns !== value.cooldown?.ownerTurns)),
  )
}

function requirement(value: CombatUseRequirement): RequirementNode {
  if (value.kind === 'actor-hp-at-most')
    return {
      kind: 'resource-state',
      subject: 'owner',
      resource: 'hp',
      comparison: 'at-most',
      basisPoints: value.basisPoints,
    }
  if ('statusId' in value)
    return {
      kind: 'status-presence',
      subject: value.kind.startsWith('actor-') ? 'owner' : 'selected',
      statusId: value.statusId,
      present: value.kind !== 'actor-status-absent',
    }
  const ids = statusDefinitionIdsForGameplayTag(value.tag, PV1F_COMBAT_CONTENT)
  if (!ids.length) throw new Error(`No status identities are registered for ${value.tag}.`)
  const present = value.kind !== 'actor-tag-absent'
  const children: RequirementNode[] = ids.map((statusId) => ({
    kind: 'status-presence',
    subject: value.kind.startsWith('actor-') ? 'owner' : 'selected',
    statusId,
    present,
  }))
  return children.length === 1 ? children[0]! : { kind: present ? 'any' : 'all', children }
}

function payload(
  effect: MatureSkillEffectDefinition,
  value: MatureSkillDefinition,
): CombatTagPayload {
  if (effect.type === 'summon') {
    if (!value.summonProfile) throw new Error('The Summon profile is missing.')
    return {
      type: 'summon',
      recipient: 'selected-tile',
      profile: structuredClone(value.summonProfile),
    }
  }
  if (effect.type === 'percentage-recovery') {
    const { percent, ...rest } = effect
    return { ...rest, percentageBasisPoints: percent * 100 }
  }
  if (
    effect.type === 'apply-status' &&
    ['wet', 'conductive'].includes(effect.statusId) &&
    effect.potencyBasisPoints === undefined &&
    value.effects.some(
      (hit) =>
        hit.type === 'damage' &&
        hit.element === (effect.statusId === 'wet' ? 'water' : 'storm') &&
        hit.recipient === effect.recipient,
    )
  )
    return { ...effect, potencyBasisPoints: 2000 }
  if (effect.type === 'damage') {
    const { piercing, shattersBarrier, ...rest } = effect
    if (piercing || shattersBarrier) {
      if (rest.vengeance)
        throw new Error('Separate the retained combined Pierce/Vengeance damage before upgrading.')
      const { vengeance: _vengeance, ...pierce } = rest
      void _vengeance
      return {
        ...pierce,
        type: 'pierce',
        armorIgnoredBasisPoints: piercing ? 10000 : 0,
        ...(piercing ? { defenseKind: undefined } : {}),
      }
    }
    return rest
  }
  return structuredClone(effect)
}

/** Explicit draft conversion; saved/native captures are never rewritten on read. */
export function upgradeSkillFormat(
  value: MatureSkillDefinition,
  context?: 'base' | 'pvp' | 'pve',
): MatureSkillDefinition {
  if (value.ability) return structuredClone(value)
  if (!context && skillHasDifferentContextRules(value))
    throw new Error('Choose which context rules to carry into the shared format.')
  const override = context && context !== 'base' ? value.overrides[context] : undefined
  const effects = value.effects.map((effect, index) => ({
    id: `effect-${index + 1}`,
    payload: payload(effect, value),
  }))
  const requirements = value.requirements.map(requirement)
  const attack = value.tags.includes('attack')
  const { entryEffectOrdinals, ...ground } = value.groundArea ?? { entryEffectOrdinals: [] }
  return {
    ...structuredClone(value),
    overrides: {},
    ability: {
      schemaVersion: 1,
      behaviors: [
        {
          id: 'main',
          activation: 'manual',
          mode: 'action',
          classification: attack ? 'attack' : value.tags.includes('heal') ? 'recovery' : 'utility',
          ...(attack
            ? {
                attackFamily: value.tags.includes('mystic')
                  ? ('mystic' as const)
                  : ('physical' as const),
              }
            : {}),
          costs: [
            { resource: 'ap', amount: override?.apCost ?? value.apCost },
            ...(value.mpCost !== undefined
              ? [{ resource: 'mp' as const, amount: value.mpCost }]
              : []),
            ...(value.hpCost !== undefined
              ? [{ resource: 'hp' as const, amount: value.hpCost }]
              : []),
          ],
          cooldown: value.cooldown
            ? {
                ...value.cooldown,
                ownerTurns: override?.cooldownOwnerTurns ?? value.cooldown.ownerTurns,
              }
            : null,
          requirements:
            requirements.length > 1
              ? { kind: 'all', children: requirements }
              : (requirements[0] ?? null),
          targeting: {
            ...structuredClone(value.target),
            maximumSelections: value.target.maximumSelections ?? 1,
          },
          effects,
          ...(value.groundArea
            ? {
                groundArea: {
                  ...ground,
                  entryEffectIds: entryEffectOrdinals.map((index) => effects[index]!.id),
                } as NonNullable<
                  import('@aurevane/game-core/combat/combat-definition').AbilityBehavior['groundArea']
                >,
              }
            : {}),
          ...(combatTargetAllowsHostileHit(value.target, value.effects) &&
          effects.some(({ payload }) =>
            ['primary-unit', 'affected-units'].includes(payload.recipient),
          )
            ? {
                accuracy:
                  value.accuracyRule ??
                  (value.accuracyMode === 'per-target'
                    ? { kind: 'standard' as const }
                    : { kind: 'fixed' as const, chanceBasisPoints: 10000 }),
              }
            : {}),
        },
      ],
    },
  }
}
