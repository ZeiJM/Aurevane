from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    if text.count(old) != 1:
        raise RuntimeError(f"Expected one match in {path}, found {text.count(old)} for: {old[:120]!r}")
    target.write_text(text.replace(old, new), encoding="utf-8")


def replace_between(path: str, start: str, end: str, replacement: str) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    start_index = text.index(start)
    end_index = text.index(end, start_index)
    target.write_text(text[:start_index] + replacement + text[end_index:], encoding="utf-8")


write(
    "packages/game-core/src/combat/skill-cooldowns.ts",
    r'''import type { BattleCombatant, BattleTemporaryResource } from './battle-state'

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

export function validateSkillCooldownDefinition(definition: SkillCooldownDefinition): readonly string[] {
  const issues: string[] = []
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(definition.key)) issues.push('key')
  if (!Number.isSafeInteger(definition.ownerTurns) || definition.ownerTurns < 1 || definition.ownerTurns > 99) {
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
''',
)

write(
    "packages/game-core/src/combat/mature-skills.ts",
    r'''import type {
  CombatActionDefinition,
  CombatEffectDefinition,
  CombatTargetSpec,
  CombatUseRequirement,
} from './actions'
import type { SkillCooldownDefinition } from './skill-cooldowns'

export const MATURE_SKILL_SCHEMA_VERSION = 1 as const
export type MatureSkillCombatContext = 'pve' | 'pvp'

export type MatureSkillUnlockRequirement =
  | { readonly kind: 'discipline-mastery'; readonly minimumStage: number }
  | { readonly kind: 'system-grant'; readonly grantId: string }

export interface MatureSkillAiMetadata {
  readonly enabled: boolean
  readonly baseUtility: number
  readonly purposeTags: readonly string[]
}

export interface MatureSkillContextOverride {
  readonly apCost?: number
  readonly cooldownOwnerTurns?: number
}

export interface MatureSkillMediaHooks {
  readonly iconKey: string | null
  readonly audioCueKey: string | null
  readonly vfxKey: string | null
}

export interface MatureSkillAuthoringMetadata {
  readonly schemaVersion: typeof MATURE_SKILL_SCHEMA_VERSION
  readonly status: 'representative' | 'production'
  readonly validationTags: readonly string[]
}

export interface MatureSkillDefinition {
  readonly id: string
  readonly contentVersion: number
  readonly enabled: boolean
  readonly nameRef: string
  readonly descriptionRef: string
  readonly sourceDisciplineId: string
  readonly unlockRequirement: MatureSkillUnlockRequirement
  readonly apCost: number
  readonly target: CombatTargetSpec
  readonly requirements: readonly CombatUseRequirement[]
  readonly effects: readonly CombatEffectDefinition[]
  readonly tags: readonly string[]
  readonly cooldown: SkillCooldownDefinition
  readonly ai: MatureSkillAiMetadata
  readonly overrides: Readonly<Partial<Record<MatureSkillCombatContext, MatureSkillContextOverride>>>
  readonly media: MatureSkillMediaHooks
  readonly authoring: MatureSkillAuthoringMetadata
}

export interface ResolvedMatureSkillDefinition extends MatureSkillDefinition {
  readonly combatContext: MatureSkillCombatContext
}

export const P33_REPRESENTATIVE_DISCIPLINE_SKILLS = [
  {
    id: 'vanguard.forceful-strike',
    contentVersion: 1,
    enabled: false,
    nameRef: 'skill.vanguard.forceful-strike.name',
    descriptionRef: 'skill.vanguard.forceful-strike.description',
    sourceDisciplineId: 'vanguard',
    unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
    apCost: 40,
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 1,
      requiresLineOfSight: false,
      maximumElevationDifference: 1,
      friendlyFire: 'enemies-only',
    },
    requirements: [],
    effects: [{ type: 'damage', recipient: 'primary-unit', amount: 10 }],
    tags: ['discipline', 'vanguard', 'attack', 'melee'],
    cooldown: { key: 'vanguard.forceful-strike', ownerTurns: 2 },
    ai: { enabled: true, baseUtility: 70, purposeTags: ['damage', 'pressure'] },
    overrides: {},
    media: {
      iconKey: 'skill.vanguard.forceful-strike.icon',
      audioCueKey: 'skill.vanguard.forceful-strike.audio',
      vfxKey: 'skill.vanguard.forceful-strike.vfx',
    },
    authoring: {
      schemaVersion: MATURE_SKILL_SCHEMA_VERSION,
      status: 'representative',
      validationTags: ['p3.3', 'representative', 'disabled-stale-version'],
    },
  },
  {
    id: 'vanguard.forceful-strike',
    contentVersion: 2,
    enabled: true,
    nameRef: 'skill.vanguard.forceful-strike.name',
    descriptionRef: 'skill.vanguard.forceful-strike.description',
    sourceDisciplineId: 'vanguard',
    unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
    apCost: 40,
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 1,
      requiresLineOfSight: false,
      maximumElevationDifference: 1,
      friendlyFire: 'enemies-only',
    },
    requirements: [],
    effects: [{ type: 'damage', recipient: 'primary-unit', amount: 12 }],
    tags: ['discipline', 'vanguard', 'attack', 'melee'],
    cooldown: { key: 'vanguard.forceful-strike', ownerTurns: 2 },
    ai: { enabled: true, baseUtility: 76, purposeTags: ['damage', 'pressure'] },
    overrides: { pvp: { apCost: 45 } },
    media: {
      iconKey: 'skill.vanguard.forceful-strike.icon',
      audioCueKey: 'skill.vanguard.forceful-strike.audio',
      vfxKey: 'skill.vanguard.forceful-strike.vfx',
    },
    authoring: {
      schemaVersion: MATURE_SKILL_SCHEMA_VERSION,
      status: 'representative',
      validationTags: ['p3.3', 'representative'],
    },
  },
  {
    id: 'lifebinder.mending-light',
    contentVersion: 1,
    enabled: true,
    nameRef: 'skill.lifebinder.mending-light.name',
    descriptionRef: 'skill.lifebinder.mending-light.description',
    sourceDisciplineId: 'lifebinder',
    unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
    apCost: 45,
    target: {
      kind: 'self',
      teamPolicy: 'self',
      shape: { kind: 'single' },
      minimumRange: 0,
      maximumRange: 0,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire: 'allies-only',
    },
    requirements: [{ kind: 'actor-hp-at-most', basisPoints: 9_999 }],
    effects: [{ type: 'healing', recipient: 'actor', amount: 16 }],
    tags: ['discipline', 'lifebinder', 'heal', 'support'],
    cooldown: { key: 'lifebinder.mending-light', ownerTurns: 2 },
    ai: { enabled: true, baseUtility: 58, purposeTags: ['heal', 'survival'] },
    overrides: { pvp: { cooldownOwnerTurns: 3 } },
    media: {
      iconKey: 'skill.lifebinder.mending-light.icon',
      audioCueKey: 'skill.lifebinder.mending-light.audio',
      vfxKey: 'skill.lifebinder.mending-light.vfx',
    },
    authoring: {
      schemaVersion: MATURE_SKILL_SCHEMA_VERSION,
      status: 'representative',
      validationTags: ['p3.3', 'representative'],
    },
  },
] as const satisfies readonly MatureSkillDefinition[]

export function validateMatureSkillDefinition(definition: MatureSkillDefinition): readonly string[] {
  const issues: string[] = []
  const idPattern = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/
  if (!idPattern.test(definition.id)) issues.push('id')
  if (!Number.isSafeInteger(definition.contentVersion) || definition.contentVersion < 1) {
    issues.push('contentVersion')
  }
  if (!definition.nameRef.trim()) issues.push('nameRef')
  if (!definition.descriptionRef.trim()) issues.push('descriptionRef')
  if (!idPattern.test(definition.sourceDisciplineId)) issues.push('sourceDisciplineId')
  if (!Number.isSafeInteger(definition.apCost) || definition.apCost < 1 || definition.apCost > 100) {
    issues.push('apCost')
  }
  if (definition.tags.length === 0 || definition.tags.some((tag) => !tag.trim())) issues.push('tags')
  if (
    definition.unlockRequirement.kind === 'discipline-mastery' &&
    (!Number.isSafeInteger(definition.unlockRequirement.minimumStage) ||
      definition.unlockRequirement.minimumStage < 1)
  ) {
    issues.push('unlockRequirement.minimumStage')
  }
  if (
    definition.unlockRequirement.kind === 'system-grant' &&
    !definition.unlockRequirement.grantId.trim()
  ) {
    issues.push('unlockRequirement.grantId')
  }
  if (!Number.isFinite(definition.ai.baseUtility)) issues.push('ai.baseUtility')
  if (definition.authoring.schemaVersion !== MATURE_SKILL_SCHEMA_VERSION) {
    issues.push('authoring.schemaVersion')
  }
  if (
    !idPattern.test(definition.cooldown.key) ||
    !Number.isSafeInteger(definition.cooldown.ownerTurns) ||
    definition.cooldown.ownerTurns < 1
  ) {
    issues.push('cooldown')
  }
  for (const [context, override] of Object.entries(definition.overrides)) {
    if (override?.apCost !== undefined && (!Number.isSafeInteger(override.apCost) || override.apCost < 1 || override.apCost > 100)) {
      issues.push(`overrides.${context}.apCost`)
    }
    if (
      override?.cooldownOwnerTurns !== undefined &&
      (!Number.isSafeInteger(override.cooldownOwnerTurns) || override.cooldownOwnerTurns < 1)
    ) {
      issues.push(`overrides.${context}.cooldownOwnerTurns`)
    }
  }
  return issues
}

export function resolveMatureSkillVersion(
  skillId: string,
  contentVersion?: number,
): MatureSkillDefinition | null {
  const candidates = P33_REPRESENTATIVE_DISCIPLINE_SKILLS.filter(
    (definition) => definition.id === skillId && definition.enabled,
  )
  if (contentVersion !== undefined) {
    return candidates.find((definition) => definition.contentVersion === contentVersion) ?? null
  }
  return [...candidates].sort((left, right) => right.contentVersion - left.contentVersion)[0] ?? null
}

export function resolveMatureSkillForContext(
  definition: MatureSkillDefinition,
  combatContext: MatureSkillCombatContext,
): ResolvedMatureSkillDefinition {
  assertUsableDefinition(definition)
  const override = definition.overrides[combatContext]
  return {
    ...definition,
    apCost: override?.apCost ?? definition.apCost,
    cooldown: {
      ...definition.cooldown,
      ownerTurns: override?.cooldownOwnerTurns ?? definition.cooldown.ownerTurns,
    },
    combatContext,
  }
}

export function toCombatActionDefinition(
  definition: MatureSkillDefinition,
  combatContext: MatureSkillCombatContext,
): CombatActionDefinition {
  const resolved = resolveMatureSkillForContext(definition, combatContext)
  return {
    id: resolved.id,
    version: resolved.contentVersion,
    sourceType: 'discipline-skill',
    tags: resolved.tags,
    target: resolved.target,
    cost: { spendsAction: true, mp: 0 },
    requirements: resolved.requirements,
    effects: resolved.effects,
  }
}

function assertUsableDefinition(definition: MatureSkillDefinition): void {
  const issues = validateMatureSkillDefinition(definition)
  if (issues.length > 0) throw new TypeError(`Invalid mature Skill definition: ${issues.join(', ')}.`)
  if (!definition.enabled) throw new RangeError('That mature Skill version is disabled.')
}
''',
)

