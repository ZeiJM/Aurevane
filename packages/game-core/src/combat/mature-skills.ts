import {
  validateCombatAccuracyDefinition,
  type CombatAccuracyAuthoring,
} from './combat-skill-accuracy'
import { validateGameplayActionMetadata } from './gameplay-tags'
import { ADVANCED_DISCIPLINE_SKILLS } from './advanced-discipline-content'
import { FOUNDATION_TRIO_DISCIPLINE_SKILLS } from './foundation-trio-skills'
import { IRONFIST_SKILLS } from './ironfist-content'
import type {
  CombatActionDefinition,
  CombatEffectDefinition,
  CombatTargetSpec,
  CombatUseRequirement,
} from './actions'
import type { SkillCooldownDefinition } from './skill-cooldowns'
import { rebalanceMatureSkillDefinition } from './skill-balance-v5'

export const MATURE_SKILL_SCHEMA_VERSION = 1 as const
export type MatureSkillCombatContext = 'pve' | 'pvp'

export function currentMysticMpCost(apCost: number): number {
  if (!Number.isSafeInteger(apCost) || apCost < 1 || apCost > 100) {
    throw new RangeError('Mystic Skill AP cost must be a safe integer from 1 to 100.')
  }
  return Math.max(2, Math.floor(apCost / 15))
}

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

export interface MatureSkillDefinition extends CombatAccuracyAuthoring {
  readonly id: string
  readonly contentVersion: number
  readonly enabled: boolean
  readonly nameRef: string
  readonly descriptionRef: string
  readonly flavorLine?: string
  readonly sourceDisciplineId: string
  readonly unlockRequirement: MatureSkillUnlockRequirement
  readonly apCost: number
  readonly mpCost?: number
  readonly target: CombatTargetSpec
  readonly requirements: readonly CombatUseRequirement[]
  readonly effects: readonly CombatEffectDefinition[]
  /**
   * Optional player-facing copy for each effect, aligned by effect index.
   * This presentation-only field is never projected into combat resolution.
   */
  readonly effectDescriptions?: readonly (string | null)[]
  readonly tags: readonly string[]
  readonly cooldown: SkillCooldownDefinition | null
  readonly ai: MatureSkillAiMetadata
  readonly overrides: Readonly<
    Partial<Record<MatureSkillCombatContext, MatureSkillContextOverride>>
  >
  readonly media: MatureSkillMediaHooks
  readonly authoring: MatureSkillAuthoringMetadata
}

export interface ResolvedMatureSkillDefinition extends MatureSkillDefinition {
  readonly combatContext: MatureSkillCombatContext
}

const meleeEnemyTarget: CombatTargetSpec = {
  kind: 'unit',
  teamPolicy: 'enemy',
  shape: { kind: 'single' },
  minimumRange: 1,
  maximumRange: 1,
  requiresLineOfSight: false,
  maximumElevationDifference: 1,
  friendlyFire: 'enemies-only',
}

const selfTarget: CombatTargetSpec = {
  kind: 'self',
  teamPolicy: 'self',
  shape: { kind: 'single' },
  minimumRange: 0,
  maximumRange: 0,
  requiresLineOfSight: false,
  maximumElevationDifference: null,
  friendlyFire: 'allies-only',
}

const nearbyAllyTarget: CombatTargetSpec = {
  kind: 'unit',
  teamPolicy: 'ally',
  shape: { kind: 'single' },
  minimumRange: 1,
  maximumRange: 3,
  requiresLineOfSight: true,
  maximumElevationDifference: 2,
  friendlyFire: 'allies-only',
}

const nearbyEnemyTarget: CombatTargetSpec = {
  kind: 'unit',
  teamPolicy: 'enemy',
  shape: { kind: 'single' },
  minimumRange: 1,
  maximumRange: 3,
  requiresLineOfSight: true,
  maximumElevationDifference: 2,
  friendlyFire: 'enemies-only',
}

function representativeMedia(skillId: string): MatureSkillMediaHooks {
  return {
    iconKey: `skill.${skillId}.icon`,
    audioCueKey: `skill.${skillId}.audio`,
    vfxKey: `skill.${skillId}.vfx`,
  }
}

function representativeAuthoring(...validationTags: string[]): MatureSkillAuthoringMetadata {
  return {
    schemaVersion: MATURE_SKILL_SCHEMA_VERSION,
    status: 'representative',
    validationTags: ['representative', ...validationTags],
  }
}

