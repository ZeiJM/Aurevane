import { combatTagWordingIsValid, renderCombatTagWording } from './combat-tag-wording'
import {
  SUPPORTED_COMBAT_STATUS_IDS,
  COMBAT_PRESENTATION_TAG_IDS,
  isCombatPresentationTagId,
  combatEffectPresentationId,
  currentCombatTagName,
} from './combat-effect-identities'
export { SUPPORTED_COMBAT_STATUS_IDS } from './combat-effect-identities'
import { validateCombatEffectTarget } from './combat-effect-recipients'
import type { CombatEffectDefinition, CombatEffectRecipient } from './actions'
import type { AbilityDefinitionIssue, AbilityActivation, AbilityMode } from './combat-definition'
import { ABILITY_DEFINITION_BUDGET, validateAbilityElementalCompanions } from './combat-definition'
import { ABILITY_REQUIREMENT_BUDGET } from './combat-requirements'
import {
  validateCombatActionDefinition,
  validateCombatDamageFacingModifiers,
} from './combat-authoring-validation'
import { validateGameplayEffectMetadata, combatEffectPresentationTags } from './gameplay-tags'
import {
  validateCurrentBleedEffect,
  validateCurrentBurnEffect,
  validateCurrentPoisonEffect,
} from './combat-dots'
import { validateBarrierEffect } from './combat-barrier'
import { validateCombatDamageScaling } from './damage-scaling'
import { validateDamageModifiers } from './damage-modifiers'
import {
  validateSummonProfileDefinition,
  type SummonProfileDefinition,
  type CombatSummonEffect,
} from './summon-content'

/** Native legacy payloads remain authoritative; canonical percentages use basis points. */
export type CombatTagPayload =
  | Exclude<CombatEffectDefinition, { type: 'damage' | 'percentage-recovery' }>
  | Omit<Extract<CombatEffectDefinition, { type: 'damage' }>, 'piercing' | 'shattersBarrier'>
  | (Omit<
      Extract<CombatEffectDefinition, { type: 'damage' }>,
      'type' | 'piercing' | 'shattersBarrier' | 'vengeance'
    > & { readonly type: 'pierce'; readonly armorIgnoredBasisPoints: number })
  | (Omit<Extract<CombatEffectDefinition, { type: 'percentage-recovery' }>, 'percent'> & {
      readonly percentageBasisPoints: number
    })
  | {
      readonly type: 'move'
      readonly recipient: 'actor'
      readonly maximumTiles: number
    }
  | {
      readonly type: 'damage-bonus'
      readonly recipient: 'actor'
      readonly multiplierBasisPoints: number
    }
  | {
      readonly type: 'summon'
      readonly recipient: 'selected-tile'
      readonly profile: SummonProfileDefinition
    }

export interface CombatTagDefinition {
  readonly id: CombatTagPayload['type']
  readonly payloadFields: readonly string[]
  readonly units: Readonly<
    Record<
      string,
      'power' | 'basis-points' | 'tiles' | 'turns' | 'applications' | 'resource' | 'identity'
    >
  >
  readonly recipients: readonly string[]
  readonly combinations: readonly {
    readonly activation: AbilityActivation
    readonly mode: AbilityMode
  }[]
  readonly timing: readonly ('instant' | 'next-round' | 'delayed' | 'controlled')[]
  readonly stacking: 'native-policy' | 'source-owned'
  /** Existing kernel authority, not a callable plugin name supplied by content. */
  readonly handler: 'combat-action' | 'damage-modifiers' | 'combat-summons' | 'combat-movement'
  readonly runtimeCapability:
    | 'canonical-routing-required'
    | 'maintained-source-resolver-required'
    | 'equipment-armor-boundary-required'
  readonly conciseExplanation: string
  readonly fullExplanation: string
}

