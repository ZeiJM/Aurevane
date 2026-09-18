import { validateCombatStatusCopyAction } from './combat-status-copy'
import { validateCombatAccuracyDefinition } from './combat-skill-accuracy'
import { validateVengeanceActionDefinition } from './combat-vengeance'
import { validateBarrierEffect } from './combat-barrier'
import { validateRecoveryEffect } from './combat-recovery'
import {
  validateCurrentBleedEffect,
  validateCurrentBurnEffect,
  validateCurrentPoisonEffect,
} from './combat-dots'
import { validateCombatEffectCategory } from './combat-effect-categories'
import { validateCombatAccuracyStatusDefinition } from './combat-accuracy-status'
import { validateCsrActionDefinition } from './covert-sensory-revealed'
import type {
  CombatActionDefinition,
  CombatContentCatalog,
  CombatStatusDefinition,
} from './actions'
import { validateCombatDamageScaling } from './damage-scaling'
import { validateDamageModifiers } from './damage-modifiers'
import { validateGameplayActionMetadata, validateGameplayTag } from './gameplay-tags'
import { validateSkillCooldownDefinition } from './skill-cooldowns'

const COMBAT_BASIS_POINTS = 10_000

export function validateCombatActionDefinition(
  action: CombatActionDefinition,
  content?: CombatContentCatalog,
): void {
  const copyEffects = action.effects.filter((effect) => effect.type === 'copy')
  if (copyEffects.length > 1) {
    throw new TypeError('A combat action may contain at most one Copy effect.')
  }
  validateCombatStatusCopyAction(action)
  validateVengeanceActionDefinition(action)
  validateCsrActionDefinition(action)
  validateGameplayActionMetadata(action)
  requiredIdentity(action.id, 'action id')
  positiveSafeInteger(action.version, 'action version')

  if (action.cooldown) {
    const cooldownIssues = validateSkillCooldownDefinition(action.cooldown)
    if (cooldownIssues.length > 0) {
      throw new TypeError(`Invalid action cooldown definition: ${cooldownIssues.join(', ')}.`)
    }
  }

  knownString(
    action.sourceType,
    ['basic-attack', 'basic-action', 'discipline-skill', 'scenario', 'test'],
    'action source type',
  )
  knownString(action.target.kind, ['self', 'unit', 'ground-tile', 'empty-tile'], 'target kind')
  knownString(action.target.teamPolicy, ['self', 'ally', 'enemy', 'any'], 'target team policy')
  knownString(
    action.target.friendlyFire,
    ['enemies-only', 'allies-only', 'all-units', 'all-except-actor'],
    'friendly-fire policy',
  )
  knownString(action.target.shape.kind, ['single', 'circle', 'line'], 'target shape kind')
  boolean(action.target.requiresLineOfSight, 'requiresLineOfSight')
  boolean(action.cost.spendsAction, 'spendsAction')
  nonNegativeSafeInteger(action.target.minimumRange, 'minimum range')
  nonNegativeSafeInteger(action.target.maximumRange, 'maximum range')
  if (action.target.minimumRange > action.target.maximumRange) {
    throw new RangeError('Action minimum range cannot exceed maximum range.')
  }
  if (action.target.maximumElevationDifference !== null) {
    nonNegativeSafeInteger(action.target.maximumElevationDifference, 'maximum elevation difference')
  }
  if (action.target.shape.kind === 'circle') {
    nonNegativeSafeInteger(action.target.shape.radius, 'circle radius')
  }
  if (action.target.shape.kind === 'line') {
    positiveSafeInteger(action.target.shape.length, 'line length')
  }
  nonNegativeSafeInteger(action.cost.mp, 'MP cost')

  validateCombatAccuracyDefinition(action)

  const tagSet = new Set<string>()
  for (const tag of action.tags) {
    requiredIdentity(tag, 'action tag')
    if (tagSet.has(tag)) throw new Error(`Duplicate action tag ${tag}.`)
    tagSet.add(tag)
  }

  for (const requirement of action.requirements) {
    knownString(
      requirement.kind,
      [
        'actor-status-present',
        'actor-status-absent',
        'target-status-present',
        'actor-hp-at-most',
        'actor-tag-present',
        'actor-tag-absent',
        'target-tag-present',
      ],
      'requirement kind',
    )
    if ('statusId' in requirement) {
      requiredIdentity(requirement.statusId, 'requirement status ID')
      if (content) statusById(content, requirement.statusId)
    }
    if ('tag' in requirement) validateGameplayTag(requirement.tag)
    if (requirement.kind === 'actor-hp-at-most') {
      basisPoints(requirement.basisPoints, 'actor HP threshold')
    }
  }

  for (const effect of action.effects) {
    validateRecoveryEffect(effect)
    validateBarrierEffect(effect)
    knownString(
      effect.type,
      [
        'damage',
        'healing',
        'resource-change',
        'apply-status',
        'remove-status',
        'return-to-turn-start',
        'create-terrain',
        'displace',
        'poison',
        'bleed',
        'burn',
        'barrier-change',
        'copy-statuses',
        'copy',
        'sensory',
      ],
      'effect type',
    )

    if (effect.type === 'create-terrain') continue

    if (effect.type === 'copy') {
      if (
        effect.recipient !== 'primary-unit' ||
        (action.target.kind !== 'unit' && action.target.kind !== 'ground-tile') ||
        action.target.teamPolicy === 'self'
      ) {
        throw new TypeError(
          'Copy requires a selected non-self unit or an occupied ground tile as its Skill source.',
        )
      }
      continue
    }

    if (effect.type === 'displace' && content) statusById(content, 'displaced')

    knownString(effect.recipient, ['actor', 'primary-unit', 'affected-units'], 'effect recipient')
    if (effect.type === 'sensory') continue

    if (effect.type === 'damage' || effect.type === 'healing') {
      nonNegativeSafeInteger(effect.amount, `${effect.type} amount`)
    }
    if (effect.type === 'poison') validateCurrentPoisonEffect(effect)
    if (effect.type === 'burn') validateCurrentBurnEffect(effect)
    if (effect.type === 'bleed') validateCurrentBleedEffect(effect)
    if (effect.type === 'damage' && effect.scaling !== undefined) {
      const scalingIssues = validateCombatDamageScaling(effect.scaling)
      if (scalingIssues.length > 0) {
        const issue = scalingIssues[0]
        throw new TypeError(`Invalid damage scaling: ${issue.field}: ${issue.message}`)
      }
    }
    if (effect.type === 'damage' && effect.defenseKind !== undefined) {
      knownString(effect.defenseKind, ['armor', 'ward'], 'damage defense kind')
    }
    if (effect.type === 'damage' && effect.facingModifiersBasisPoints) {
      basisPoints(effect.facingModifiersBasisPoints.front, 'front damage modifier', 22_000)
      basisPoints(effect.facingModifiersBasisPoints.side, 'side damage modifier', 22_000)
      basisPoints(effect.facingModifiersBasisPoints.rear, 'rear damage modifier', 22_000)
    }
    if (effect.type === 'resource-change') {
      knownString(effect.resource, ['mp'], 'effect resource')
      if (!Number.isSafeInteger(effect.delta)) {
        throw new RangeError('Resource delta must be a safe integer.')
      }
    }
    if (effect.type === 'remove-status') {
      if (
        !Array.isArray(effect.statusIds) ||
        effect.statusIds.length < 1 ||
        effect.statusIds.length > 8 ||
        new Set(effect.statusIds).size !== effect.statusIds.length
      ) {
        throw new TypeError('Status removal requires one to eight distinct IDs.')
      }
      for (const id of effect.statusIds) {
        requiredIdentity(id, 'removed status ID')
        if (content) statusById(content, id)
      }
    }
    if (
      effect.type === 'return-to-turn-start' &&
      (effect.recipient !== 'actor' || action.target.kind !== 'self')
    ) {
      throw new TypeError('Rewind is a self-only effect.')
    }
    if (effect.type === 'apply-status') {
      requiredIdentity(effect.statusId, 'effect status ID')
      positiveSafeInteger(effect.stacks, 'effect status stacks')
      if (content) statusById(content, effect.statusId)
      validateBleedAuthoring(effect)
    }
  }
}