write(
    "packages/game-core/src/combat/mature-skills.test.ts",
    r'''import { describe, expect, it } from 'vitest'

import { createCombatEncounterState, evaluateCombatAction, executeCombatAction } from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import {
  P33_REPRESENTATIVE_DISCIPLINE_SKILLS,
  resolveMatureSkillForContext,
  resolveMatureSkillVersion,
  toCombatActionDefinition,
  validateMatureSkillDefinition,
} from './mature-skills'
import {
  advanceSkillCooldownsAtOwnerTurnStart,
  applySkillCooldown,
  readSkillCooldown,
} from './skill-cooldowns'

function encounter() {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:p3.3-mature-skill',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 12345,
      combatants: [
        {
          id: 'player',
          teamId: 'players',
          initiative: 20,
          baseMovementBudget: 4,
          hp: 30,
          maxHp: 50,
          mp: 20,
          maxMp: 20,
        },
        {
          id: 'recruit',
          teamId: 'opponents',
          initiative: 10,
          baseMovementBudget: 4,
          hp: 50,
          maxHp: 50,
          mp: 20,
          maxMp: 20,
        },
      ],
    }),
  ).state
  return createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width: 2,
      height: 1,
      terrains: [{ id: 'open-ground', traversalCost: 1 }],
      tiles: [
        { position: { x: 0, y: 0 }, elevation: 0, terrainId: 'open-ground' },
        { position: { x: 1, y: 0 }, elevation: 0, terrainId: 'open-ground' },
      ],
      movementProfiles: [
        { id: 'player-ground', maxElevationStep: 1, terrainCostOverrides: [] },
        { id: 'recruit-ground', maxElevationStep: 1, terrainCostOverrides: [] },
      ],
      placements: [
        {
          combatantId: 'player',
          position: { x: 0, y: 0 },
          facing: 'east',
          movementProfileId: 'player-ground',
        },
        {
          combatantId: 'recruit',
          position: { x: 1, y: 0 },
          facing: 'west',
          movementProfileId: 'recruit-ground',
        },
      ],
    }),
  )
}

describe('P3.3 mature Skill schema', () => {
  it('keeps representative Discipline Skills fully data-defined and valid', () => {
    for (const definition of P33_REPRESENTATIVE_DISCIPLINE_SKILLS) {
      expect(validateMatureSkillDefinition(definition)).toEqual([])
      expect(definition.cooldown.ownerTurns).toBeGreaterThan(0)
      expect(definition.sourceDisciplineId).toMatch(/^[a-z0-9.-]+$/)
    }
  })

  it('fails closed for stale or disabled versions and resolves the latest enabled version', () => {
    expect(resolveMatureSkillVersion('vanguard.forceful-strike', 1)).toBeNull()
    expect(resolveMatureSkillVersion('vanguard.forceful-strike', 999)).toBeNull()
    expect(resolveMatureSkillVersion('vanguard.forceful-strike')?.contentVersion).toBe(2)
  })

  it('uses existing combat target, requirement, and effect authority instead of a parallel engine', () => {
    const definition = resolveMatureSkillVersion('lifebinder.mending-light', 1)
    if (!definition) throw new Error('Expected representative Lifebinder Skill.')
    const action = toCombatActionDefinition(definition, 'pve')
    const state = encounter()
    const evaluation = evaluateCombatAction(state, action, { kind: 'self' }, { statuses: [] })

    expect(evaluation.legal).toBe(true)
    expect(action.sourceType).toBe('discipline-skill')
    const resolved = executeCombatAction(state, action, { kind: 'self' }, { statuses: [] })
    expect(resolved.state.tactical.battle.combatants.find((row) => row.id === 'player')?.hp).toBe(46)
  })

  it('applies deterministic PvE/PvP override hooks without mutating the source definition', () => {
    const definition = resolveMatureSkillVersion('vanguard.forceful-strike', 2)
    if (!definition) throw new Error('Expected representative Vanguard Skill.')
    const pve = resolveMatureSkillForContext(definition, 'pve')
    const pvp = resolveMatureSkillForContext(definition, 'pvp')

    expect(pve.apCost).toBe(40)
    expect(pvp.apCost).toBe(45)
    expect(definition.apCost).toBe(40)
  })
})

describe('P3.3 generic owner-turn cooldown clock', () => {
  it('persists through serialization and becomes ready only after the configured locked owner turns', () => {
    const definition = resolveMatureSkillVersion('lifebinder.mending-light', 1)
    if (!definition) throw new Error('Expected representative Lifebinder Skill.')
    const player = encounter().tactical.battle.combatants.find((row) => row.id === 'player')
    if (!player) throw new Error('Expected player combatant.')

    const started = applySkillCooldown(player, definition.cooldown, {
      actionId: definition.id,
      definitionVersion: definition.contentVersion,
    })
    const reconnected = JSON.parse(JSON.stringify(started.combatant)) as typeof started.combatant
    expect(readSkillCooldown(reconnected, definition.cooldown)).toMatchObject({
      active: true,
      ownerTurns: 2,
      ticksRemaining: 3,
    })

    const firstLockedTurn = advanceSkillCooldownsAtOwnerTurnStart(reconnected)
    const secondLockedTurn = advanceSkillCooldownsAtOwnerTurnStart(firstLockedTurn.combatant)
    expect(readSkillCooldown(secondLockedTurn.combatant, definition.cooldown).active).toBe(true)

    const readyTurn = advanceSkillCooldownsAtOwnerTurnStart(secondLockedTurn.combatant)
    expect(readSkillCooldown(readyTurn.combatant, definition.cooldown).active).toBe(false)
    expect(readyTurn.events).toContainEqual(
      expect.objectContaining({ event: 'skill_cooldown_ready', cooldownKey: definition.cooldown.key }),
    )
  })
})
''',
)