const UNIT_RECIPIENTS = ['actor', 'primary-unit', 'affected-units'] as const
const nativeFields = ['target', 'durationTurns', 'power', 'potencyBasisPoints']
const packetModifierCombinations = Object.freeze([
  { activation: 'manual', mode: 'action' },
  { activation: 'automatic', mode: 'action' },
  { activation: 'manual', mode: 'modifier' },
  { activation: 'automatic', mode: 'modifier' },
] as const)
const nativeUnits = {
  durationTurns: 'turns',
  power: 'power',
  potencyBasisPoints: 'basis-points',
} as const
function tag(
  id: CombatTagPayload['type'],
  fields: readonly string[],
  units: CombatTagDefinition['units'],
  explanation: string,
  options: Partial<CombatTagDefinition> = {},
): CombatTagDefinition {
  return Object.freeze({
    id,
    payloadFields: Object.freeze(['type', 'recipient', ...nativeFields, ...fields]),
    units: Object.freeze({ ...nativeUnits, ...units }),
    recipients: UNIT_RECIPIENTS,
    combinations: Object.freeze([
      { activation: 'manual', mode: 'action' },
      { activation: 'automatic', mode: 'action' },
    ] as const),
    timing: Object.freeze(['instant', 'next-round', 'delayed', 'controlled'] as const),
    stacking: 'native-policy',
    handler: 'combat-action',
    runtimeCapability: 'canonical-routing-required',
    conciseExplanation: explanation,
    fullExplanation: explanation,
    ...options,
  })
}

