import type { CombatEncounterState, CombatActionDefinition } from './actions'
import {
  getStatDrivenCombatProfile,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'
import { calculateScaledRawDamage } from './damage-scaling'
import { PV1F_BASIC_ATTACK_ID } from './pv1f-skills'
import {
  parseAbilityDefinition,
  validateAbilityDefinition,
  type AbilityDefinition,
  type AbilityBehavior,
} from './combat-definition'
import {
  captureCombatAbilitySource,
  type CapturedCombatAbilitySource,
} from './combat-behavior-capture'
import { SUPPORT_ACTION_IDS, parseSupportActionId, type SupportActionId } from './support-actions'

export const BASIC_SKILL_IDS = ['basic.move', 'unarmed.basic', ...SUPPORT_ACTION_IDS] as const
export type BasicSkillId = (typeof BASIC_SKILL_IDS)[number]
export type BasicSkillExecution =
  | { readonly kind: 'basic-action'; readonly recoveryRounding?: 'nearest' | 'floor' }
  | { readonly kind: 'basic-attack'; readonly scalingBasisPoints: number }
  | { readonly kind: 'basic-move'; readonly costBasis: 'flat' | 'per-terrain-point' }

/** The complete published record is pinned inside the private Ability source. */
export interface BasicSkillDefinition {
  readonly schemaVersion: 1
  readonly id: BasicSkillId
  readonly contentVersion: number
  readonly enabled: boolean
  readonly name: string
  readonly description: string
  readonly battleText?: string
  readonly tags: readonly string[]
  readonly media: {
    readonly iconKey: string | null
    readonly audioCueKey: string | null
    readonly vfxKey: string | null
  }
  readonly execution: BasicSkillExecution
  readonly ability: AbilityDefinition
}
export interface BasicSkillDefinitionIssue {
  readonly path: string
  readonly code: string
  readonly message: string
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0

export function validateBasicSkillDefinition(value: unknown): readonly BasicSkillDefinitionIssue[] {
  const issues: BasicSkillDefinitionIssue[] = []
  const issue = (path: string, code: string, message: string) =>
    issues.push({ path, code, message })
  if (!record(value))
    return [{ path: '', code: 'invalid-basic', message: 'Basic Skill must be a complete record.' }]
  const keys = (row: Record<string, unknown>, allowed: readonly string[], path: string) => {
    for (const key of Object.keys(row))
      if (!allowed.includes(key))
        issue(path ? `${path}.${key}` : key, 'unknown-key', 'Unsupported Basic Skill field.')
  }
  keys(
    value,
    [
      'schemaVersion',
      'id',
      'contentVersion',
      'enabled',
      'name',
      'description',
      'battleText',
      'tags',
      'media',
      'execution',
      'ability',
    ],
    '',
  )
  if (
    value.schemaVersion !== 1 ||
    !BASIC_SKILL_IDS.includes(value.id as BasicSkillId) ||
    !positive(value.contentVersion) ||
    typeof value.enabled !== 'boolean'
  )
    issue('', 'invalid-basic', 'Basic Skill identity, version or enabled state is invalid.')
  for (const key of ['name', 'description'] as const)
    if (
      typeof value[key] !== 'string' ||
      !value[key].trim() ||
      value[key].length > (key === 'name' ? 120 : 12000)
    )
      issue(key, 'invalid-text', 'Basic Skill text must be nonempty and bounded.')
  if (
    value.battleText !== undefined &&
    (typeof value.battleText !== 'string' || value.battleText.length > 12000)
  )
    issue('battleText', 'invalid-text', 'Battle text must be a bounded string.')
  if (
    !Array.isArray(value.tags) ||
    value.tags.length > 64 ||
    value.tags.some((tag) => typeof tag !== 'string' || !tag.trim())
  )
    issue('tags', 'invalid-tags', 'Basic Skill tags must be bounded nonempty strings.')
  if (!record(value.media)) issue('media', 'invalid-media', 'Media fields are required.')
  else {
    keys(value.media, ['iconKey', 'audioCueKey', 'vfxKey'], 'media')
    for (const key of ['iconKey', 'audioCueKey', 'vfxKey'])
      if (
        value.media[key] !== null &&
        (typeof value.media[key] !== 'string' ||
          !(value.media[key] as string).trim() ||
          (value.media[key] as string).length > 512)
      )
        issue(
          `media.${key}`,
          'invalid-media',
          'Media identity must be null or a bounded nonempty string.',
        )
  }
  const abilityIssues = validateAbilityDefinition(value.ability)
  issues.push(...abilityIssues.map((row) => ({ ...row, path: `ability.${row.path}` })))
  if (!record(value.execution))
    issue('execution', 'invalid-execution', 'Basic execution binding is required.')
  else {
    const execution = value.execution
    if (value.id === 'unarmed.basic') {
      keys(execution, ['kind', 'scalingBasisPoints'], 'execution')
      if (
        execution.kind !== 'basic-attack' ||
        !Number.isSafeInteger(execution.scalingBasisPoints) ||
        (execution.scalingBasisPoints as number) < 0 ||
        (execution.scalingBasisPoints as number) > 10000
      )
        issue(
          'execution',
          'invalid-execution',
          'Basic Attack requires its captured higher-power scaling binding.',
        )
    } else if (value.id === 'basic.move') {
      keys(execution, ['kind', 'costBasis'], 'execution')
      if (
        execution.kind !== 'basic-move' ||
        !['flat', 'per-terrain-point'].includes(execution.costBasis as string)
      )
        issue(
          'execution',
          'invalid-execution',
          'Move requires an explicit flat Skill cost or native traversal price.',
        )
    } else {
      keys(execution, ['kind', 'recoveryRounding'], 'execution')
      if (
        execution.recoveryRounding !== undefined &&
        !['nearest', 'floor'].includes(execution.recoveryRounding as string)
      )
        issue(
          'execution.recoveryRounding',
          'invalid-execution',
          'Recovery rounding must be nearest or floor.',
        )
      if (execution.kind !== 'basic-action')
        issue(
          'execution',
          'invalid-execution',
          'Support Skills use the standard shared action binding.',
        )
    }
    if (!abilityIssues.length) {
      const ability = value.ability as AbilityDefinition
      if (
        ability.behaviors.some(
          (behavior) => behavior.activation !== 'manual' || behavior.mode !== 'action',
        )
      )
        issue(
          'ability',
          'basic-manual-action',
          'Basic and Support records currently support Manual action groups.',
        )
      if (
        execution.kind === 'basic-action' &&
        execution.recoveryRounding === 'nearest' &&
        ability.behaviors.some((behavior) =>
          behavior.effects.some(
            (effect) =>
              effect.payload.type === 'percentage-recovery' && effect.payload.recipient !== 'actor',
          ),
        )
      )
        issue(
          'ability',
          'native-recovery-conversion',
          'Nearest native Recovery currently binds actor percentages. Use floor rounding for percentages targeting other recipients.',
        )
      if (value.id === 'unarmed.basic')
        for (const [index, behavior] of ability.behaviors.entries()) {
          if (!(behavior.costs.find((cost) => cost.resource === 'ap')?.amount ?? 0))
            issue(
              `ability.behaviors[${index}].costs`,
              'basic-attack-positive-ap',
              'Basic Attack requires a positive authored AP cost.',
            )
          if (behavior.attackFamily !== 'physical')
            issue(
              `ability.behaviors[${index}].attackFamily`,
              'basic-attack-adaptive-family',
              'Basic Attack uses the higher current offensive stat, with Physical ties. Keep the Physical template marker; fixed-family authoring is unsupported by this native binding.',
            )
          if (
            behavior.classification !== 'attack' ||
            !behavior.effects.some((effect) =>
              ['damage', 'pierce'].includes(effect.payload.type),
            ) ||
            behavior.effects.some(
              (effect) =>
                (effect.payload.type === 'damage' || effect.payload.type === 'pierce') &&
                (effect.payload.scaling ||
                  ('vengeance' in effect.payload && effect.payload.vengeance)),
            )
          )
            issue(
              `ability.behaviors[${index}]`,
              'basic-attack-stat-binding',
              'Basic Attack retains higher-power stat-derived damage; use its captured scaling field instead of a second scaling or Vengeance formula.',
            )
        }
      if (
        value.id === 'basic.move' &&
        ability.behaviors.some((behavior) => behavior.effects[0]?.payload.type !== 'move')
      )
        issue(
          'ability',
          'basic-move-effect',
          'Every Move action group must begin with the executable Move effect.',
        )
      if (value.id === 'basic.move' && execution.costBasis === 'per-terrain-point') {
        const behavior = ability.behaviors[0]
        const target = behavior?.targeting
        const nativeDestination =
          target?.kind === 'self' ||
          (target?.kind === 'ground-tile' &&
            target.geometryVersion === 3 &&
            target.categories?.length === 1 &&
            target.categories[0] === 'ground' &&
            target.shape.kind === 'single' &&
            target.maximumSelections === 1 &&
            target.minimumRange === 0 &&
            target.maximumRange === 0)
        if (
          ability.behaviors.length !== 1 ||
          !behavior ||
          behavior.effects.length !== 1 ||
          behavior.effects[0]!.requirements ||
          behavior.classification !== 'utility' ||
          behavior.costs.length !== 1 ||
          behavior.costs[0]!.resource !== 'ap' ||
          behavior.costs[0]!.amount < 10 ||
          behavior.costs[0]!.amount > 100 ||
          behavior.cooldown ||
          behavior.requirements ||
          behavior.activationLimits?.length ||
          !nativeDestination
        )
          issue(
            'ability',
            'native-move-conversion',
            'Native per-terrain-point Move supports pure walking only. Use a flat overall Skill cost for follow-up effects, extra resource costs, cooldowns or Requirements; no additional walking charge is added.',
          )
      }
    }
  }
  return issues
}

export function parseBasicSkillDefinition(value: unknown): BasicSkillDefinition {
  const issues = validateBasicSkillDefinition(value)
  if (issues.length)
    throw new TypeError(
      `Invalid Basic Skill: ${issues.map((row) => `${row.path}: ${row.message}`).join('; ')}`,
    )
  const parsed = JSON.parse(JSON.stringify(value)) as BasicSkillDefinition
  return { ...parsed, ability: parseAbilityDefinition(parsed.ability) }
}

const selfTarget = {
  geometryVersion: 3 as const,
  kind: 'self' as const,
  teamPolicy: 'self' as const,
  friendlyFire: 'allies-only' as const,
  shape: { kind: 'single' as const },
  categories: ['self' as const],
  minimumRange: 0,
  maximumRange: 0,
  requiresLineOfSight: false,
  maximumElevationDifference: null,
  maximumSelections: 1,
}

export function defaultBasicSkills(): readonly BasicSkillDefinition[] {
  const behavior = (
    cost: number,
    effects: AbilityBehavior['effects'],
    options: Partial<AbilityBehavior> = {},
  ): AbilityDefinition => ({
    schemaVersion: 1,
    behaviors: [
      {
        id: 'use',
        activation: 'manual',
        mode: 'action',
        classification: 'utility',
        costs: [{ resource: 'ap', amount: cost }],
        cooldown: null,
        requirements: null,
        targeting: selfTarget,
        effects,
        ...options,
      },
    ],
  })
  const make = (
    id: BasicSkillId,
    name: string,
    description: string,
    execution: BasicSkillExecution,
    ability: AbilityDefinition,
  ): BasicSkillDefinition => ({
    schemaVersion: 1,
    id,
    contentVersion: 1,
    enabled: true,
    name,
    description,
    tags: ['basic'],
    media: { iconKey: null, audioCueKey: null, vfxKey: null },
    execution,
    ability,
  })
  return [
    make(
      'basic.move',
      'Move',
      'Walk through legal terrain within your remaining Movement.',
      { kind: 'basic-move', costBasis: 'per-terrain-point' },
      behavior(20, [
        {
          id: 'move',
          timing: 'instant',
          payload: { type: 'move', recipient: 'actor', maximumTiles: 20 },
        },
      ]),
    ),
    make(
      'unarmed.basic',
      'Basic Attack',
      'Strike using your higher Physical or Mystic Attack.',
      { kind: 'basic-attack', scalingBasisPoints: 1500 },
      behavior(
        30,
        [
          {
            id: 'hit',
            payload: {
              type: 'damage',
              recipient: 'primary-unit',
              amount: 6,
              facingModifiersBasisPoints: { front: 10000, side: 11000, rear: 12500 },
            },
          },
        ],
        {
          classification: 'attack',
          attackFamily: 'physical',
          targeting: {
            ...selfTarget,
            kind: 'unit',
            teamPolicy: 'enemy',
            friendlyFire: 'enemies-only',
            categories: ['enemy'],
            minimumRange: 1,
            maximumRange: 1,
            maximumElevationDifference: 1,
          },
        },
      ),
    ),
    make(
      'basic.guard',
      'Guard',
      'Protect yourself with Guarded.',
      { kind: 'basic-action' },
      behavior(
        30,
        [
          {
            id: 'guard',
            payload: {
              type: 'apply-status',
              recipient: 'actor',
              statusId: 'guarded',
              stacks: 1,
              durationTurns: 2,
            },
          },
        ],
        { cooldown: { key: 'basic.guard', ownerTurns: 2 } },
      ),
    ),
    make(
      'basic.recover',
      'HP Recovery',
      'Recover a percentage of your maximum HP.',
      { kind: 'basic-action', recoveryRounding: 'nearest' },
      behavior(
        50,
        [
          {
            id: 'recovery',
            payload: {
              type: 'percentage-recovery',
              recipient: 'actor',
              resource: 'hp',
              percentageBasisPoints: 1000,
            },
          },
        ],
        {
          classification: 'recovery',
          cooldown: { key: 'basic.recovery', ownerTurns: 2 },
          requirements: {
            kind: 'resource-state',
            subject: 'owner',
            resource: 'hp',
            comparison: 'at-most',
            basisPoints: 9999,
          },
        },
      ),
    ),
    make(
      'basic.recover.mp',
      'MP Recovery',
      'Recover a percentage of your maximum MP.',
      { kind: 'basic-action', recoveryRounding: 'nearest' },
      behavior(
        50,
        [
          {
            id: 'recovery',
            payload: {
              type: 'percentage-recovery',
              recipient: 'actor',
              resource: 'mp',
              percentageBasisPoints: 1000,
            },
          },
        ],
        {
          classification: 'recovery',
          cooldown: { key: 'basic.recovery', ownerTurns: 2 },
          requirements: {
            kind: 'resource-state',
            subject: 'owner',
            resource: 'mp',
            comparison: 'at-most',
            basisPoints: 9999,
          },
        },
      ),
    ),
  ]
}

export function resolveBasicSkillVersion(
  id: BasicSkillId,
  contentVersion: number,
  definitions: readonly BasicSkillDefinition[],
): BasicSkillDefinition {
  const matches = definitions.filter(
    (row) => row.id === id && row.contentVersion === contentVersion,
  )
  if (matches.length !== 1)
    throw new RangeError('Basic Skill exact version is missing or ambiguous.')
  return parseBasicSkillDefinition(matches[0])
}

export function captureBasicSkillSources(input: {
  readonly ownerCombatantId: string
  readonly supportActionId: SupportActionId
  readonly definitions: readonly BasicSkillDefinition[]
}): readonly CapturedCombatAbilitySource[] {
  if (!parseSupportActionId(input.supportActionId))
    throw new TypeError('Invalid captured Support choice.')
  return (['basic.move', 'unarmed.basic', input.supportActionId] as const).map((id) => {
    const matches = input.definitions.filter((row) => row.id === id)
    if (matches.length !== 1)
      throw new RangeError(`Basic Skill admission needs one resolved definition for ${id}.`)
    const basic = parseBasicSkillDefinition(matches[0])
    return captureCombatAbilitySource({
      schemaVersion: 1,
      sourceInstanceId: JSON.stringify(['basic', input.ownerCombatantId, id, basic.contentVersion]),
      ownerCombatantId: input.ownerCombatantId,
      abilityId: id,
      contentVersion: basic.contentVersion,
      sourceKind: 'basic',
      tags: basic.tags,
      definition: basic.ability,
      basic,
    })
  })
}

/** Full captures outrank current publications; a missing equipped option cannot fall back. */
export function capturedBasicSkillSource(
  state: CombatEncounterState,
  ownerCombatantId: string,
  actionId: string,
): CapturedCombatAbilitySource | null {
  const id = actionId === PV1F_BASIC_ATTACK_ID ? 'unarmed.basic' : actionId
  if (!BASIC_SKILL_IDS.includes(id as BasicSkillId)) return null
  const captures = (state.capturedAbilitySources ?? []).filter(
    (source) => source.ownerCombatantId === ownerCombatantId && source.basic,
  )
  if (!captures.length) return null
  const matches = captures.filter((source) => source.abilityId === id)
  if (matches.length !== 1)
    throw new RangeError(
      'Basic Skill is not in the captured equipped actions, or its capture is ambiguous.',
    )
  return matches[0]!
}

/** Resolve only native binding values at S0; never mutate the saved definition. */
export function effectiveBasicSkillBehavior(
  state: CombatEncounterState,
  source: CapturedCombatAbilitySource,
  behavior: AbilityBehavior,
): AbilityBehavior {
  const basic = source.basic
  if (!basic) return behavior
  if (basic.execution.kind === 'basic-move') {
    if (basic.execution.costBasis === 'per-terrain-point')
      throw new TypeError('Native Basic Move requires its captured walking facade.')
    if (isFreeOffensiveBasicMove(source, behavior))
      return {
        ...behavior,
        activationLimits: [
          ...new Set([...(behavior.activationLimits ?? []), 'once-per-owner-turn' as const]),
        ],
      }
  }
  if (basic.execution.kind !== 'basic-attack') return behavior
  if (!state.statBridge) throw new TypeError('Basic Attack requires its supported stat bridge.')
  const profile = getStatDrivenCombatProfile(
    state as StatDrivenCombatEncounterState,
    source.ownerCombatantId,
  )
  const family = (profile.mysticPower ?? 0) > (profile.physicalPower ?? 0) ? 'mystic' : 'physical'
  const power = (family === 'mystic' ? profile.mysticPower : profile.physicalPower) ?? 0
  const coefficientBasisPoints = basic.execution.scalingBasisPoints
  return {
    ...behavior,
    attackFamily: family,
    effects: behavior.effects.map((effect) =>
      effect.payload.type === 'damage' || effect.payload.type === 'pierce'
        ? {
            ...effect,
            payload: {
              ...effect.payload,
              amount: calculateScaledRawDamage(
                effect.payload.amount,
                {
                  source: family === 'mystic' ? 'mystic-power' : 'physical-power',
                  coefficientBasisPoints,
                },
                power,
              ),
              defenseKind: family === 'mystic' ? ('ward' as const) : ('armor' as const),
            },
          }
        : effect,
    ),
  }
}

export function bindBasicSkillAction(
  state: CombatEncounterState,
  source: CapturedCombatAbilitySource,
  action: CombatActionDefinition,
): CombatActionDefinition {
  const basic = source.basic
  if (!basic) return action
  if (basic.execution.kind === 'basic-attack')
    return {
      ...action,
      id: PV1F_BASIC_ATTACK_ID,
      sourceType: 'basic-attack',
      nativeBasicAttackCommand: true,
    }
  const rounding =
    basic.execution.kind === 'basic-action' && basic.execution.recoveryRounding === 'nearest'
  const owner = state.tactical.battle.combatants.find(
    (unit) => unit.id === source.ownerCombatantId,
  )!
  return {
    ...action,
    sourceType: 'basic-action',
    effects: rounding
      ? action.effects.map((effect) => {
          if (effect.type !== 'percentage-recovery') return effect
          const { percent, resource, ...payload } = effect
          const maximum = resource === 'hp' ? owner.maxHp : owner.maxMp
          if (maximum < 1)
            throw new RangeError('Native Basic Recovery requires a positive maximum resource.')
          const amount = Math.max(1, Number((BigInt(maximum) * BigInt(percent) + 50n) / 100n))
          return resource === 'hp'
            ? { ...payload, type: 'healing' as const, amount }
            : {
                ...payload,
                type: 'resource-change' as const,
                resource: 'mp' as const,
                delta: amount,
              }
        })
      : action.effects,
  }
}

export function isFreeOffensiveBasicMove(
  source: CapturedCombatAbilitySource,
  behavior: AbilityBehavior,
): boolean {
  return (
    source.basic?.id === 'basic.move' &&
    source.basic.execution.kind === 'basic-move' &&
    source.basic.execution.costBasis === 'flat' &&
    (behavior.costs.find((cost) => cost.resource === 'ap')?.amount ?? 0) === 0 &&
    behavior.effects.some((effect) => ['damage', 'pierce'].includes(effect.payload.type))
  )
}