const PRE_PHASE4_REBALANCE_DISCIPLINE_SKILLS = [
  {
    id: 'vanguard.forceful-strike',
    contentVersion: 1,
    enabled: false,
    nameRef: 'skill.vanguard.forceful-strike.name',
    descriptionRef: 'skill.vanguard.forceful-strike.description',
    sourceDisciplineId: 'vanguard',
    unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
    apCost: 40,
    target: meleeEnemyTarget,
    requirements: [],
    effects: [{ type: 'damage', recipient: 'primary-unit', amount: 10 }],
    tags: ['discipline', 'vanguard', 'attack', 'melee', 'cockpit:attack'],
    cooldown: { key: 'vanguard.forceful-strike', ownerTurns: 2 },
    ai: { enabled: true, baseUtility: 70, purposeTags: ['damage', 'pressure'] },
    overrides: {},
    media: representativeMedia('vanguard.forceful-strike'),
    authoring: representativeAuthoring('p3.3', 'disabled-stale-version'),
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
    target: meleeEnemyTarget,
    requirements: [],
    effects: [{ type: 'damage', recipient: 'primary-unit', amount: 12 }],
    tags: ['discipline', 'vanguard', 'attack', 'melee', 'cockpit:attack'],
    cooldown: { key: 'vanguard.forceful-strike', ownerTurns: 2 },
    ai: { enabled: true, baseUtility: 76, purposeTags: ['damage', 'pressure'] },
    overrides: { pvp: { apCost: 45 } },
    media: representativeMedia('vanguard.forceful-strike'),
    authoring: representativeAuthoring('p3.3'),
  },
  {
    id: 'vanguard.cleave',
    contentVersion: 1,
    enabled: true,
    nameRef: 'skill.vanguard.cleave.name',
    descriptionRef: 'skill.vanguard.cleave.description',
    sourceDisciplineId: 'vanguard',
    unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
    apCost: 50,
    target: {
      ...meleeEnemyTarget,
      shape: { kind: 'circle', radius: 1 },
    },
    requirements: [],
    effects: [{ type: 'damage', recipient: 'affected-units', amount: 8 }],
    tags: ['discipline', 'vanguard', 'attack', 'melee', 'area', 'cockpit:attack'],
    cooldown: { key: 'vanguard.cleave', ownerTurns: 3 },
    ai: { enabled: true, baseUtility: 68, purposeTags: ['damage', 'area', 'pressure'] },
    overrides: {},
    media: representativeMedia('vanguard.cleave'),
    authoring: representativeAuthoring('p3.8', 'master-plan-concept'),
  },
  {
    id: 'vanguard.guard-break',
    contentVersion: 1,
    enabled: true,
    nameRef: 'skill.vanguard.guard-break.name',
    descriptionRef: 'skill.vanguard.guard-break.description',
    sourceDisciplineId: 'vanguard',
    unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
    apCost: 55,
    target: meleeEnemyTarget,
    requirements: [],
    effects: [{ type: 'damage', recipient: 'primary-unit', amount: 15 }],
    tags: ['discipline', 'vanguard', 'attack', 'melee', 'pressure', 'cockpit:attack'],
    cooldown: { key: 'vanguard.guard-break', ownerTurns: 4 },
    ai: { enabled: true, baseUtility: 82, purposeTags: ['damage', 'pressure'] },
    overrides: {},
    media: representativeMedia('vanguard.guard-break'),
    authoring: representativeAuthoring(
      'p3.8',
      'master-plan-concept',
      'representative-pressure-behavior',
    ),
  },
  {
    id: 'vanguard.brace',
    contentVersion: 1,
    enabled: true,
    nameRef: 'skill.vanguard.brace.name',
    descriptionRef: 'skill.vanguard.brace.description',
    sourceDisciplineId: 'vanguard',
    unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
    apCost: 30,
    target: selfTarget,
    requirements: [{ kind: 'actor-status-absent', statusId: 'guarded' }],
    effects: [{ type: 'apply-status', recipient: 'actor', statusId: 'guarded', stacks: 1 }],
    tags: ['discipline', 'vanguard', 'defense', 'guard', 'cockpit:defense'],
    cooldown: { key: 'vanguard.brace', ownerTurns: 2 },
    ai: { enabled: true, baseUtility: 64, purposeTags: ['defense', 'survival'] },
    overrides: {},
    media: representativeMedia('vanguard.brace'),
    authoring: representativeAuthoring('p3.8', 'master-plan-concept'),
  },
  {
    id: 'vanguard.rally',
    contentVersion: 1,
    enabled: true,
    nameRef: 'skill.vanguard.rally.name',
    descriptionRef: 'skill.vanguard.rally.description',
    sourceDisciplineId: 'vanguard',
    unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
    apCost: 45,
    target: selfTarget,
    requirements: [],
    effects: [
      { type: 'healing', recipient: 'actor', amount: 8 },
      { type: 'resource-change', recipient: 'actor', resource: 'mp', delta: 4 },
    ],
    tags: ['discipline', 'vanguard', 'support', 'recovery', 'cockpit:recovery'],
    cooldown: { key: 'vanguard.rally', ownerTurns: 4 },
    ai: { enabled: true, baseUtility: 59, purposeTags: ['recovery', 'survival'] },
    overrides: {},
    media: representativeMedia('vanguard.rally'),
    authoring: representativeAuthoring('p3.8', 'master-plan-concept'),
  },
  {
    id: 'vanguard.shield-bash',
    contentVersion: 1,
    enabled: true,
    nameRef: 'skill.vanguard.shield-bash.name',
    descriptionRef: 'skill.vanguard.shield-bash.description',
    sourceDisciplineId: 'vanguard',
    unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
    apCost: 45,
    target: meleeEnemyTarget,
    requirements: [],
    effects: [
      { type: 'damage', recipient: 'primary-unit', amount: 9 },
      { type: 'apply-status', recipient: 'actor', statusId: 'guarded', stacks: 1 },
    ],
    tags: ['discipline', 'vanguard', 'attack', 'defense', 'melee', 'cockpit:attack'],
    cooldown: { key: 'vanguard.shield-bash', ownerTurns: 3 },
    ai: { enabled: true, baseUtility: 72, purposeTags: ['damage', 'defense'] },
    overrides: {},
    media: representativeMedia('vanguard.shield-bash'),
    authoring: representativeAuthoring('p3.8', 'nonfinal-content-name'),
  },
  {
    id: 'vanguard.second-wind',
    contentVersion: 1,
    enabled: true,
    nameRef: 'skill.vanguard.second-wind.name',
    descriptionRef: 'skill.vanguard.second-wind.description',
    sourceDisciplineId: 'vanguard',
    unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
    apCost: 40,
    target: selfTarget,
    requirements: [{ kind: 'actor-hp-at-most', basisPoints: 8_000 }],
    effects: [{ type: 'healing', recipient: 'actor', amount: 12 }],
    tags: ['discipline', 'vanguard', 'heal', 'survival', 'cockpit:recovery'],
    cooldown: { key: 'vanguard.second-wind', ownerTurns: 4 },
    ai: { enabled: true, baseUtility: 65, purposeTags: ['heal', 'survival'] },
    overrides: {},
    media: representativeMedia('vanguard.second-wind'),
    authoring: representativeAuthoring('p3.8', 'nonfinal-content-name'),
  },
  {
    id: 'vanguard.sweeping-strike',
    contentVersion: 1,
    enabled: true,
    nameRef: 'skill.vanguard.sweeping-strike.name',
    descriptionRef: 'skill.vanguard.sweeping-strike.description',
    sourceDisciplineId: 'vanguard',
    unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
    apCost: 45,
    target: {
      ...meleeEnemyTarget,
      shape: { kind: 'circle', radius: 1 },
    },
    requirements: [],
    effects: [{ type: 'damage', recipient: 'affected-units', amount: 7 }],
    tags: ['discipline', 'vanguard', 'attack', 'melee', 'area', 'cockpit:attack'],
    cooldown: { key: 'vanguard.sweeping-strike', ownerTurns: 2 },
    ai: { enabled: true, baseUtility: 62, purposeTags: ['damage', 'area'] },
    overrides: {},
    media: representativeMedia('vanguard.sweeping-strike'),
    authoring: representativeAuthoring('p3.8', 'nonfinal-content-name'),
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
    target: selfTarget,
    requirements: [{ kind: 'actor-hp-at-most', basisPoints: 9_999 }],
    effects: [{ type: 'healing', recipient: 'actor', amount: 16 }],
    tags: ['discipline', 'lifebinder', 'heal', 'support', 'cockpit:recovery'],
    cooldown: { key: 'lifebinder.mending-light', ownerTurns: 2 },
    ai: { enabled: true, baseUtility: 58, purposeTags: ['heal', 'survival'] },
    overrides: { pvp: { cooldownOwnerTurns: 3 } },
    media: representativeMedia('lifebinder.mending-light'),
    authoring: representativeAuthoring('p3.3'),
  },
  {
    id: 'lifebinder.mend',
    contentVersion: 1,
    enabled: true,
    nameRef: 'skill.lifebinder.mend.name',
    descriptionRef: 'skill.lifebinder.mend.description',
    sourceDisciplineId: 'lifebinder',
    unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
    apCost: 35,
    target: nearbyAllyTarget,
    requirements: [],
    effects: [{ type: 'healing', recipient: 'primary-unit', amount: 12 }],
    tags: ['discipline', 'lifebinder', 'heal', 'support', 'cockpit:recovery'],
    cooldown: { key: 'lifebinder.mend', ownerTurns: 2 },
    ai: { enabled: true, baseUtility: 64, purposeTags: ['heal', 'support'] },
    overrides: {},
    media: representativeMedia('lifebinder.mend'),
    authoring: representativeAuthoring('p3.8', 'master-plan-concept'),
  },
  {
    id: 'lifebinder.barrier',
    contentVersion: 1,
    enabled: true,
    nameRef: 'skill.lifebinder.barrier.name',
    descriptionRef: 'skill.lifebinder.barrier.description',
    sourceDisciplineId: 'lifebinder',
    unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
    apCost: 40,
    target: nearbyAllyTarget,
    requirements: [],
    effects: [{ type: 'apply-status', recipient: 'primary-unit', statusId: 'guarded', stacks: 1 }],
    tags: ['discipline', 'lifebinder', 'defense', 'support', 'guard', 'cockpit:defense'],
    cooldown: { key: 'lifebinder.barrier', ownerTurns: 3 },
    ai: { enabled: true, baseUtility: 67, purposeTags: ['defense', 'support'] },
    overrides: {},
    media: representativeMedia('lifebinder.barrier'),
    authoring: representativeAuthoring('p3.8', 'master-plan-concept'),
  },
  {
    id: 'lifebinder.renew',
    contentVersion: 1,
    enabled: true,
    nameRef: 'skill.lifebinder.renew.name',
    descriptionRef: 'skill.lifebinder.renew.description',
    sourceDisciplineId: 'lifebinder',
    unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
    apCost: 50,
    target: nearbyAllyTarget,
    requirements: [],
    effects: [
      { type: 'healing', recipient: 'primary-unit', amount: 10 },
      { type: 'resource-change', recipient: 'primary-unit', resource: 'mp', delta: 4 },
    ],
    tags: ['discipline', 'lifebinder', 'heal', 'support', 'recovery', 'cockpit:recovery'],
    cooldown: { key: 'lifebinder.renew', ownerTurns: 4 },
    ai: { enabled: true, baseUtility: 70, purposeTags: ['heal', 'recovery', 'support'] },
    overrides: {},
    media: representativeMedia('lifebinder.renew'),
    authoring: representativeAuthoring('p3.8', 'master-plan-concept'),
  },
  {
    id: 'lifebinder.sanctuary',
    contentVersion: 1,
    enabled: true,
    nameRef: 'skill.lifebinder.sanctuary.name',
    descriptionRef: 'skill.lifebinder.sanctuary.description',
    sourceDisciplineId: 'lifebinder',
    unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
    apCost: 65,
    target: {
      ...nearbyAllyTarget,
      shape: { kind: 'circle', radius: 1 },
    },
    requirements: [],
    effects: [{ type: 'healing', recipient: 'affected-units', amount: 8 }],
    tags: ['discipline', 'lifebinder', 'heal', 'support', 'area', 'cockpit:recovery'],
    cooldown: { key: 'lifebinder.sanctuary', ownerTurns: 5 },
    ai: { enabled: true, baseUtility: 74, purposeTags: ['heal', 'area', 'support'] },
    overrides: { pvp: { cooldownOwnerTurns: 6 } },
    media: representativeMedia('lifebinder.sanctuary'),
    authoring: representativeAuthoring('p3.8', 'master-plan-concept'),
  },
  {
    id: 'lifebinder.fortifying-light',
    contentVersion: 1,
    enabled: true,
    nameRef: 'skill.lifebinder.fortifying-light.name',
    descriptionRef: 'skill.lifebinder.fortifying-light.description',
    sourceDisciplineId: 'lifebinder',
    unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
    apCost: 55,
    target: nearbyAllyTarget,
    requirements: [],
    effects: [
      { type: 'healing', recipient: 'primary-unit', amount: 6 },
      { type: 'apply-status', recipient: 'primary-unit', statusId: 'guarded', stacks: 1 },
    ],
    tags: ['discipline', 'lifebinder', 'heal', 'defense', 'support', 'cockpit:recovery'],
    cooldown: { key: 'lifebinder.fortifying-light', ownerTurns: 4 },
    ai: { enabled: true, baseUtility: 71, purposeTags: ['heal', 'defense', 'support'] },
    overrides: {},
    media: representativeMedia('lifebinder.fortifying-light'),
    authoring: representativeAuthoring('p3.8', 'nonfinal-content-name'),
  },
  {
    id: 'lifebinder.vital-sever',
    contentVersion: 1,
    enabled: true,
    nameRef: 'skill.lifebinder.vital-sever.name',
    descriptionRef: 'skill.lifebinder.vital-sever.description',
    sourceDisciplineId: 'lifebinder',
    unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
    apCost: 40,
    target: nearbyEnemyTarget,
    requirements: [],
    effects: [{ type: 'damage', recipient: 'primary-unit', amount: 10 }],
    tags: ['discipline', 'lifebinder', 'attack', 'mystic', 'ranged', 'cockpit:attack'],
    cooldown: { key: 'lifebinder.vital-sever', ownerTurns: 2 },
    ai: { enabled: true, baseUtility: 69, purposeTags: ['damage', 'pressure'] },
    overrides: {},
    media: representativeMedia('lifebinder.vital-sever'),
    authoring: representativeAuthoring('p3.8', 'owner-approved-offense'),
  },
  {
    id: 'lifebinder.searing-bloom',
    contentVersion: 1,
    enabled: true,
    nameRef: 'skill.lifebinder.searing-bloom.name',
    descriptionRef: 'skill.lifebinder.searing-bloom.description',
    sourceDisciplineId: 'lifebinder',
    unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
    apCost: 55,
    target: {
      ...nearbyEnemyTarget,
      shape: { kind: 'circle', radius: 1 },
    },
    requirements: [],
    effects: [{ type: 'damage', recipient: 'affected-units', amount: 7 }],
    tags: ['discipline', 'lifebinder', 'attack', 'mystic', 'ranged', 'area', 'cockpit:attack'],
    cooldown: { key: 'lifebinder.searing-bloom', ownerTurns: 3 },
    ai: { enabled: true, baseUtility: 66, purposeTags: ['damage', 'area', 'pressure'] },
    overrides: {},
    media: representativeMedia('lifebinder.searing-bloom'),
    authoring: representativeAuthoring('p3.8', 'owner-approved-offense'),
  },
  ...FOUNDATION_TRIO_DISCIPLINE_SKILLS,
  ...IRONFIST_SKILLS,
  ...ADVANCED_DISCIPLINE_SKILLS,
] as const satisfies readonly MatureSkillDefinition[]

