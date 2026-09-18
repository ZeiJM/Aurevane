import { advanceBattleRng } from './battle-state'
import { normalizeCombatEffectState, type CombatTemporarySkillGrant } from './combat-effect-state'
import {
  resolveMatureSkillForContext,
  type MatureSkillCombatContext,
  type MatureSkillDefinition,
} from './mature-skills'
import type { StatDrivenCombatEncounterState } from './stat-driven-combat'

const UINT32_CARDINALITY = 0x1_0000_0000

export interface CombatSkillCopyIssue {
  code: 'copy-source-self' | 'copy-pool-empty'
  message: string
}

export interface CombatSkillCopyPreview {
  sourceCombatantId: string
  random: true
  eligibleSkills: readonly { skillId: string; contentVersion: number }[]
  issues: readonly CombatSkillCopyIssue[]
}

export interface CombatSkillCopiedEvent {
  event: 'temporary_skill_copied'
  combatantId: string
  sourceCombatantId: string
  skillId: string
  contentVersion: number
}

export interface CombatSkillCopyInput {
  state: StatDrivenCombatEncounterState
  actorCombatantId: string
  sourceCombatantId: string
  sourceSkills: readonly MatureSkillDefinition[]
  actorCommittedSkills?: readonly MatureSkillDefinition[]
}

function pinnedSkillIdentity(skillId: string, contentVersion: number): string {
  return `${skillId}@${contentVersion}`
}

export function copiedSkillCommandId(skillId: string, contentVersion: number): string {
  return `temporary.copy.${skillId}.v${contentVersion}`
}

export function copiedSkillUsageKey(skillId: string, contentVersion: number): string {
  return `copied:${pinnedSkillIdentity(skillId, contentVersion)}`
}

export function copiedSkillApCost(
  definition: MatureSkillDefinition,
  combatContext: MatureSkillCombatContext,
): number {
  return Math.ceil(resolveMatureSkillForContext(definition, combatContext).apCost / 2)
}

export function eligibleCombatSkillCopies({
  state,
  actorCombatantId,
  sourceCombatantId,
  sourceSkills,
  actorCommittedSkills = [],
}: CombatSkillCopyInput): readonly MatureSkillDefinition[] {
  if (actorCombatantId === sourceCombatantId) return []

  const held = new Set(
    actorCommittedSkills.map((definition) =>
      pinnedSkillIdentity(definition.id, definition.contentVersion),
    ),
  )
  for (const grant of normalizeCombatEffectState(state.effectState).temporarySkills) {
    if (grant.combatantId !== actorCombatantId) continue
    held.add(pinnedSkillIdentity(grant.skillId, grant.contentVersion))
  }

  const unique = new Map<string, MatureSkillDefinition>()
  for (const definition of sourceSkills) {
    if (!definition.enabled) continue
    const identity = pinnedSkillIdentity(definition.id, definition.contentVersion)
    if (held.has(identity) || unique.has(identity)) continue
    unique.set(identity, definition)
  }

  return [...unique.values()].sort(
    (left, right) => left.id.localeCompare(right.id) || left.contentVersion - right.contentVersion,
  )
}

export function previewCombatSkillCopy(input: CombatSkillCopyInput): CombatSkillCopyPreview {
  const eligible = eligibleCombatSkillCopies(input)
  const issues: CombatSkillCopyIssue[] = []
  if (input.actorCombatantId === input.sourceCombatantId) {
    issues.push({
      code: 'copy-source-self',
      message: 'Copy requires a different combatant as its Skill source.',
    })
  } else if (eligible.length === 0) {
    issues.push({
      code: 'copy-pool-empty',
      message: 'That target has no eligible uncopied regular battle Skills.',
    })
  }

  return {
    sourceCombatantId: input.sourceCombatantId,
    random: true,
    eligibleSkills: eligible.map((definition) => ({
      skillId: definition.id,
      contentVersion: definition.contentVersion,
    })),
    issues,
  }
}

export function commitCombatSkillCopy(input: CombatSkillCopyInput): {
  state: StatDrivenCombatEncounterState
  event: CombatSkillCopiedEvent
  definition: MatureSkillDefinition
} {
  const battle = input.state.tactical.battle
  const actor = battle.combatants.find((combatant) => combatant.id === input.actorCombatantId)
  const source = battle.combatants.find((combatant) => combatant.id === input.sourceCombatantId)
  if (!actor || !source) {
    throw new Error('Copy actor and source must belong to the authoritative battle.')
  }

  const eligible = eligibleCombatSkillCopies(input)
  if (eligible.length === 0) {
    throw new Error('Copy has no eligible uncopied regular battle Skill.')
  }

  const draw = advanceBattleRng(battle.rng)
  const index = Math.floor((draw.value / UINT32_CARDINALITY) * eligible.length)
  const definition = eligible[Math.min(index, eligible.length - 1)]!
  const grant: CombatTemporarySkillGrant = {
    combatantId: input.actorCombatantId,
    skillId: definition.id,
    contentVersion: definition.contentVersion,
    sourceCombatantId: input.sourceCombatantId,
  }
  const effectState = normalizeCombatEffectState(input.state.effectState)
  const temporarySkills = [...effectState.temporarySkills, grant].sort(
    (left, right) =>
      left.combatantId.localeCompare(right.combatantId) ||
      left.skillId.localeCompare(right.skillId) ||
      left.contentVersion - right.contentVersion,
  )
  const state: StatDrivenCombatEncounterState = {
    ...input.state,
    tactical: {
      ...input.state.tactical,
      battle: {
        ...battle,
        rng: draw.state,
      },
    },
    effectState: {
      ...effectState,
      temporarySkills,
    },
  }
  const event: CombatSkillCopiedEvent = {
    event: 'temporary_skill_copied',
    combatantId: input.actorCombatantId,
    sourceCombatantId: input.sourceCombatantId,
    skillId: definition.id,
    contentVersion: definition.contentVersion,
  }
  return { state, event, definition }
}