replace_once(
    "packages/game-core/src/combat/actions.ts",
    "export type CombatActionSourceType = 'basic-attack' | 'basic-action' | 'scenario' | 'test'",
    "export type CombatActionSourceType =\n  | 'basic-attack'\n  | 'basic-action'\n  | 'discipline-skill'\n  | 'scenario'\n  | 'test'",
)
replace_once(
    "packages/game-core/src/combat/actions.ts",
    "  | 'insufficient-mp'\n  | 'invalid-target-kind'",
    "  | 'insufficient-mp'\n  | 'cooldown-active'\n  | 'invalid-target-kind'",
)
replace_once(
    "packages/game-core/package.json",
    '    "./combat/actions": "./src/combat/actions.ts",\n',
    '    "./combat/actions": "./src/combat/actions.ts",\n    "./combat/mature-skills": "./src/combat/mature-skills.ts",\n    "./combat/skill-cooldowns": "./src/combat/skill-cooldowns.ts",\n',
)

replace_once(
    "packages/game-core/src/combat/pv1f-action-economy.ts",
    "import type { BattleCombatant, BattleFacing, BattleTemporaryResource } from './battle-state'\n",
    "import type { BattleCombatant, BattleFacing, BattleTemporaryResource } from './battle-state'\nimport {\n  advanceSkillCooldownsAtOwnerTurnStart,\n  applySkillCooldown,\n  readSkillCooldown,\n  type SkillCooldownDefinition,\n} from './skill-cooldowns'\n",
)
replace_once(
    "packages/game-core/src/combat/pv1f-action-economy.ts",
    "export const PV1F_STATUS_MAXIMUM_STACKS = 3 as const\n",
    "export const PV1F_STATUS_MAXIMUM_STACKS = 3 as const\nexport const PV1F_RECOVERY_COOLDOWN_OWNER_TURNS = 2 as const\n\nexport const PV1F_RECOVERY_COOLDOWN: SkillCooldownDefinition = {\n  key: 'basic.recovery',\n  ownerTurns: PV1F_RECOVERY_COOLDOWN_OWNER_TURNS,\n}\n",
)