function currentAccuracyMode(
  definition: MatureSkillDefinition,
): NonNullable<MatureSkillDefinition['accuracyMode']> {
  if (definition.target.kind !== 'unit') return 'automatic'
  if (definition.target.teamPolicy !== 'enemy' && definition.target.teamPolicy !== 'any') {
    return 'automatic'
  }

  const hostileRecipient = definition.effects.some((effect) => {
    if (!('recipient' in effect) || effect.recipient === 'actor') return false
    if (effect.type === 'healing') return false
    if (effect.type === 'resource-change') return effect.delta < 0
    if (effect.type === 'barrier-change') return effect.amount < 0
    return effect.type !== 'create-terrain'
  })
  return hostileRecipient ? 'per-target' : 'automatic'
}

function currentRequirement(requirement: CombatUseRequirement): CombatUseRequirement {
  if (!('statusId' in requirement)) return requirement

  const dotTag =
    requirement.statusId === 'burn'
      ? 'Scorched'
      : requirement.statusId === 'bleed'
        ? 'Bleeding'
        : requirement.statusId === 'poison'
          ? 'Poisoned'
          : null

  if (dotTag) {
    if (requirement.kind === 'target-status-present') {
      return { kind: 'target-tag-present', tag: dotTag }
    }
    if (requirement.kind === 'actor-status-present') {
      return { kind: 'actor-tag-present', tag: dotTag }
    }
    if (requirement.kind === 'actor-status-absent') {
      return { kind: 'actor-tag-absent', tag: dotTag }
    }
  }

  if (requirement.statusId === 'delayed') {
    return { ...requirement, statusId: 'slow' }
  }
  if (requirement.statusId === 'hastened') {
    return { ...requirement, statusId: 'haste' }
  }
  if (requirement.statusId === 'marked') {
    return { ...requirement, statusId: 'mark' }
  }
  return requirement
}

