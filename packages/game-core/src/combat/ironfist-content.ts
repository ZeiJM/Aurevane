import type { MatureSkillDefinition } from './mature-skills'
import type { EssenceDefinition } from './essence'
import type { ResonanceDefinition } from './resonance'

const melee = {
  kind: 'unit',
  teamPolicy: 'enemy',
  shape: { kind: 'single' },
  minimumRange: 1,
  maximumRange: 1,
  requiresLineOfSight: false,
  maximumElevationDifference: 1,
  friendlyFire: 'enemies-only',
} as const
const self = {
  kind: 'self',
  teamPolicy: 'self',
  shape: { kind: 'single' },
  minimumRange: 0,
  maximumRange: 0,
  requiresLineOfSight: false,
  maximumElevationDifference: null,
  friendlyFire: 'allies-only',
} as const
const authoring = {
  schemaVersion: 1,
  status: 'representative',
  validationTags: ['p4', 'ironfist', 'bounded', 'shared-combat-authority'],
} as const

function media(id: string) {
  return { iconKey: `${id}.icon`, audioCueKey: `${id}.audio`, vfxKey: `${id}.vfx` }
}

function technique(
  key: string,
  apCost: number,
  target: MatureSkillDefinition['target'],
  effects: MatureSkillDefinition['effects'],
  tags: readonly string[],
  baseUtility: number,
  requirements: MatureSkillDefinition['requirements'] = [],
): MatureSkillDefinition {
  const id = `ironfist.${key}`
  return {
    id,
    contentVersion: 1,
    enabled: true,
    nameRef: `skill.${id}.name`,
    descriptionRef: `skill.${id}.description`,
    sourceDisciplineId: 'ironfist',
    unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
    apCost,
    target,
    effects,
    requirements,
    tags: ['discipline', 'ironfist', ...tags],
    // The schema retains positive legacy metadata; PV-1F strips it and applies repeat falloff.
    cooldown: { key: id, ownerTurns: 2 },
    ai: {
      enabled: true,
      baseUtility,
      purposeTags: tags.filter((tag) => !tag.startsWith('cockpit:')),
    },
    overrides: {},
    media: media(`skill.${id}`),
    authoring,
  }
}

export const IRONFIST_SKILLS: readonly MatureSkillDefinition[] = [
  technique(
    'rising-fist',
    35,
    melee,
    [
      { type: 'damage', recipient: 'primary-unit', amount: 7 },
      { type: 'apply-status', recipient: 'primary-unit', statusId: 'exposed', stacks: 1 },
    ],
    ['attack', 'melee', 'expose', 'setup', 'cockpit:attack'],
    71,
  ),
  technique(
    'sweep',
    45,
    { ...melee, shape: { kind: 'circle', radius: 1 } },
    [{ type: 'damage', recipient: 'affected-units', amount: 7 }],
    ['attack', 'melee', 'area', 'cockpit:attack'],
    70,
  ),
  technique(
    'focus-breath',
    35,
    self,
    [
      { type: 'healing', recipient: 'actor', amount: 7 },
      { type: 'resource-change', recipient: 'actor', resource: 'mp', delta: 5 },
    ],
    ['recovery', 'heal', 'cockpit:recovery'],
    60,
  ),
  technique(
    'counter-palm',
    35,
    melee,
    [{ type: 'damage', recipient: 'primary-unit', amount: 14 }],
    ['attack', 'melee', 'payoff', 'cockpit:attack'],
    78,
    [{ kind: 'actor-status-present', statusId: 'guarded' }],
  ),
  technique(
    'breakfall',
    25,
    self,
    [{ type: 'apply-status', recipient: 'actor', statusId: 'guarded', stacks: 1 }],
    ['defense', 'setup', 'cockpit:defense'],
    63,
  ),
  technique(
    'hammer-knuckle',
    45,
    melee,
    [{ type: 'damage', recipient: 'primary-unit', amount: 17 }],
    ['attack', 'melee', 'payoff', 'finisher', 'cockpit:attack'],
    82,
    [{ kind: 'target-status-present', statusId: 'exposed' }],
  ),
  technique(
    'pressure-palm',
    45,
    melee,
    [
      { type: 'damage', recipient: 'primary-unit', amount: 7 },
      { type: 'apply-status', recipient: 'actor', statusId: 'guarded', stacks: 1 },
    ],
    ['attack', 'melee', 'defense', 'setup', 'cockpit:attack'],
    72,
  ),
  technique(
    'last-stand',
    40,
    self,
    [
      { type: 'healing', recipient: 'actor', amount: 12 },
      { type: 'apply-status', recipient: 'actor', statusId: 'guarded', stacks: 1 },
    ],
    ['recovery', 'heal', 'defense', 'cockpit:recovery'],
    77,
    [{ kind: 'actor-hp-at-most', basisPoints: 5000 }],
  ),
]