replace_between(
    "packages/game-core/src/combat/pv1f-action-economy.ts",
    "export function preparePv1fTurnEconomy(",
    "export function pv1fActionCost(",
    r'''function preparePv1fTurnEconomyTransition(
  state: StatDrivenCombatEncounterState,
): Pv1fTransition {
  const battle = state.tactical.battle
  const turn = battle.currentTurn
  if (battle.lifecycle !== 'active' || !turn) return { state, events: [] }

  const actor = getCombatant(state, turn.combatantId)
  const marker = actor.temporaryResources.find(
    (resource) => resource.key === PV1F_ACTION_ECONOMY_TURN_KEY,
  )
  const economy = actor.temporaryResources.find(
    (resource) => resource.key === PV1F_ACTION_ECONOMY_RESOURCE_KEY,
  )
  if (marker?.current === battle.turnNumber && economy) return { state, events: [] }

  const cooldownTransition = advanceSkillCooldownsAtOwnerTurnStart(actor)
  const resources = replaceResources(cooldownTransition.combatant.temporaryResources, [
    {
      key: PV1F_ACTION_ECONOMY_RESOURCE_KEY,
      current: PV1F_ACTION_ECONOMY_MAXIMUM,
      maximum: PV1F_ACTION_ECONOMY_MAXIMUM,
    },
    {
      key: PV1F_ACTION_ECONOMY_TURN_KEY,
      current: battle.turnNumber,
      maximum: Number.MAX_SAFE_INTEGER,
    },
  ])

  return {
    state: withCombatantAndTurn(
      state,
      { ...cooldownTransition.combatant, temporaryResources: resources },
      {
        ...turn,
        actionState: 'ready',
      },
    ),
    events: cooldownTransition.events,
  }
}

export function preparePv1fTurnEconomy(
  state: StatDrivenCombatEncounterState,
): StatDrivenCombatEncounterState {
  return preparePv1fTurnEconomyTransition(state).state
}

export function pv1fCooldownForAction(actionId: string): SkillCooldownDefinition | null {
  if (actionId === PV1F_RECOVER_ACTION_ID || actionId === PV1F_MP_RECOVER_ACTION_ID) {
    return PV1F_RECOVERY_COOLDOWN
  }
  return null
}

export function readPv1fActionCooldown(
  state: StatDrivenCombatEncounterState,
  combatantId: string,
  actionId: string,
) {
  const definition = pv1fCooldownForAction(actionId)
  if (!definition) return null
  return readSkillCooldown(getCombatant(state, combatantId), definition)
}

''',
)

