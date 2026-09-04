import type { BattleCombatant, BattleTemporaryResource } from './battle-state'

export const SKILL_COOLDOWN_RESOURCE_PREFIX = 'p3.skill-cooldown.' as const

export interface SkillCooldownDefinition {
  readonly key: string
  readonly ownerTurns: number
}

export interface SkillCooldownState {
  readonly active: boolean
  readonly cooldownKey: string
  readonly ownerTurns: number
  readonly ticksRemaining: number
}

export type SkillCooldownEvent =
  | {
      event: 'skill_cooldown_started'
      combatantId: string
      cooldownKey: string
      actionId: string
      definitionVersion: number
      ownerTurns: number
      ticksRemaining: number
    }
  | {
      event: 'skill_cooldown_advanced'
      combatantId: string
      cooldownKey: string
      ticksRemaining: number
    }
  | {
      event: 'skill_cooldown_ready'
      combatantId: string
      cooldownKey: string
    }

export interface SkillCooldownTransition {
  readonly combatant: BattleCombatant
  readonly events: readonly SkillCooldownEvent[]
}

export function validateSkillCooldownDefinition(
  definition: SkillCooldownDefinition,
): readonly string[] {
  const issues: string[] = []
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(definition.key)) issues.push('key')
  if (
    !Number.isSafeInteger(definition.ownerTurns) ||
    definition.ownerTurns < 1 ||
    definition.ownerTurns > 99
  ) {
    issues.push('ownerTurns')
  }
  return issues
}

export function skillCooldownResourceKey(definition: SkillCooldownDefinition): string {
  assertSkillCooldownDefinition(definition)
  return `${SKILL_COOLDOWN_RESOURCE_PREFIX}${definition.key}`
}

export function readSkillCooldown(
  combatant: BattleCombatant,
  definition: SkillCooldownDefinition,
): SkillCooldownState {
  const resource = combatant.temporaryResources.find(
    (candidate) => candidate.key === skillCooldownResourceKey(definition),
  )
  return {
    active: Boolean(resource && resource.current > 0),
    cooldownKey: definition.key,
    ownerTurns: definition.ownerTurns,
    ticksRemaining: resource?.current ?? 0,
  }
}

export function applySkillCooldown(
  combatant: BattleCombatant,
  definition: SkillCooldownDefinition,
  provenance: { readonly actionId: string; readonly definitionVersion: number },
): SkillCooldownTransition {
  assertSkillCooldownDefinition(definition)
  if (!provenance.actionId.trim()) throw new TypeError('Cooldown actionId must be non-empty.')
  if (!Number.isSafeInteger(provenance.definitionVersion) || provenance.definitionVersion < 1) {
    throw new RangeError('Cooldown definitionVersion must be a positive safe integer.')
  }

  const ticks = definition.ownerTurns + 1
  const resource: BattleTemporaryResource = {
    key: skillCooldownResourceKey(definition),
    current: ticks,
    maximum: ticks,
  }
  return {
    combatant: withTemporaryResource(combatant, resource),
    events: [
      {
        event: 'skill_cooldown_started',
        combatantId: combatant.id,
        cooldownKey: definition.key,
        actionId: provenance.actionId,
        definitionVersion: provenance.definitionVersion,
        ownerTurns: definition.ownerTurns,
        ticksRemaining: ticks,
      },
    ],
  }
}

export function advanceSkillCooldownsAtOwnerTurnStart(
  combatant: BattleCombatant,
): SkillCooldownTransition {
  const events: SkillCooldownEvent[] = []
  const temporaryResources = combatant.temporaryResources
    .map((resource) => {
      if (!resource.key.startsWith(SKILL_COOLDOWN_RESOURCE_PREFIX) || resource.current <= 0) {
        return { ...resource }
      }
      const next = resource.current - 1
      const cooldownKey = resource.key.slice(SKILL_COOLDOWN_RESOURCE_PREFIX.length)
      events.push(
        next === 0
          ? { event: 'skill_cooldown_ready', combatantId: combatant.id, cooldownKey }
          : {
              event: 'skill_cooldown_advanced',
              combatantId: combatant.id,
              cooldownKey,
              ticksRemaining: next,
            },
      )
      return { ...resource, current: next }
    })
    .sort((left, right) => left.key.localeCompare(right.key))

  return {
    combatant: { ...combatant, temporaryResources },
    events,
  }
}

function assertSkillCooldownDefinition(definition: SkillCooldownDefinition): void {
  const issues = validateSkillCooldownDefinition(definition)
  if (issues.length > 0) {
    throw new TypeError(`Invalid Skill cooldown definition: ${issues.join(', ')}.`)
  }
}

function withTemporaryResource(
  combatant: BattleCombatant,
  replacement: BattleTemporaryResource,
): BattleCombatant {
  return {
    ...combatant,
    temporaryResources: [
      ...combatant.temporaryResources
        .filter((resource) => resource.key !== replacement.key)
        .map((resource) => ({ ...resource })),
      replacement,
    ].sort((left, right) => left.key.localeCompare(right.key)),
  }
}