const essenceId = 'essence.ironfist.hundredfold-rush'
export const IRONFIST_ESSENCE: EssenceDefinition = {
  essenceId,
  contentVersion: 1,
  enabled: true,
  sourceDisciplineId: 'ironfist',
  name: 'Hundredfold Rush',
  description:
    'Commit to three close-range strikes. Each hit resolves against defenses; distance and heavy armor blunt the rush.',
  skill: {
    ...technique(
      'hundredfold-rush',
      60,
      melee,
      [
        { type: 'damage', recipient: 'primary-unit', amount: 7 },
        { type: 'damage', recipient: 'primary-unit', amount: 7 },
        { type: 'damage', recipient: 'primary-unit', amount: 7 },
      ],
      ['attack', 'melee', 'finisher', 'cockpit:attack'],
      94,
    ),
    id: essenceId,
    nameRef: `${essenceId}.name`,
    descriptionRef: `${essenceId}.description`,
    tags: ['essence', 'ironfist', 'attack', 'melee', 'finisher', 'cockpit:attack'],
    cooldown: { key: essenceId, ownerTurns: 4 },
    overrides: { pvp: { apCost: 65 } },
    media: media(essenceId),
  },
  authoring,
}

function resonance(
  other: string,
  key: string,
  name: string,
  description: string,
  setup: ResonanceDefinition['trigger']['setup'],
  payoff: ResonanceDefinition['trigger']['payoff'],
  amount: number,
): ResonanceDefinition {
  const pair = [other, 'ironfist'].sort() as [string, string]
  const id = `resonance.${pair.join('-')}.${key}`
  return {
    id,
    contentVersion: 1,
    enabled: true,
    disciplinePair: pair,
    name,
    description,
    trigger: {
      kind: 'skill-sequence',
      setup,
      payoff,
      payoffEffects: [{ type: 'damage', recipient: 'primary-unit', amount }],
      aiSetupUtilityBonus: 12,
      aiPayoffUtilityBonus: 27,
    },
    media: media(id),
    authoring,
  }
}

export const IRONFIST_RESONANCES: readonly ResonanceDefinition[] = [
  resonance(
    'aetherist',
    'conductive-impact',
    'Conductive Impact',
    'An Ironfist exposure Skill sets up the next Aetherist mystic attack for 5 additional damage.',
    { sourceDisciplineId: 'ironfist', requiredTags: ['expose'] },
    { sourceDisciplineId: 'aetherist', requiredTags: ['attack', 'mystic'] },
    5,
  ),
  resonance(
    'farstrider',
    'marked-approach',
    'Marked Approach',
    'A Farstrider mark sets up the next Ironfist melee attack for 5 additional damage.',
    { sourceDisciplineId: 'farstrider', requiredTags: ['mark'] },
    { sourceDisciplineId: 'ironfist', requiredTags: ['attack', 'melee'] },
    5,
  ),
  resonance(
    'lifebinder',
    'renewed-force',
    'Renewed Force',
    'A Lifebinder healing Skill sets up the next Ironfist melee attack for 5 additional damage.',
    { sourceDisciplineId: 'lifebinder', requiredTags: ['heal'] },
    { sourceDisciplineId: 'ironfist', requiredTags: ['attack', 'melee'] },
    5,
  ),
  resonance(
    'shadehand',
    'broken-rhythm',
    'Broken Rhythm',
    'An Ironfist exposure Skill sets up the next Shadehand melee attack for 5 additional damage.',
    { sourceDisciplineId: 'ironfist', requiredTags: ['expose'] },
    { sourceDisciplineId: 'shadehand', requiredTags: ['attack', 'melee'] },
    5,
  ),
  resonance(
    'vanguard',
    'tempered-response',
    'Tempered Response',
    'An Ironfist defensive Skill sets up the next Vanguard melee attack for 4 additional damage.',
    { sourceDisciplineId: 'ironfist', requiredTags: ['defense'] },
    { sourceDisciplineId: 'vanguard', requiredTags: ['attack', 'melee'] },
    4,
  ),
]