function currentEffect(effect: CombatEffectDefinition): CombatEffectDefinition {
  if (effect.type === 'remove-status') {
    return effect.statusIds.includes('marked') && !effect.statusIds.includes('mark')
      ? { ...effect, statusIds: [...effect.statusIds, 'mark'] }
      : effect
  }
  if (effect.type !== 'apply-status') return effect

  if (effect.statusId === 'hastened') {
    return { ...effect, statusId: 'haste' }
  }
  if (effect.statusId === 'delayed') {
    return { ...effect, statusId: 'slow' }
  }
  if (effect.statusId === 'marked') {
    return { ...effect, statusId: 'mark' }
  }
  if (effect.statusId === 'regeneration') {
    return {
      type: 'healing',
      recipient: effect.recipient,
      amount: 4,
      ticks: 2,
    }
  }
  if (effect.statusId === 'poison') {
    return {
      type: 'poison',
      recipient: effect.recipient,
      curseCopyable: true,
    }
  }
  if (effect.statusId === 'bleed') {
    return {
      type: 'bleed',
      recipient: effect.recipient,
      damagePerTick: 3,
      ticks: 3,
      curseCopyable: true,
    }
  }
  if (effect.statusId === 'burn') {
    return {
      type: 'burn',
      recipient: effect.recipient,
      curseCopyable: true,
    }
  }
  return effect
}

