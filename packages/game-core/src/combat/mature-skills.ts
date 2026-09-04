import type {
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
    target: meleeEnemyTarget,
    requirements: [],
    effects: [{ type: 'damage', recipient: 'primary-unit', amount: 10 }],
    tags: ['discipline', 'vanguard', 'attack', 'melee'],
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
    tags: ['discipline', 'vanguard', 'attack', 'melee'],
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
    tags: ['discipline', 'vanguard', 'attack', 'melee', 'area'],
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
    tags: ['discipline', 'vanguard', 'attack', 'melee', 'pressure'],
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
    tags: ['discipline', 'vanguard', 'defense', 'guard'],
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
    tags: ['discipline', 'vanguard', 'support', 'recovery'],
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
    tags: ['discipline', 'vanguard', 'attack', 'defense', 'melee'],
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
    tags: ['discipline', 'vanguard', 'heal', 'survival'],
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
    tags: ['discipline', 'vanguard', 'attack', 'melee', 'area'],
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
    tags: ['discipline', 'lifebinder', 'heal', 'support'],
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
    tags: ['discipline', 'lifebinder', 'heal', 'support'],
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
    effects: [
      { type: 'apply-status', recipient: 'primary-unit', statusId: 'guarded', stacks: 1 },
    ],
    tags: ['discipline', 'lifebinder', 'defense', 'support', 'guard'],
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
    tags: ['discipline', 'lifebinder', 'heal', 'support', 'recovery'],
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
    tags: ['discipline', 'lifebinder', 'heal', 'support', 'area'],
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
    tags: ['discipline', 'lifebinder', 'heal', 'defense', 'support'],
    cooldown: { key: 'lifebinder.fortifying-light', ownerTurns: 4 },
    ai: { enabled: true, baseUtility: 71, purposeTags: ['heal', 'defense', 'support'] },
    overrides: {},
    media: representativeMedia('lifebinder.fortifying-light'),
    authoring: representativeAuthoring('p3.8', 'nonfinal-content-name'),
  },
] as const satisfies readonly MatureSkillDefinition[]

export function validateMatureSkillDefinition(
  definition: MatureSkillDefinition,
): readonly string[] {
  const issues: string[] = []
  const idPattern = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/
  if (!idPattern.test(definition.id)) issues.push('id')
  if (!Number.isSafeInteger(definition.contentVersion) || definition.contentVersion < 1) {
    issues.push('contentVersion')
  }
  if (!definition.nameRef.trim()) issues.push('nameRef')
  if (!definition.descriptionRef.trim()) issues.push('descriptionRef')
  if (!idPattern.test(definition.sourceDisciplineId)) issues.push('sourceDisciplineId')
  if (
    !Number.isSafeInteger(definition.apCost) ||
    definition.apCost < 1 ||
    definition.apCost > 100
  ) {
    issues.push('apCost')
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
    if (
      override?.apCost !== undefined &&
      (!Number.isSafeInteger(override.apCost) || override.apCost < 1 || override.apCost > 100)
    ) {
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
    cooldown: resolved.cooldown,
    effects: resolved.effects,
  }
}

function assertUsableDefinition(definition: MatureSkillDefinition): void {
  const issues = validateMatureSkillDefinition(definition)
  if (issues.length > 0)
    throw new TypeError(`Invalid mature Skill definition: ${issues.join(', ')}.`)
  if (!definition.enabled) throw new RangeError('That mature Skill version is disabled.')
}