replace_between(
    "packages/game-core/src/combat/pv1f-action-economy.ts",
    "export function evaluatePv1fAction(",
    "export function executePv1fAction(",
    r'''export function evaluatePv1fAction(
  state: StatDrivenCombatEncounterState,
  actionId: string,
  target: CombatTargetSelection,
): {
  prepared: StatDrivenCombatEncounterState
  action: CombatActionDefinition
  cost: number
  evaluation: CombatActionEvaluation
} {
  const prepared = preparePv1fTurnEconomy(state)
  const actorId = prepared.tactical.battle.currentTurn?.combatantId
  if (!actorId) throw new Error('PV-1F action evaluation requires an active turn.')
  const action = resolvePv1fActionDefinition(prepared, actorId, actionId)
  const cost = pv1fActionCost(action.id)
  const baseEvaluation = evaluateCombatAction(prepared, action, target, PV1F_COMBAT_CONTENT)
  const cooldownDefinition = pv1fCooldownForAction(action.id)
  const cooldown = cooldownDefinition
    ? readSkillCooldown(getCombatant(prepared, actorId), cooldownDefinition)
    : null
  const evaluation =
    cooldown?.active === true
      ? {
          ...baseEvaluation,
          legal: false,
          issues: [
            ...baseEvaluation.issues,
            {
              code: 'cooldown-active' as const,
              message: `That action is cooling down (${cooldown.ticksRemaining} owner-turn tick${cooldown.ticksRemaining === 1 ? '' : 's'} remain).`,
            },
          ],
        }
      : baseEvaluation
  return { prepared, action, cost, evaluation }
}

''',
)