export const COMBAT_TAG_REGISTRY: readonly CombatTagDefinition[] = Object.freeze([
  tag(
    'move',
    ['maximumTiles'],
    { maximumTiles: 'tiles' },
    "Walk across legal Ground tiles before follow-up effects, as part of the skill's overall cost and using the position actually reached.",
    {
      payloadFields: ['type', 'recipient', 'maximumTiles'],
      recipients: ['actor'],
      combinations: [{ activation: 'manual', mode: 'action' }],
      timing: ['instant'],
      handler: 'combat-movement',
    },
  ),
  tag(
    'damage',
    ['amount', 'defenseKind', 'element', 'scaling', 'vengeance', 'facingModifiersBasisPoints'],
    { amount: 'power' },
    'Deal authored power through the existing scaling, defense and damage pipeline.',
    { combinations: packetModifierCombinations },
  ),
  tag(
    'pierce',
    [
      'amount',
      'defenseKind',
      'element',
      'scaling',
      'facingModifiersBasisPoints',
      'armorIgnoredBasisPoints',
    ],
    { amount: 'power', armorIgnoredBasisPoints: 'basis-points' },
    'Deal power and ignore the configured percentage of explicit equipment Armor only. Without equipment Armor this bypass provides no advantage.',
    {
      runtimeCapability: 'equipment-armor-boundary-required',
      combinations: packetModifierCombinations,
    },
  ),
  tag(
    'healing',
    ['amount', 'ticks'],
    { amount: 'power', ticks: 'applications' },
    'Recover HP through existing healing modifiers and caps; never revive.',
  ),
  tag(
    'percentage-recovery',
    ['resource', 'percentageBasisPoints', 'ticks'],
    { percentageBasisPoints: 'basis-points', ticks: 'applications', resource: 'resource' },
    'Capture a percentage of maximum HP or MP once for one to four recovery applications.',
  ),
  tag(
    'resource-change',
    ['resource', 'delta', 'ticks'],
    { delta: 'resource', ticks: 'applications' },
    'Restore or drain MP using the existing resource handler.',
  ),
  tag(
    'apply-status',
    ['statusId', 'stacks', 'blindsideModifiersBasisPoints'],
    { statusId: 'identity', stacks: 'applications' },
    'Apply a supported status with its captured magnitude, timing and native stacking policy.',
    { combinations: packetModifierCombinations },
  ),
  tag(
    'remove-status',
    ['statusIds', 'removalMode'],
    { statusIds: 'identity', removalMode: 'identity' },
    'Remove only the explicitly named supported statuses.',
    { combinations: packetModifierCombinations },
  ),
  tag(
    'return-to-turn-start',
    ['anchorMode'],
    {},
    'Return the actor to its captured Rewind anchor subject to ordinary movement legality.',
    { recipients: ['actor'], combinations: [{ activation: 'manual', mode: 'action' }] },
  ),
  tag(
    'create-terrain',
    ['terrain'],
    {},
    'Create Frozen Ground on the affected tiles with existing terrain lifetime rules.',
    { recipients: ['affected-tiles'], combinations: [{ activation: 'manual', mode: 'action' }] },
  ),
  tag(
    'displace',
    ['direction', 'distance'],
    { distance: 'tiles' },
    'Push or Pull another unit across legal traversed tiles.',
    {
      recipients: ['primary-unit', 'affected-units'],
      combinations: [{ activation: 'manual', mode: 'action' }],
    },
  ),
  tag(
    'poison',
    ['curseCopyable', 'damageProfile'],
    {},
    'Apply Poison with its captured damage profile and historical or pinned trigger policy.',
  ),
  tag(
    'burn',
    ['curseCopyable', 'damageProfile', 'backlashBasisPoints'],
    { backlashBasisPoints: 'basis-points' },
    'Apply Burn with its captured damage profile, decay and authored outgoing damage backlash.',
  ),
  tag(
    'bleed',
    ['curseCopyable', 'damageProfile', 'ticks', 'damagePerTick'],
    { ticks: 'turns', damagePerTick: 'power' },
    'Apply an independent Bleed application with its captured tick profile.',
  ),
  tag(
    'barrier-change',
    ['amount', 'basis'],
    { amount: 'power' },
    'Gain temporary protection that absorbs damage before HP. Pierce breaks it.',
  ),
  tag(
    'copy-statuses',
    ['mode', 'allowNoEligibleEffects'],
    {},
    'Copy Buffs or Copy Debuffs using the existing copy-first, single-unit eligibility and provenance rules.',
    { recipients: ['primary-unit'], combinations: [{ activation: 'manual', mode: 'action' }] },
  ),
  tag(
    'sensory',
    ['revealedDurationOwnerTurnStarts'],
    { revealedDurationOwnerTurnStarts: 'turns' },
    'Reveal a selected unit through the existing Covert/Sensory authority.',
    { recipients: ['primary-unit'], combinations: [{ activation: 'manual', mode: 'action' }] },
  ),
  tag(
    'summon',
    ['profile'],
    {},
    'Spawn a real allied summon from a validated immutable profile on a legal empty selected tile.',
    {
      payloadFields: ['type', 'recipient', 'profile'],
      recipients: ['selected-tile'],
      handler: 'combat-summons',
      combinations: [{ activation: 'manual', mode: 'action' }],
    },
  ),
  tag(
    'damage-bonus',
    ['multiplierBasisPoints'],
    { multiplierBasisPoints: 'basis-points' },
    'Manual modifies the selected Attack for this command and its prepaid packets. Ongoing maintains an owner outgoing damage bonus while its Requirements hold. Each captured source owns its contribution.',
    {
      payloadFields: ['type', 'recipient', 'multiplierBasisPoints'],
      recipients: ['actor'],
      handler: 'damage-modifiers',
      stacking: 'source-owned',
      runtimeCapability: 'maintained-source-resolver-required',
      combinations: [
        { activation: 'manual', mode: 'modifier' },
        { activation: 'ongoing', mode: 'modifier' },
      ],
      timing: ['instant'],
    },
  ),
])

const registry = new Map(COMBAT_TAG_REGISTRY.map((definition) => [definition.id, definition]))
const supportedStatuses = new Set(SUPPORTED_COMBAT_STATUS_IDS)
export function combatTagDefinition(id: string): CombatTagDefinition | null {
  return registry.get(id as CombatTagPayload['type']) ?? null
}