function rebalancePurposeTags(
  definition: MatureSkillDefinition,
  additions: readonly string[] = [],
): readonly string[] {
  return [...new Set([...definition.ai.purposeTags, ...additions])]
}

function applyNamedPhase4Rebalance(definition: MatureSkillDefinition): MatureSkillDefinition {
  switch (definition.id) {
    case 'chronist.haste':
      return {
        ...definition,
        effects: [
          { type: 'apply-status', recipient: 'primary-unit', statusId: 'haste', stacks: 1 },
        ],
        ai: {
          ...definition.ai,
          purposeTags: rebalancePurposeTags(definition, ['movement', 'haste']),
        },
      }
    case 'chronist.delay':
      return {
        ...definition,
        apCost: 25,
        effects: [{ type: 'apply-status', recipient: 'primary-unit', statusId: 'slow', stacks: 1 }],
        ai: {
          ...definition.ai,
          purposeTags: rebalancePurposeTags(definition, ['movement', 'slow']),
        },
      }
    case 'chronist.time-lock':
      return {
        ...definition,
        effects: [
          { type: 'apply-status', recipient: 'primary-unit', statusId: 'root', stacks: 1 },
          { type: 'apply-status', recipient: 'primary-unit', statusId: 'slow', stacks: 1 },
        ],
        ai: {
          ...definition.ai,
          purposeTags: rebalancePurposeTags(definition, ['root', 'slow']),
        },
      }
    case 'chronist.temporal-ward':
      return {
        ...definition,
        effects: [
          { type: 'apply-status', recipient: 'actor', statusId: 'guarded', stacks: 1 },
          { type: 'apply-status', recipient: 'actor', statusId: 'haste', stacks: 1 },
        ],
        ai: {
          ...definition.ai,
          purposeTags: rebalancePurposeTags(definition, ['defense', 'haste']),
        },
      }
    case 'chronist.stolen-moment':
      return {
        ...definition,
        requirements: [{ kind: 'target-status-present', statusId: 'slow' }],
        ai: {
          ...definition.ai,
          purposeTags: rebalancePurposeTags(definition, ['slow', 'payoff']),
        },
      }
    case 'tidecaller.undertow':
      return {
        ...definition,
        effects: [
          { type: 'damage', recipient: 'primary-unit', amount: 5 },
          {
            type: 'displace',
            recipient: 'primary-unit',
            direction: 'pull',
            distance: 2,
          },
        ],
        ai: {
          ...definition.ai,
          purposeTags: rebalancePurposeTags(definition, ['pull', 'forced-movement']),
        },
      }
    case 'tidecaller.springwater':
      return {
        ...definition,
        effects: [{ type: 'healing', recipient: 'primary-unit', amount: 3, ticks: 3 }],
        ai: {
          ...definition.ai,
          purposeTags: rebalancePurposeTags(definition, ['heal', 'recovery']),
        },
      }
    case 'wildwarden.venom-shot':
      return {
        ...definition,
        apCost: 50,
        target: {
          ...definition.target,
          kind: 'ground-tile',
          teamPolicy: 'enemy',
          shape: { kind: 'circle', radius: 1 },
          friendlyFire: 'enemies-only',
        },
        effects: [
          { type: 'damage', recipient: 'affected-units', amount: 3 },
          { type: 'poison', recipient: 'affected-units', curseCopyable: true },
        ],
        ai: {
          ...definition.ai,
          purposeTags: rebalancePurposeTags(definition, ['poison', 'area', 'ground']),
        },
      }
    case 'wildwarden.renewing-herbs':
      return {
        ...definition,
        apCost: 35,
        effects: [
          { type: 'healing', recipient: 'primary-unit', amount: 4, ticks: 2 },
          { type: 'apply-status', recipient: 'primary-unit', statusId: 'summoned', stacks: 1 },
        ],
        ai: {
          ...definition.ai,
          purposeTags: rebalancePurposeTags(definition, ['heal', 'recovery', 'summon']),
        },
      }
    case 'edgedancer.severing-cut':
      return {
        ...definition,
        apCost: 45,
        target: {
          ...definition.target,
          maximumRange: 2,
          shape: { kind: 'line', length: 2 },
        },
        effects: [
          { type: 'damage', recipient: 'affected-units', amount: 4 },
          {
            type: 'bleed',
            recipient: 'affected-units',
            damagePerTick: 3,
            ticks: 3,
            curseCopyable: true,
          },
        ],
        ai: {
          ...definition.ai,
          purposeTags: rebalancePurposeTags(definition, ['bleed', 'line', 'area']),
        },
      }
    case 'cinderweaver.flame-burst':
      return {
        ...definition,
        apCost: 50,
        target: {
          ...definition.target,
          kind: 'ground-tile',
          shape: { kind: 'circle', radius: 1 },
        },
        effects: [
          {
            type: 'damage',
            recipient: 'affected-units',
            amount: 5,
            element: 'fire',
          },
          { type: 'burn', recipient: 'affected-units', curseCopyable: true },
        ],
        ai: {
          ...definition.ai,
          purposeTags: rebalancePurposeTags(definition, ['burn', 'area', 'ground']),
        },
      }
    case 'dawnshield.renewal':
      return {
        ...definition,
        effects: [
          { type: 'healing', recipient: 'actor', amount: 4, ticks: 2 },
          {
            type: 'remove-status',
            recipient: 'actor',
            statusIds: [
              'burn',
              'bleed',
              'poison',
              'slow',
              'root',
              'exposed',
              'mark',
              'marked',
              'challenged',
            ],
          },
        ],
        ai: {
          ...definition.ai,
          purposeTags: rebalancePurposeTags(definition, ['heal', 'recovery', 'cleanse']),
        },
      }
    case 'wildwarden.hunters-mark':
      return {
        ...definition,
        effects: [{ type: 'apply-status', recipient: 'primary-unit', statusId: 'mark', stacks: 1 }],
        ai: {
          ...definition.ai,
          purposeTags: rebalancePurposeTags(definition, ['mark', 'accuracy', 'setup']),
        },
      }
    default:
      return definition
  }
}