export function validateCombatStatusDefinition(status: CombatStatusDefinition): void {
  validateCombatAccuracyStatusDefinition(status)
  requiredIdentity(status.id, 'status id')
  positiveSafeInteger(status.version, 'status version')
  positiveSafeInteger(status.maximumStacks, 'status maximum stacks')
  positiveSafeInteger(status.durationOwnerTurnStarts, 'status duration')
  basisPoints(status.damageTakenMultiplierBasisPoints, 'damage taken multiplier', 25_000)
  validateDamageModifiers(status.damageModifiers)

  if (status.polarity !== undefined) {
    knownString(status.polarity, ['positive', 'negative', 'neutral', 'mixed'], 'status polarity')
  }
  if (status.amplifyCopyable !== undefined) {
    boolean(status.amplifyCopyable, 'amplifyCopyable')
  }
  if (status.curseCopyable !== undefined) {
    boolean(status.curseCopyable, 'curseCopyable')
  }
  if (status.reactionClass !== undefined) {
    knownString(
      status.reactionClass,
      ['ordinary', 'periodic', 'reactive', 'self-cost', 'system'],
      'reaction class',
    )
  }

  if (status.absorbHpBasisPoints !== undefined) {
    boundedPositiveSafeInteger(
      status.absorbHpBasisPoints,
      1,
      COMBAT_BASIS_POINTS,
      'Absorb HP basis points',
    )
    if (status.polarity !== 'positive' || status.reactionClass !== 'reactive') {
      throw new TypeError('Absorb HP statuses must be positive and reactive.')
    }
  }

  if (status.absorbMpBasisPoints !== undefined) {
    boundedPositiveSafeInteger(
      status.absorbMpBasisPoints,
      1,
      COMBAT_BASIS_POINTS,
      'Absorb MP basis points',
    )
    if (status.polarity !== 'positive' || status.reactionClass !== 'reactive') {
      throw new TypeError('Absorb MP statuses must be positive and reactive.')
    }
  }

  if (status.reflectBasisPoints !== undefined) {
    boundedPositiveSafeInteger(
      status.reflectBasisPoints,
      1,
      COMBAT_BASIS_POINTS,
      'Reflect basis points',
    )
    if (status.polarity !== 'positive' || status.reactionClass !== 'reactive') {
      throw new TypeError('Reflect statuses must be positive and reactive.')
    }
  }

  if (status.effectCategories !== undefined) {
    if (
      !Array.isArray(status.effectCategories) ||
      status.effectCategories.length < 1 ||
      status.effectCategories.length > 16 ||
      new Set(status.effectCategories).size !== status.effectCategories.length
    ) {
      throw new TypeError('Status effect categories require one to sixteen distinct categories.')
    }
    for (const category of status.effectCategories) validateCombatEffectCategory(category)
  }

  if (status.gameplayTags !== undefined) {
    if (
      !Array.isArray(status.gameplayTags) ||
      status.gameplayTags.length > 16 ||
      new Set(status.gameplayTags).size !== status.gameplayTags.length
    ) {
      throw new TypeError('Invalid gameplay tags.')
    }
    for (const tag of status.gameplayTags) validateGameplayTag(tag)
  }

  if (status.damageModifiers?.length && status.maximumStacks !== 1) {
    throw new TypeError('Conditional damage statuses must be single-stack.')
  }

  if (
    status.nextRoundInitiative !== undefined &&
    (!Number.isSafeInteger(status.nextRoundInitiative) ||
      Math.abs(status.nextRoundInitiative) > 40 ||
      status.nextRoundInitiative === 0 ||
      status.maximumStacks !== 1 ||
      status.endOfTurn)
  ) {
    throw new RangeError(
      'Round initiative status must be single-stack, non-periodic and bounded to +/-40.',
    )
  }

  if (status.endOfTurn) {
    knownString(status.endOfTurn.type, ['damage', 'healing'], 'periodic effect')
    positiveSafeInteger(status.endOfTurn.amount, 'periodic amount')
    if (status.endOfTurn.amount > 100 || status.maximumStacks > 3) {
      throw new RangeError('Periodic status exceeds its bounded magnitude.')
    }
  }

  if (status.movement) {
    if (status.movement.blocked !== undefined && typeof status.movement.blocked !== 'boolean') {
      throw new TypeError('Invalid movement restriction.')
    }
    const ap = status.movement.additionalApPerTile ?? 0
    if (!Number.isSafeInteger(ap) || ap < -10 || ap > 20) {
      throw new RangeError('Movement AP modifier must be between -10 and 20 AP per tile.')
    }
  }
}