replace_between(
    "packages/game-core/src/combat/pv1f-action-economy.ts",
    "export function executePv1fAction(",
    "export function evaluatePv1fMovement(",
    r'''export function executePv1fAction(
  state: StatDrivenCombatEncounterState,
  actionId: string,
  target: CombatTargetSelection,
): Pv1fTransition {
  const { prepared, action, cost, evaluation } = evaluatePv1fAction(state, actionId, target)
  if (!evaluation.legal) {
    throw new Error(evaluation.issues[0]?.message ?? 'That action is not legal.')
  }
  if (!canAffordPv1fEconomy(prepared, cost)) {
    throw new Error('Not enough Action Economy remains for that action.')
  }

  const actorId = prepared.tactical.battle.currentTurn?.combatantId
  if (!actorId) throw new Error('PV-1F action execution requires an active turn.')
  const transition =
    action.sourceType === 'basic-attack'
      ? executeStatDrivenAttack(prepared, action, target, PV1F_COMBAT_CONTENT)
      : (() => {
          const resolved = executeCombatAction(prepared, action, target, PV1F_COMBAT_CONTENT)
          return {
            state: reattachStatDrivenCombatBridge(resolved.state, prepared.statBridge),
            events: resolved.events,
          }
        })()
  let next = spendPv1fActionEconomyForActor(transition.state, actorId, cost)
  const cooldownDefinition = pv1fCooldownForAction(action.id)
  const cooldownEvents: readonly unknown[] = cooldownDefinition
    ? (() => {
        const started = applySkillCooldown(getCombatant(next, actorId), cooldownDefinition, {
          actionId: action.id,
          definitionVersion: action.version,
        })
        next = withCombatant(next, started.combatant)
        return started.events
      })()
    : []
  const remaining = readPv1fActionEconomy(next, actorId)?.current ?? 0
  return {
    state: next,
    events: [
      ...transition.events,
      ...cooldownEvents,
      { event: 'action_economy_spent', combatantId: actorId, amount: cost, remaining },
    ],
  }
}

''',
)