function createPhase4RebalancedSkill(definition: MatureSkillDefinition): MatureSkillDefinition {
  const accuracyMode = currentAccuracyMode(definition)
  const current = applyNamedPhase4Rebalance({
    ...definition,
    contentVersion: definition.contentVersion + 1,
    requirements: definition.requirements.map(currentRequirement),
    effects: definition.effects.map(currentEffect),
    accuracyMode,
    ...(accuracyMode === 'per-target'
      ? { accuracyModifierBasisPoints: definition.accuracyModifierBasisPoints ?? 0 }
      : { accuracyModifierBasisPoints: undefined }),
    authoring: {
      ...definition.authoring,
      validationTags: [
        ...new Set([...definition.authoring.validationTags, 'phase4-discipline-rebalance']),
      ],
    },
  })

  return current
}

const PHASE4_REBALANCED_DISCIPLINE_SKILLS = latestEnabledMatureSkills(
  PRE_PHASE4_REBALANCE_DISCIPLINE_SKILLS,
).map(createPhase4RebalancedSkill)

function createA03MysticMpSkillVersion(
  definition: MatureSkillDefinition,
): MatureSkillDefinition | null {
  if (!definition.tags.includes('mystic')) return null
  const mpCost = currentMysticMpCost(definition.apCost)
  if (definition.mpCost === mpCost) return null
  return {
    ...definition,
    contentVersion: definition.contentVersion + 1,
    mpCost,
    authoring: {
      ...definition.authoring,
      validationTags: [
        ...new Set([...definition.authoring.validationTags, 'a03-roster-rebalance']),
      ],
    },
  }
}