export function validateCombatTagPayload(
  value: unknown,
  combination?: { readonly activation: AbilityActivation; readonly mode: AbilityMode },
): readonly AbilityDefinitionIssue[] {
  const issues: AbilityDefinitionIssue[] = []
  function issue(path: string, code: AbilityDefinitionIssue['code'], message: string) {
    issues.push({ path, code, message })
  }
  if (!isRecord(value))
    return [{ path: 'payload', code: 'invalid-payload', message: 'Tag payload must be an object.' }]
  const definition = typeof value.type === 'string' ? combatTagDefinition(value.type) : null
  if (!definition)
    return [
      { path: 'payload.type', code: 'unsupported-tag', message: 'Unsupported combat Tag handler.' },
    ]
  for (const key of Object.keys(value))
    if (!definition.payloadFields.includes(key))
      issue(`payload.${key}`, 'unknown-key', 'Unknown mechanical payload key.')
  if (!definition.recipients.includes(value.recipient as string))
    issue('payload.recipient', 'unsupported-recipient', 'This Tag does not support that recipient.')
  if (
    combination &&
    !definition.combinations.some(
      (entry) => entry.activation === combination.activation && entry.mode === combination.mode,
    )
  )
    issue(
      'payload',
      'unsupported-combination',
      'This Tag does not support the activation/mode combination.',
    )
  if (
    combination?.mode === 'modifier' &&
    ((value.type === 'apply-status' &&
      !['frozen', 'wet', 'conductive'].includes(value.statusId as string)) ||
      (value.type === 'remove-status' &&
        (value.recipient !== 'actor' ||
          !Array.isArray(value.statusIds) ||
          value.statusIds.length !== 1 ||
          value.statusIds[0] !== 'frozen')))
  )
    issue(
      'payload',
      'unsupported-combination',
      'Packet modifiers permit only required elemental companion statuses or actor Cleanse Chilled.',
    )
  function keys(row: unknown, allowed: readonly string[], path: string): void {
    if (!isRecord(row)) {
      issue(path, 'invalid-payload', 'Expected a typed object.')
      return
    }
    for (const key of Object.keys(row))
      if (!allowed.includes(key))
        issue(`${path}.${key}`, 'unknown-key', 'Unknown nested mechanical key.')
  }
  for (const [key, allowed] of [
    ['scaling', ['source', 'coefficientBasisPoints']],
    ['vengeance', ['conversionBasisPoints', 'minimumDamage', 'maximumDamage']],
    ['facingModifiersBasisPoints', ['front', 'side', 'rear']],
    ['blindsideModifiersBasisPoints', ['side', 'rear']],
    ['damageProfile', ['kind', 'basisPoints', 'decayBasisPointsPerTick']],
  ] as const)
    if (value[key] !== undefined) keys(value[key], allowed, `payload.${key}`)
  try {
    validateCombatEffectTarget(value as unknown as Parameters<typeof validateCombatEffectTarget>[0])
    if (
      value.power !== undefined &&
      !['apply-status', 'poison', 'burn'].includes(value.type as string)
    )
      throw new TypeError('This Tag does not implement an additional power field.')
    if (value.potencyBasisPoints !== undefined && value.type !== 'apply-status')
      throw new TypeError('Only status effects implement percentage potency.')
    if (value.type === 'sensory')
      integer(value.revealedDurationOwnerTurnStarts, 1, 4, 'Sensory duration')
    if (
      value.type === 'copy-statuses' &&
      (!['amplify', 'curse'].includes(value.mode as string) ||
        (value.allowNoEligibleEffects !== undefined &&
          typeof value.allowNoEligibleEffects !== 'boolean'))
    )
      throw new TypeError('Copy requires Amplify/Curse and a boolean no-op permission.')
    if (
      value.type === 'return-to-turn-start' &&
      value.anchorMode !== undefined &&
      value.anchorMode !== 'cast-position'
    )
      throw new TypeError('Rewind supports only its captured cast-position anchor.')
    if (value.type === 'move') {
      integer(value.maximumTiles, 1, 20, 'Move maximum entered tiles')
      return issues
    }
    if (value.type === 'damage-bonus') {
      integer(value.multiplierBasisPoints, 10000, 15000, 'Damage bonus multiplier')
      validateDamageModifiers([
        {
          direction: 'outgoing',
          multiplierBasisPoints: value.multiplierBasisPoints,
          condition: { kind: 'always' },
        },
      ])
      return issues
    }
    if (value.type === 'summon') {
      const errors = validateSummonProfileDefinition(value.profile as SummonProfileDefinition)
      if (errors.length > 0) throw new TypeError(`Invalid summon profile: ${errors.join(', ')}.`)
      const profile = value.profile as SummonProfileDefinition
      keys(
        profile,
        [
          'schemaVersion',
          'id',
          'name',
          'description',
          'flavorLine',
          'portraitKey',
          'tags',
          'maxHp',
          'maxMp',
          'initiative',
          'movementBudget',
          'stats',
          'aiProfile',
          'aiPurposeTags',
          'lifetimeTurns',
          'abilities',
        ],
        'payload.profile',
      )
      keys(
        profile.stats,
        ['accuracy', 'evasion', 'armor', 'ward', 'jump', 'physicalPower', 'mysticPower'],
        'payload.profile.stats',
      )
      for (const [index, ability] of profile.abilities.entries()) {
        const path = `payload.profile.abilities[${index}]`
        keys(
          ability,
          [
            'id',
            'name',
            'description',
            'battleText',
            'presentation',
            'apCost',
            'mpCost',
            'tags',
            'target',
            'requirements',
            'effects',
            'ai',
            'media',
          ],
          path,
        )
        keys(ability.ai, ['baseUtility', 'purposeTags'], `${path}.ai`)
        keys(
          ability.media,
          ['iconKey', 'audioCueKey', 'vfxKey', 'artwork', 'audio'],
          `${path}.media`,
        )
        keys(
          ability.target,
          [
            'geometryVersion',
            'kind',
            'teamPolicy',
            'shape',
            'minimumRange',
            'maximumRange',
            'requiresLineOfSight',
            'maximumElevationDifference',
            'friendlyFire',
          ],
          `${path}.target`,
        )
        keys(
          ability.target.shape,
          ability.target.shape.kind === 'line'
            ? ['kind', 'length']
            : ability.target.shape.kind === 'circle'
              ? ['kind', 'radius']
              : ['kind'],
          `${path}.target.shape`,
        )
        if (
          !Array.isArray(ability.requirements) ||
          ability.requirements.length > ABILITY_REQUIREMENT_BUDGET.maximumNodes ||
          ability.effects.length > ABILITY_DEFINITION_BUDGET.maximumEffectsPerBehavior
        )
          throw new TypeError(
            'Summon mechanics exceed the shared finite Requirements/effect budgets.',
          )
        for (const [ordinal, requirement] of ability.requirements.entries())
          keys(
            requirement,
            requirement.kind === 'actor-hp-at-most'
              ? ['kind', 'basisPoints']
              : 'statusId' in requirement
                ? ['kind', 'statusId']
                : ['kind', 'tag'],
            `${path}.requirements[${ordinal}]`,
          )
        for (const [ordinal, effect] of ability.effects.entries()) {
          if (['summon', 'damage-bonus', 'pierce'].includes(effect.type as string))
            throw new TypeError('Nested summon actions require a native implemented unit effect.')
          const payload =
            effect.type === 'percentage-recovery'
              ? (({ percent, ...recovery }) => ({
                  ...recovery,
                  percentageBasisPoints: percent * 100,
                }))(effect)
              : effect
          for (const error of validateCombatTagPayload(payload))
            issues.push({ ...error, path: `${path}.effects[${ordinal}].${error.path}` })
        }
        issues.push(
          ...validateAbilityElementalCompanions(
            ability.effects.map((payload) => ({ payload })),
            path,
          ),
        )
        validateCombatActionDefinition({
          id: ability.id,
          version: 1,
          sourceType: 'discipline-skill',
          tags: ability.tags,
          target: ability.target,
          cost: { mp: ability.mpCost, spendsAction: true },
          requirements: ability.requirements,
          effects: ability.effects,
        })
      }
      return issues
    }
    if (value.type === 'damage' || value.type === 'pierce') {
      integer(value.amount, value.vengeance === undefined ? 1 : 0, 20, 'Damage power')
      if (value.power !== undefined || value.potencyBasisPoints !== undefined)
        throw new TypeError('Damage uses amount, not duplicate power or potency.')
      if (
        value.defenseKind !== undefined &&
        !['armor', 'ward'].includes(value.defenseKind as string)
      )
        throw new TypeError('Unknown Physical/Mystic Defense kind.')
      if (
        value.scaling !== undefined &&
        validateCombatDamageScaling(value.scaling as never).length > 0
      )
        throw new TypeError('Invalid damage scaling.')
      if (value.type === 'pierce') integer(value.armorIgnoredBasisPoints, 0, 10000, 'Armor ignored')
      if (value.facingModifiersBasisPoints !== undefined)
        validateCombatDamageFacingModifiers(
          value.facingModifiersBasisPoints as NonNullable<
            Extract<CombatEffectDefinition, { type: 'damage' }>['facingModifiersBasisPoints']
          >,
        )
    }
    if (
      value.type === 'healing' ||
      (value.type === 'barrier-change' && value.basis !== 'maximum-hp-percent')
    )
      integer(value.amount, 1, 20, 'Authored power')
    if (value.type === 'barrier-change' && value.basis === 'maximum-hp-percent')
      integer(value.amount, 1, 100, 'Barrier percentage')
    if (value.type === 'resource-change') {
      if (value.resource !== 'mp') throw new TypeError('Only MP changes are implemented.')
      integer(value.delta, -20, 20, 'MP change')
    }
    if (value.type === 'percentage-recovery') {
      integer(value.percentageBasisPoints, 100, 10000, 'Recovery percentage')
      // The real handler currently authors whole percentages, unlike Suppress/DoT precision.
      if ((value.percentageBasisPoints as number) % 100 !== 0)
        throw new TypeError('Recovery requires whole percentage increments (100 basis points).')
    }
    if (value.type === 'apply-status') {
      if (!supportedStatuses.has(value.statusId as string))
        throw new TypeError('Unsupported status handler.')
      if (value.statusId === 'revealed')
        throw new TypeError('Revealed may only be applied by Sensory.')
      integer(value.stacks, 1, Number.MAX_SAFE_INTEGER, 'Status stacks')
    }
    if (value.type === 'remove-status') {
      if (value.removalMode !== undefined && value.removalMode !== 'specified')
        throw new TypeError('Unsupported status removal mode.')
      if (
        !Array.isArray(value.statusIds) ||
        value.statusIds.length < 1 ||
        value.statusIds.length > 16 ||
        new Set(value.statusIds).size !== value.statusIds.length ||
        value.statusIds.some((id) => !supportedStatuses.has(id))
      )
        throw new TypeError('Removal requires 1–16 distinct supported status IDs.')
    }
    const native = nativeCombatTagPayload(value as CombatTagPayload)
    validateGameplayEffectMetadata(native)
    validateBarrierEffect(native)
    if (native.type === 'poison') validateCurrentPoisonEffect(native)
    if (native.type === 'burn') validateCurrentBurnEffect(native)
    if (native.type === 'bleed') validateCurrentBleedEffect(native)
  } catch (error) {
    issue(
      'payload',
      'invalid-payload',
      error instanceof Error ? error.message : 'Invalid combat Tag payload.',
    )
  }
  return issues
}