replace_between(
    "packages/game-core/src/combat/pv1f-action-economy.ts",
    "export function finishPv1fTurn(",
    "export function resolvePv1fActionDefinition(",
    r'''export function finishPv1fTurn(
  state: StatDrivenCombatEncounterState,
  facing: BattleFacing,
): Pv1fTransition {
  const prepared = preparePv1fTurnEconomy(state)
  const selected = selectCurrentFinalFacing(prepared.tactical, facing)
  const encounter = reattachStatDrivenCombatBridge(
    createCombatEncounterState(selected.state, prepared.statusState),
    prepared.statBridge,
  )
  const ended = endCombatTurn(encounter, PV1F_COMBAT_CONTENT)
  const bridged = reattachStatDrivenCombatBridge(ended.state, prepared.statBridge)
  const nextTurn = preparePv1fTurnEconomyTransition(bridged)
  return {
    state: nextTurn.state,
    events: [...selected.events, ...ended.events, ...nextTurn.events],
  }
}

''',
)

replace_once(
    "packages/game-core/src/combat/pv1f-action-economy.test.ts",
    "  createPv1fTemporaryResources,\n  executePv1fAction,\n",
    "  createPv1fTemporaryResources,\n  evaluatePv1fAction,\n  executePv1fAction,\n  finishPv1fTurn,\n  readPv1fActionCooldown,\n",
)
replace_once(
    "packages/game-core/src/combat/pv1f-action-economy.test.ts",
    "  PV1F_MP_RECOVER_COST,\n",
    "  PV1F_MP_RECOVER_COST,\n  PV1F_RECOVER_ACTION_ID,\n  PV1F_RECOVERY_COOLDOWN_OWNER_TURNS,\n",
)
with (ROOT / "packages/game-core/src/combat/pv1f-action-economy.test.ts").open("a", encoding="utf-8") as handle:
    handle.write(
        r'''

describe('P3.3 recovery cooldown authority', () => {
  function backToPlayer(state: StatDrivenCombatEncounterState): StatDrivenCombatEncounterState {
    const recruitTurn = finishPv1fTurn(state, 'east').state
    return finishPv1fTurn(recruitTurn, 'west').state
  }

  it('shares the canonical two-own-turn Recovery cooldown across HP and MP recovery', () => {
    const encounter = lethalEncounter('player')
    const player = encounter.tactical.battle.combatants.find(
      (combatant) => combatant.id === 'player',
    )
    if (!player) throw new Error('Expected player combatant.')
    player.hp = 25
    player.mp = 5

    const used = executePv1fAction(encounter, PV1F_RECOVER_ACTION_ID, { kind: 'self' })
    expect(PV1F_RECOVERY_COOLDOWN_OWNER_TURNS).toBe(2)
    expect(readPv1fActionCooldown(used.state, 'player', PV1F_MP_RECOVER_ACTION_ID)).toMatchObject({
      active: true,
      ownerTurns: 2,
      ticksRemaining: 3,
    })
    expect(evaluatePv1fAction(used.state, PV1F_MP_RECOVER_ACTION_ID, { kind: 'self' }).evaluation).toMatchObject({
      legal: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: 'cooldown-active' })]),
    })
  })

  it('survives reconnect serialization and unlocks only after two complete future owner turns', () => {
    const encounter = lethalEncounter('player')
    const player = encounter.tactical.battle.combatants.find(
      (combatant) => combatant.id === 'player',
    )
    if (!player) throw new Error('Expected player combatant.')
    player.hp = 25

    const used = executePv1fAction(encounter, PV1F_RECOVER_ACTION_ID, { kind: 'self' })
    const reconnected = JSON.parse(JSON.stringify(used.state)) as StatDrivenCombatEncounterState

    const firstFutureTurn = backToPlayer(reconnected)
    expect(evaluatePv1fAction(firstFutureTurn, PV1F_RECOVER_ACTION_ID, { kind: 'self' }).evaluation.legal).toBe(false)

    const secondFutureTurn = backToPlayer(firstFutureTurn)
    expect(evaluatePv1fAction(secondFutureTurn, PV1F_RECOVER_ACTION_ID, { kind: 'self' }).evaluation.legal).toBe(false)

    const readyTurn = backToPlayer(secondFutureTurn)
    expect(readPv1fActionCooldown(readyTurn, 'player', PV1F_RECOVER_ACTION_ID)?.active).toBe(false)
    expect(evaluatePv1fAction(readyTurn, PV1F_RECOVER_ACTION_ID, { kind: 'self' }).evaluation.legal).toBe(true)
  })
})
'''
    )