const A03_MYSTIC_MP_DISCIPLINE_SKILLS = latestEnabledMatureSkills([
  ...PRE_PHASE4_REBALANCE_DISCIPLINE_SKILLS,
  ...PHASE4_REBALANCED_DISCIPLINE_SKILLS,
]).flatMap((definition) => {
  const next = createA03MysticMpSkillVersion(definition)
  return next ? [next] : []
})

const PRE_V5_CURRENT_DISCIPLINE_SKILLS = [
  ...PRE_PHASE4_REBALANCE_DISCIPLINE_SKILLS,
  ...PHASE4_REBALANCED_DISCIPLINE_SKILLS,
  ...A03_MYSTIC_MP_DISCIPLINE_SKILLS,
] as const satisfies readonly MatureSkillDefinition[]

const V5_REBALANCED_DISCIPLINE_SKILLS = latestEnabledMatureSkills(
  PRE_V5_CURRENT_DISCIPLINE_SKILLS,
).map((definition) => rebalanceMatureSkillDefinition(definition, 'technique'))

export const P33_REPRESENTATIVE_DISCIPLINE_SKILLS = PRE_V5_CURRENT_DISCIPLINE_SKILLS

const CURRENT_DISCIPLINE_SKILL_REGISTRY = [
  ...P33_REPRESENTATIVE_DISCIPLINE_SKILLS,
  ...V5_REBALANCED_DISCIPLINE_SKILLS,
] as const satisfies readonly MatureSkillDefinition[]

/** Current selection catalog; the historical P3.3/P4 export remains stable for pinned contracts. */
export function latestEnabledMatureSkills(
  definitions: readonly MatureSkillDefinition[] = CURRENT_DISCIPLINE_SKILL_REGISTRY,
): readonly MatureSkillDefinition[] {
  const latest = new Map<string, MatureSkillDefinition>()
  for (const definition of definitions) {
    if (!definition.enabled) continue
    const previous = latest.get(definition.id)
    if (!previous || definition.contentVersion > previous.contentVersion)
      latest.set(definition.id, definition)
  }
  return [...latest.values()]
}