/** Authoring validation adapter only. Execution must handle Pierce's equipment boundary first. */
export function nativeCombatTagPayload(
  payload: Exclude<CombatTagPayload, { type: 'damage-bonus' | 'summon' }> | CombatTagPayload,
): CombatEffectDefinition {
  if (payload.type === 'summon' || payload.type === 'damage-bonus' || payload.type === 'move')
    throw new TypeError('Tag requires its specialized canonical resolver.')
  if (payload.type === 'pierce') {
    const { armorIgnoredBasisPoints: _ignored, ...damage } = payload
    void _ignored
    return { ...damage, type: 'damage', shattersBarrier: true }
  }
  if (payload.type === 'percentage-recovery') {
    const { percentageBasisPoints, ...recovery } = payload
    return { ...recovery, percent: percentageBasisPoints / 100 }
  }
  return payload
}

/** Only this explicit nonnegative contribution is equipment Armor. Internal armor/ward are Defense. */
export function equipmentArmorAfterPierce(
  contribution: {
    readonly equipmentArmor?: number
    readonly armor?: number
    readonly ward?: number
  },
  armorIgnoredBasisPoints: number,
): number {
  const amount = contribution.equipmentArmor ?? 0
  integer(amount, 0, Number.MAX_SAFE_INTEGER, 'Equipment Armor contribution')
  integer(armorIgnoredBasisPoints, 0, 10000, 'Armor ignored')
  return amount - Number((BigInt(amount) * BigInt(armorIgnoredBasisPoints)) / 10000n)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function integer(
  value: unknown,
  minimum: number,
  maximum: number,
  field: string,
): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum)
    throw new RangeError(`${field} must be an integer between ${minimum} and ${maximum}.`)
}
export type CombatTagUnitRecipient = CombatEffectRecipient
export function combatTagPayloadExplanation(payload: CombatTagPayload): {
  readonly concise: string
  readonly full: string
} {
  const definition = combatTagDefinition(payload.type)
  if (!definition || validateCombatTagPayload(payload).length > 0)
    throw new TypeError('Unsupported combat Tag explanation.')
  const concise =
    payload.type === 'move'
      ? `Move · Maximum Tiles [${payload.maximumTiles}]`
      : payload.type === 'damage-bonus'
        ? `Damage Up [${(payload.multiplierBasisPoints - 10000) / 100}%]`
        : payload.type === 'pierce'
          ? `Pierce [${payload.amount}] · Armor Ignored [${payload.armorIgnoredBasisPoints / 100}%]`
          : payload.type === 'summon'
            ? 'Summon'
            : combatEffectPresentationTags(nativeCombatTagPayload(payload)).join(' · ')
  return { concise, full: definition.fullExplanation }
}