replace_once(
    "packages/game-core/src/combat/recruit-ai.test.ts",
    "import { spendPv1fActionEconomy } from './pv1f-action-economy'\n",
    "import {\n  executePv1fAction,\n  PV1F_RECOVER_ACTION_ID,\n  spendPv1fActionEconomy,\n} from './pv1f-action-economy'\n",
)
with (ROOT / "packages/game-core/src/combat/recruit-ai.test.ts").open("a", encoding="utf-8") as handle:
    handle.write(
        r'''

describe('P3.3 Recruit AI cooldown parity', () => {
  it('removes Recovery from AI candidates while the same server cooldown is active', () => {
    const state = encounter({
      width: 2,
      recruitPosition: { x: 1, y: 0 },
      playerPosition: { x: 0, y: 0 },
      recruitHp: 20,
    })
    const recoveryBiased: RecruitAiProfile = {
      ...RECRUIT_WEAK_PROFILE,
      attackUtility: 0,
      movementUtility: 0,
      guardUtility: 0,
      recoverUtility: 1_000,
    }
    const before = chooseRecruitAiDecision({ state, profile: recoveryBiased, tieBreakSeed: 55 })
    expect(before.intent).toMatchObject({ kind: 'action', actionId: PV1F_RECOVER_ACTION_ID })

    const used = executePv1fAction(state, PV1F_RECOVER_ACTION_ID, { kind: 'self' })
    const during = chooseRecruitAiDecision({
      state: used.state,
      profile: recoveryBiased,
      tieBreakSeed: 55,
    })
    expect(during.intent).not.toMatchObject({ kind: 'action', actionId: PV1F_RECOVER_ACTION_ID })
  })
})
'''
    )

write(
    ".github/workflows/skill-engine.yml",
    r'''name: Skill Engine

on:
  pull_request:
    paths:
      - 'packages/game-core/src/combat/**'
      - 'packages/game-core/package.json'
      - 'apps/web/src/server/battle/**'
      - 'TASKS.md'
      - 'AGENTS.md'
      - 'docs/ROADMAP.md'
      - '.github/workflows/skill-engine.yml'

permissions:
  contents: read

jobs:
  skill-engine:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - name: Enable pnpm
        run: |
          corepack enable
          corepack prepare pnpm@11.17.0 --activate
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      - name: Focused formatting
        run: |
          pnpm exec prettier --check \
            packages/game-core/src/combat/actions.ts \
            packages/game-core/src/combat/mature-skills.ts \
            packages/game-core/src/combat/mature-skills.test.ts \
            packages/game-core/src/combat/skill-cooldowns.ts \
            packages/game-core/src/combat/pv1f-action-economy.ts \
            packages/game-core/src/combat/pv1f-action-economy.test.ts \
            packages/game-core/src/combat/recruit-ai.test.ts \
            packages/game-core/package.json
      - name: Focused lint
        run: |
          pnpm exec eslint \
            packages/game-core/src/combat/actions.ts \
            packages/game-core/src/combat/mature-skills.ts \
            packages/game-core/src/combat/mature-skills.test.ts \
            packages/game-core/src/combat/skill-cooldowns.ts \
            packages/game-core/src/combat/pv1f-action-economy.ts \
            packages/game-core/src/combat/pv1f-action-economy.test.ts \
            packages/game-core/src/combat/recruit-ai.test.ts
      - name: Game core typecheck
        run: pnpm --filter @aurevane/game-core typecheck
      - name: P3.3 focused tests
        run: |
          pnpm --filter @aurevane/game-core exec vitest run \
            src/combat/mature-skills.test.ts \
            src/combat/pv1f-action-economy.test.ts \
            src/combat/recruit-ai.test.ts
      - name: Production workspace build
        run: pnpm build
''',
)

# Remove temporary mutation machinery from the durable tree before the workflow commits.
(ROOT / ".github/scripts/apply-p33.py").unlink()
(ROOT / ".github/workflows/p33-apply.yml").unlink()