export function validateCombatContentCatalog(content: CombatContentCatalog): void {
  const ids = new Set<string>()
  for (const status of content.statuses) {
    validateCombatStatusDefinition(status)
    if (ids.has(status.id)) throw new Error(`Duplicate combat status definition ${status.id}.`)
    ids.add(status.id)
  }
}

function validateBleedAuthoring(effect: { statusId: string }): void {
  if (effect.statusId !== 'bleed') return
  const authored = effect as unknown as { damagePerTick?: unknown; durationTicks?: unknown }
  if (authored.damagePerTick === undefined && authored.durationTicks === undefined) return
  if (authored.damagePerTick === undefined || authored.durationTicks === undefined) {
    throw new TypeError('Bleed authoring requires damagePerTick and durationTicks together.')
  }
  positiveSafeIntegerUnknown(authored.damagePerTick, 'Bleed damage per tick')
  boundedPositiveSafeInteger(authored.durationTicks, 1, 4, 'Bleed duration ticks')
  const total = BigInt(authored.damagePerTick as number) * BigInt(authored.durationTicks as number)
  if (total > 10n) throw new RangeError('Bleed raw per-stack total must not exceed 10 damage.')
}

function statusById(content: CombatContentCatalog, statusId: string): CombatStatusDefinition {
  const status = content.statuses.find((candidate) => candidate.id === statusId)
  if (!status) throw new Error(`Unknown combat status definition ${statusId}.`)
  return status
}

function requiredIdentity(value: string, field: string): void {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    throw new TypeError(`${field} must be a non-empty trimmed string.`)
  }
}

function knownString(value: unknown, allowed: readonly string[], field: string): void {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new TypeError(`${field} is not supported.`)
  }
}

function boolean(value: unknown, field: string): void {
  if (typeof value !== 'boolean') throw new TypeError(`${field} must be a boolean.`)
}

function positiveSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${field} must be a positive safe integer.`)
  }
}

function positiveSafeIntegerUnknown(value: unknown, field: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new RangeError(`${field} must be a positive safe integer.`)
  }
}

function boundedPositiveSafeInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  field: string,
): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new RangeError(`${field} must be an integer between ${minimum} and ${maximum}.`)
  }
}

function nonNegativeSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative safe integer.`)
  }
}

function basisPoints(value: number, field: string, maximum: number = COMBAT_BASIS_POINTS): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new RangeError(`${field} must be an integer between 0 and ${maximum}.`)
  }
}