/** Versioned wording attached to a canonical Tag. Handler, units and compatibility remain above. */
export interface CombatTagPresentationSnapshot {
  readonly contentKey: string
  readonly contentVersion: number
  readonly tagId: string
  readonly name: string
  readonly full: string
  readonly compact: string
}
export function combatEffectTagPresentation(
  presentations: readonly CombatTagPresentationSnapshot[] | undefined,
  payload: CombatTagPayload | CombatEffectDefinition | CombatSummonEffect,
): CombatTagPresentationSnapshot | undefined {
  // Older mixed abilities captured a distinct bonus row alongside their timed buff row.
  if (payload.type === 'damage-bonus') {
    const historical = presentations?.find((row) => row.tagId === 'damage-bonus')
    if (historical) return historical
  }
  return (
    presentations?.find((row) => row.tagId === combatEffectPresentationId(payload)) ??
    presentations?.find((row) => row.tagId === payload.type)
  )
}
/** Resolve captured templates without modifying the historical snapshot or the payload. */
export function resolvedCombatEffectTagPresentation(
  presentations: readonly CombatTagPresentationSnapshot[] | undefined,
  payload: CombatTagPayload | CombatEffectDefinition | CombatSummonEffect,
  generatedDescription: string,
): CombatTagPresentationSnapshot | undefined {
  const captured = combatEffectTagPresentation(presentations, payload)
  if (!captured) return undefined
  const generated = { details: generatedDescription, summary: generatedDescription }
  return {
    ...captured,
    full: renderCombatTagWording(captured.full, generated),
    compact: renderCombatTagWording(captured.compact, generated),
  }
}

