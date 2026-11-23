import { statusDefinitionIdsForGameplayTag } from './gameplay-tags'
import type { RequirementNode } from './combat-requirements'
import type { CombatSummonInstance } from './combat-effect-state'
import type { SummonAbilityDefinition } from './summon-content'
import type { StatDrivenCombatEncounterState } from './stat-driven-combat'
import { reattachStatDrivenCombatBridge } from './stat-driven-combat'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import {
  reconcileCombatAbilitySources,
  combatAbilityCommandContext,
} from './combat-behavior-runtime'
import { prepareCombatAbilityCommand } from './combat-ability-command'
import type { CombatTagPayload } from './combat-tag-registry'
import type { CombatContentCatalog, CombatTargetSelection } from './actions'

/** The summon keeps its pinned ability/costs; a genuine captured Manual source owns the counter. */
export function prepareSummonReversal(
  state: StatDrivenCombatEncounterState,
  summon: CombatSummonInstance,
  ability: SummonAbilityDefinition,
  target: CombatTargetSelection,
  content: CombatContentCatalog,
) {
  const requirements: RequirementNode[] = ability.requirements.map<RequirementNode>(
    (requirement) => {
      if (requirement.kind === 'actor-hp-at-most')
        return {
          kind: 'resource-state',
          subject: 'owner',
          resource: 'hp',
          comparison: 'at-most',
          basisPoints: requirement.basisPoints,
        }
      if ('statusId' in requirement)
        return {
          kind: 'status-presence',
          subject: requirement.kind === 'target-status-present' ? 'selected' : 'owner',
          statusId: requirement.statusId,
          present: requirement.kind !== 'actor-status-absent',
        }
      const present = requirement.kind !== 'actor-tag-absent'
      const children = statusDefinitionIdsForGameplayTag(
        requirement.tag,
        content,
      ).map<RequirementNode>((statusId) => ({
        kind: 'status-presence',
        subject: requirement.kind === 'target-tag-present' ? 'selected' : 'owner',
        statusId,
        present,
      }))
      return present ? { kind: 'any', children } : { kind: 'all', children }
    },
  )
  const source = captureCombatAbilitySource({
    schemaVersion: 1,
    sourceInstanceId: `summon-reversal:${summon.combatantId}:${ability.id}`,
    ownerCombatantId: summon.combatantId,
    abilityId: ability.id,
    contentVersion: summon.sourceSkillVersion,
    sourceKind: 'tactical-entity',
    tags: ability.tags,
    definition: {
      schemaVersion: 1,
      behaviors: [
        {
          id: 'reversal',
          activation: 'manual',
          mode: 'action',
          classification: 'utility',
          costs: [
            { resource: 'ap', amount: ability.apCost },
            { resource: 'mp', amount: ability.mpCost },
            ...(ability.hpCost ? [{ resource: 'hp' as const, amount: ability.hpCost }] : []),
          ],
          cooldown: ability.cooldownOwnerTurns
            ? { key: ability.id, ownerTurns: ability.cooldownOwnerTurns }
            : null,
          requirements: requirements.length ? { kind: 'all', children: requirements } : null,
          targeting: { ...ability.target, maximumSelections: 1 },
          effects: ability.effects.map((effect, index) => ({
            id: `effect-${index + 1}`,
            timing: effect.type === 'reversal' ? ('controlled' as const) : undefined,
            payload:
              effect.type === 'percentage-recovery'
                ? ((({ percent, ...rest }) => ({ ...rest, percentageBasisPoints: percent * 100 }))(
                    effect,
                  ) as CombatTagPayload)
                : (effect as CombatTagPayload),
          })),
        },
      ],
    },
  })
  const sources = [
    ...(state.capturedAbilitySources ?? []).filter(
      (row) =>
        state.abilityRuntime?.activeSourceIds.includes(row.sourceInstanceId) &&
        row.sourceInstanceId !== source.sourceInstanceId,
    ),
    source,
  ]
  const prepared = reattachStatDrivenCombatBridge(
    reconcileCombatAbilitySources(state, sources),
    state.statBridge,
  )
  const command = {
    state: prepared,
    actorId: summon.combatantId,
    root: { kind: 'canonical' as const, source, behaviorId: 'reversal' },
    selection: target,
    content,
    context: combatAbilityCommandContext(prepared, source),
    reversalPreparation: true as const,
  }
  return { prepared, source, command, quote: prepareCombatAbilityCommand(command) }
}