export function validateMatureSkillDefinition(
  definition: MatureSkillDefinition,
): readonly string[] {
  const issues: string[] = []
  try {
    validateCombatAccuracyDefinition(definition)
    validateGameplayActionMetadata(definition)
  } catch {
    issues.push('combatDefinition')
  }
  const idPattern = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/
  if (!idPattern.test(definition.id)) issues.push('id')
  if (!Number.isSafeInteger(definition.contentVersion) || definition.contentVersion < 1) {
    issues.push('contentVersion')
  }
  if (!definition.nameRef.trim()) issues.push('nameRef')
  if (!definition.descriptionRef.trim()) issues.push('descriptionRef')
  if (
    definition.flavorLine !== undefined &&
    (typeof definition.flavorLine !== 'string' ||
      definition.flavorLine.trim().length === 0 ||
      definition.flavorLine.length > 160 ||
      /[\r\n]/u.test(definition.flavorLine))
  ) {
    issues.push('flavorLine')
  }
  if (!idPattern.test(definition.sourceDisciplineId)) issues.push('sourceDisciplineId')
  if (
    !Number.isSafeInteger(definition.apCost) ||
    definition.apCost < 1 ||
    definition.apCost > 100
  ) {
    issues.push('apCost')
  }
  if (
    definition.mpCost !== undefined &&
    (!Number.isSafeInteger(definition.mpCost) || definition.mpCost < 0 || definition.mpCost > 20)
  )
    issues.push('mpCost')
  const effectDescriptions = definition.effectDescriptions as unknown
  if (effectDescriptions !== undefined) {
    if (
      !Array.isArray(effectDescriptions) ||
      effectDescriptions.length !== definition.effects.length
    ) {
      issues.push('effectDescriptions')
    } else {
      for (const [index, description] of effectDescriptions.entries()) {
        if (
          description !== null &&
          (typeof description !== 'string' ||
            description.trim().length === 0 ||
            description.length > 240 ||
            /[\r\n]/u.test(description))
        ) {
          issues.push(`effectDescriptions[${index}]`)
        }
      }
    }
  }
  if (definition.tags.length === 0 || definition.tags.some((tag) => !tag.trim()))
    issues.push('tags')
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
  const media = definition.media as MatureSkillMediaHooks | null | undefined
  if (!media || typeof media !== 'object') {
    issues.push('media')
  } else {
    const mediaKeyPattern = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u
    for (const field of ['iconKey', 'audioCueKey', 'vfxKey'] as const) {
      const value = media[field]
      if (value !== null && (typeof value !== 'string' || !mediaKeyPattern.test(value))) {
        issues.push(`media.${field}`)
      }
    }
  }
  if (definition.authoring.schemaVersion !== MATURE_SKILL_SCHEMA_VERSION) {
    issues.push('authoring.schemaVersion')
  }
  const usesV5BalanceRules = definition.authoring.validationTags.includes('owner-rebalance-v5')
  if (usesV5BalanceRules && !definition.flavorLine?.trim()) issues.push('flavorLine')
  if (usesV5BalanceRules && definition.requirements.length > 0) {
    if (definition.cooldown !== null) issues.push('cooldown')
  } else if (
    usesV5BalanceRules &&
    (definition.cooldown === null ||
      !idPattern.test(definition.cooldown.key) ||
      !Number.isSafeInteger(definition.cooldown.ownerTurns) ||
      definition.cooldown.ownerTurns < 1 ||
      definition.cooldown.ownerTurns > 3)
  ) {
    issues.push('cooldown')
  } else if (
    !usesV5BalanceRules &&
    (definition.cooldown === null ||
      !idPattern.test(definition.cooldown.key) ||
      !Number.isSafeInteger(definition.cooldown.ownerTurns) ||
      definition.cooldown.ownerTurns < 1)
  ) {
    issues.push('cooldown')
  }

  for (const [index, effect] of definition.effects.entries()) {
    const durationTurns = effect.durationTurns ?? 0
    if (
      !Number.isSafeInteger(durationTurns) ||
      durationTurns < 0 ||
      durationTurns > 4
    ) {
      issues.push(`effects[${index}].durationTurns`)
    }
    if (
      effect.potencyBasisPoints !== undefined &&
      (!Number.isSafeInteger(effect.potencyBasisPoints) ||
        effect.potencyBasisPoints < 100 ||
        effect.potencyBasisPoints > 5_000)
    ) {
      issues.push(`effects[${index}].potencyBasisPoints`)
    }
    if (
      effect.power !== undefined &&
      (!Number.isSafeInteger(effect.power) || effect.power < 1 || effect.power > 20)
    ) {
      issues.push(`effects[${index}].power`)
    }
    if (
      usesV5BalanceRules &&
      (effect.type === 'damage' || effect.type === 'healing' || effect.type === 'barrier-change')
    ) {
      const minimum = effect.type === 'damage' && effect.vengeance !== undefined ? 0 : 1
      if (
        !Number.isSafeInteger(effect.amount) ||
        effect.amount < minimum ||
        effect.amount > 20
      ) {
        issues.push(`effects[${index}].amount`)
      }
    }
    if (usesV5BalanceRules && effect.type === 'resource-change') {
      const magnitude = Math.abs(effect.delta)
      if (!Number.isSafeInteger(magnitude) || magnitude < 1 || magnitude > 20) {
        issues.push(`effects[${index}].delta`)
      }
    }
    if (usesV5BalanceRules && effect.type === 'bleed') {
      if (
        !Number.isSafeInteger(effect.damagePerTick) ||
        effect.damagePerTick < 1 ||
        effect.damagePerTick > 20
      ) {
        issues.push(`effects[${index}].damagePerTick`)
      }
    }
  }
  for (const [context, override] of Object.entries(definition.overrides)) {
    if (
      override?.apCost !== undefined &&
      (!Number.isSafeInteger(override.apCost) || override.apCost < 1 || override.apCost > 100)
    ) {
      issues.push(`overrides.${context}.apCost`)
    }
    if (
      override?.cooldownOwnerTurns !== undefined &&
      (!Number.isSafeInteger(override.cooldownOwnerTurns) ||
        override.cooldownOwnerTurns < 1 ||
        override.cooldownOwnerTurns > 3)
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
  const candidates = CURRENT_DISCIPLINE_SKILL_REGISTRY.filter(
    (definition) => definition.id === skillId && definition.enabled,
  )
  if (contentVersion !== undefined) {
    return candidates.find((definition) => definition.contentVersion === contentVersion) ?? null
  }
  return (
    [...candidates].sort((left, right) => right.contentVersion - left.contentVersion)[0] ?? null
  )
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
    cooldown:
      definition.cooldown === null
        ? null
        : {
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
    cost: { spendsAction: true, mp: resolved.mpCost ?? 0 },
    requirements: resolved.requirements,
    ...(resolved.cooldown === null ? {} : { cooldown: resolved.cooldown }),
    effects: resolved.effects,
    ...(resolved.accuracyMode !== undefined ? { accuracyMode: resolved.accuracyMode } : {}),
    ...(resolved.accuracyModifierBasisPoints !== undefined
      ? { accuracyModifierBasisPoints: resolved.accuracyModifierBasisPoints }
      : {}),
  }
}

function assertUsableDefinition(definition: MatureSkillDefinition): void {
  const issues = validateMatureSkillDefinition(definition)
  if (issues.length > 0)
    throw new TypeError(`Invalid mature Skill definition: ${issues.join(', ')}.`)
  if (!definition.enabled) throw new RangeError('That mature Skill version is disabled.')
}