export function combatTagPresentationIssues(value: unknown): readonly string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > COMBAT_PRESENTATION_TAG_IDS.length)
    return ['tagPresentation']
  const seen = new Set<string>()
  return value.flatMap((row, index) => {
    const path = `tagPresentation.${index}`
    if (
      !isRecord(row) ||
      Object.keys(row).length !== 6 ||
      Object.keys(row).some(
        (key) =>
          !['contentKey', 'contentVersion', 'tagId', 'name', 'full', 'compact'].includes(key),
      ) ||
      typeof row.tagId !== 'string' ||
      !isCombatPresentationTagId(row.tagId) ||
      row.contentKey !== `tag.${row.tagId}` ||
      !Number.isSafeInteger(row.contentVersion) ||
      Number(row.contentVersion) < 1 ||
      seen.has(row.tagId)
    )
      return [path]
    seen.add(row.tagId)
    return (['name', 'full', 'compact'] as const).some((key) => {
      const text = row[key]
      return (
        typeof text !== 'string' ||
        text !== text.trim() ||
        !text ||
        text.length > { name: 120, full: 2000, compact: 240 }[key] ||
        !combatTagWordingIsValid(text, key) ||
        [...text].some(
          (c) =>
            (c.charCodeAt(0) < 32 && !(key === 'full' && c === '\n')) || c.charCodeAt(0) === 127,
        )
      )
    })
      ? [path]
      : []
  })
}
export function captureCombatTagPresentation(row: {
  id: string
  contentVersion: number
  tagId: string
  name: string
  description: string
  explanation: string
}): CombatTagPresentationSnapshot {
  const snapshot = {
    contentKey: row.id,
    contentVersion: row.contentVersion,
    tagId: row.tagId,
    name: currentCombatTagName(row.tagId, row.name),
    full: row.explanation,
    compact: row.description,
  }
  if (combatTagPresentationIssues([snapshot]).length)
    throw new TypeError('Invalid canonical Tag presentation.')
  return Object.freeze(snapshot)
}
/** Current catalogue binding is presentation-only and copies every mechanics value unchanged. */
export function bindCombatTagPresentations<T>(
  value: T,
  presentations: readonly CombatTagPresentationSnapshot[],
): T {
  function visit(input: unknown): unknown {
    if (Array.isArray(input)) return input.map(visit)
    if (!isRecord(input)) return input
    const result = Object.fromEntries(
      Object.entries(input).map(([key, child]) => [key, visit(child)]),
    )
    // Native definitions keep their authoritative payload shape. Essence embeds a Skill;
    // Resonance retains its trigger packets. Do not bind native shadow fields of an ability.
    const native =
      !Object.hasOwn(input, 'ability') &&
      typeof input.id === 'string' &&
      Number.isSafeInteger(input.contentVersion)
    const nativeEffects = native
      ? Array.isArray(input.effects)
        ? input.effects
        : isRecord(input.trigger) && Array.isArray(input.trigger.resultEffects)
          ? input.trigger.resultEffects
          : isRecord(input.trigger) && Array.isArray(input.trigger.payoffEffects)
            ? input.trigger.payoffEffects
            : undefined
      : undefined
    const payloads = Array.isArray(input.behaviors)
      ? input.behaviors.flatMap((group) =>
          isRecord(group) && Array.isArray(group.effects)
            ? group.effects.flatMap((effect) =>
                isRecord(effect) && isRecord(effect.payload) ? [effect.payload] : [],
              )
            : [],
        )
      : nativeEffects
    if (payloads) {
      const ids = new Set(
        payloads.flatMap((payload) =>
          isRecord(payload) && typeof payload.type === 'string'
            ? [payload.type, combatEffectPresentationId(payload as unknown as CombatTagPayload)]
            : [],
        ),
      )
      const hasCurrentDamageUp =
        ids.has('inspired') && presentations.some((row) => row.tagId === 'inspired')
      const selected = presentations.filter(
        (row) => ids.has(row.tagId) && !(hasCurrentDamageUp && row.tagId === 'damage-bonus'),
      )
      if (selected.length || Object.hasOwn(result, 'tagPresentation'))
        result.tagPresentation = selected.map((row) => ({ ...row }))
    }
    return result
  }
  return visit(value) as T
}
