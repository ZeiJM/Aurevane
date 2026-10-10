import type { CombatTargetSpec } from './actions'
import { validateCombatActionDefinition } from './combat-authoring-validation'
import { validateSkillCooldownDefinition, type SkillCooldownDefinition } from './skill-cooldowns'
import {
  validateAbilityRequirements,
  isBeforeActionModifierRequirement,
  type RequirementNode,
  type AbilityResource,
  type AbilityClassification,
  type AbilityAttackFamily,
} from './combat-requirements'
import {
  validateCombatTagPayload,
  nativeCombatTagPayload,
  combatTagDefinition,
  type CombatTagPayload,
} from './combat-tag-registry'

export type { RequirementNode, AbilityRequirementContext } from './combat-requirements'
export type AbilityActivation = 'manual' | 'automatic' | 'ongoing'
export type AbilityMode = 'action' | 'modifier'
export type AbilityActivationLimit =
  'once-per-action' | 'once-per-owner-turn' | 'once-per-round' | 'once-per-battle'
export type CombatAccuracyRule =
  { readonly kind: 'standard' } | { readonly kind: 'fixed'; readonly chanceBasisPoints: number }

/** Finite authoring limits: 16 groups × 32 ordered effects = 512 top-level packets per definition. */
export const ABILITY_DEFINITION_BUDGET = Object.freeze({
  maximumBehaviors: 16,
  maximumEffectsPerBehavior: 32,
  maximumSelections: 16,
})

export interface AbilityTargeting extends CombatTargetSpec {
  readonly maximumSelections: number
}
export type AbilitySelection =
  | { readonly kind: 'self' | 'all' | 'none' }
  | { readonly kind: 'units'; readonly combatantIds: readonly string[] }
  | {
      readonly kind: 'tiles'
      readonly positions: readonly { readonly x: number; readonly y: number }[]
    }
  | { readonly kind: 'direction'; readonly direction: 'north' | 'east' | 'south' | 'west' }

export interface AbilityEffect {
  readonly id: string
  /** Recipient belongs solely to this implemented payload, never to this wrapper. */
  readonly payload: CombatTagPayload
  readonly requirements?: RequirementNode | null
  readonly timing?: 'instant' | 'next-round' | 'delayed'
}
export interface AbilityBehavior {
  readonly id: string
  readonly activation: AbilityActivation
  readonly mode: AbilityMode
  readonly classification: AbilityClassification
  readonly attackFamily?: AbilityAttackFamily
  readonly costs: readonly { readonly resource: AbilityResource; readonly amount: number }[]
  readonly cooldown: SkillCooldownDefinition | null
  readonly requirements: RequirementNode | null
  readonly targeting: AbilityTargeting | null
  readonly effects: readonly AbilityEffect[]
  /** Private authoring; public projections must recursively omit this and accuracyRule. */
  readonly accuracy?: CombatAccuracyRule
  readonly activationLimits?: readonly AbilityActivationLimit[]
}
export interface AbilityDefinition {
  readonly schemaVersion: 1
  readonly behaviors: readonly AbilityBehavior[]
}
export interface AbilityDefinitionIssue {
  readonly path: string
  readonly code:
    | 'invalid-definition'
    | 'unknown-key'
    | 'array-budget'
    | 'duplicate-id'
    | 'duplicate-cost'
    | 'invalid-cost'
    | 'invalid-cooldown'
    | 'invalid-targeting'
    | 'invalid-requirement'
    | 'requirement-budget'
    | 'invalid-accuracy'
    | 'invalid-activation-limit'
    | 'accuracy-inapplicable'
    | 'unsupported-tag'
    | 'unsupported-recipient'
    | 'unsupported-combination'
    | 'automatic-modifier-before-action-required'
    | 'invalid-payload'
    | 'elemental-companion'
  readonly message: string
}
export class AbilityDefinitionParseError extends TypeError {
  readonly issues: readonly AbilityDefinitionIssue[]
  constructor(issues: readonly AbilityDefinitionIssue[]) {
    super(
      `Invalid Ability definition: ${issues.map((issue) => `${issue.path} (${issue.code}): ${issue.message}`).join('; ')}`,
    )
    this.name = 'AbilityDefinitionParseError'
    this.issues = issues
  }
}

const ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u
export function parseAbilityDefinition(value: unknown): AbilityDefinition {
  const issues = validateAbilityDefinition(value)
  if (issues.length > 0) throw new AbilityDefinitionParseError(issues)
  return JSON.parse(JSON.stringify(value)) as AbilityDefinition
}

export function validateAbilityDefinition(value: unknown): readonly AbilityDefinitionIssue[] {
  const issues: AbilityDefinitionIssue[] = []
  function issue(path: string, code: AbilityDefinitionIssue['code'], message: string) {
    issues.push({ path, code, message })
  }
  function keys(row: Record<string, unknown>, allowed: readonly string[], path: string) {
    for (const key of Object.keys(row))
      if (!allowed.includes(key))
        issue(path ? `${path}.${key}` : key, 'unknown-key', 'Unknown mechanical key.')
  }
  function array(row: unknown, maximum: number, path: string): row is unknown[] {
    if (!Array.isArray(row) || row.length < 1 || row.length > maximum) {
      issue(path, 'array-budget', `Requires 1–${maximum} entries.`)
      return false
    }
    return true
  }
  function requirements(row: unknown, path: string) {
    for (const error of validateAbilityRequirements(row))
      issues.push({ ...error, path: error.path.replace(/^requirements/u, path) })
  }
  function stableId(row: unknown, path: string, seen: Set<string>) {
    if (typeof row !== 'string' || !ID.test(row)) {
      issue(path, 'invalid-definition', 'A stable lowercase ID is required.')
      return
    }
    if (seen.has(row))
      issue(path, 'duplicate-id', 'Stable IDs must be distinct within their containing array.')
    seen.add(row)
  }
  if (!record(value))
    return [{ path: 'ability', code: 'invalid-definition', message: 'Ability must be an object.' }]
  keys(value, ['schemaVersion', 'behaviors'], '')
  if (value.schemaVersion !== 1)
    issue('schemaVersion', 'invalid-definition', 'Only Ability schemaVersion 1 is supported.')
  if (!array(value.behaviors, ABILITY_DEFINITION_BUDGET.maximumBehaviors, 'behaviors'))
    return issues
  const behaviorIds = new Set<string>()
  for (const [index, candidate] of value.behaviors.entries()) {
    const path = `behaviors[${index}]`
    if (!record(candidate)) {
      issue(path, 'invalid-definition', 'Behavior must be an object.')
      continue
    }
    keys(
      candidate,
      [
        'id',
        'activation',
        'mode',
        'classification',
        'attackFamily',
        'costs',
        'cooldown',
        'requirements',
        'targeting',
        'effects',
        'accuracy',
        'activationLimits',
      ],
      path,
    )
    stableId(candidate.id, `${path}.id`, behaviorIds)
    if (Object.hasOwn(candidate, 'activationLimits')) {
      const limits = candidate.activationLimits
      if (
        !Array.isArray(limits) ||
        limits.length > 4 ||
        new Set(limits).size !== limits.length ||
        limits.some(
          (limit) =>
            ![
              'once-per-action',
              'once-per-owner-turn',
              'once-per-round',
              'once-per-battle',
            ].includes(limit),
        ) ||
        (candidate.activation === 'ongoing' && limits.length > 0)
      )
        issue(
          `${path}.activationLimits`,
          'invalid-activation-limit',
          'Activation limits require at most four distinct supported scopes; Ongoing cannot have activation limits.',
        )
    }
    if (
      !['manual', 'automatic', 'ongoing'].includes(candidate.activation as string) ||
      !['action', 'modifier'].includes(candidate.mode as string)
    )
      issue(path, 'unsupported-combination', 'Unsupported activation or mode.')
    if (!['attack', 'recovery', 'utility'].includes(candidate.classification as string))
      issue(`${path}.classification`, 'invalid-definition', 'Unsupported behavior classification.')
    if (
      candidate.classification === 'attack'
        ? !['physical', 'mystic'].includes(candidate.attackFamily as string)
        : candidate.attackFamily !== undefined
    )
      issue(
        `${path}.attackFamily`,
        'invalid-definition',
        'Only Attack requires a Physical/Mystic family.',
      )
    if (!Array.isArray(candidate.costs))
      issue(
        `${path}.costs`,
        'invalid-cost',
        'Costs require an array of at most three distinct resources.',
      )
    else {
      if (candidate.costs.length > 3)
        issue(`${path}.costs`, 'invalid-cost', 'Costs require at most three distinct resources.')
      const costResources = new Set<string>()
      for (const [ordinal, cost] of candidate.costs.slice(0, 4).entries()) {
        const costPath = `${path}.costs[${ordinal}]`
        if (!record(cost)) {
          issue(costPath, 'invalid-cost', 'Cost must be typed.')
          continue
        }
        keys(cost, ['resource', 'amount'], costPath)
        if (!['ap', 'mp', 'hp'].includes(cost.resource as string) || !nonnegative(cost.amount))
          issue(
            costPath,
            'invalid-cost',
            'Cost requires AP/MP/HP and a nonnegative safe integer amount.',
          )
        if (costResources.has(cost.resource as string))
          issue(costPath, 'duplicate-cost', 'Each resource may occur only once.')
        costResources.add(cost.resource as string)
      }
    }
    if (candidate.cooldown !== null) {
      if (!record(candidate.cooldown))
        issue(`${path}.cooldown`, 'invalid-cooldown', 'Cooldown must be a definition or null.')
      else {
        keys(candidate.cooldown, ['key', 'ownerTurns'], `${path}.cooldown`)
        if (
          validateSkillCooldownDefinition(candidate.cooldown as unknown as SkillCooldownDefinition)
            .length > 0
        )
          issue(`${path}.cooldown`, 'invalid-cooldown', 'Invalid owner-turn cooldown.')
      }
    }
    requirements(candidate.requirements, `${path}.requirements`)
    if (
      candidate.activation === 'automatic' &&
      candidate.mode === 'modifier' &&
      validateAbilityRequirements(candidate.requirements).length === 0 &&
      !isBeforeActionModifierRequirement(candidate.requirements as RequirementNode | null)
    )
      issue(
        `${path}.requirements`,
        'automatic-modifier-before-action-required',
        'Automatic modifiers require an action qualifier or combat_action_used/before in every satisfying branch; crossing and other event hooks are unsupported.',
      )
    const target = candidate.targeting
    if (candidate.mode === 'action') {
      if (!record(target))
        issue(`${path}.targeting`, 'invalid-targeting', 'An action requires explicit targeting.')
      else {
        keys(
          target,
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
            'maximumSelections',
          ],
          `${path}.targeting`,
        )
        if (target.geometryVersion !== undefined && target.geometryVersion !== 2)
          issue(
            `${path}.targeting.geometryVersion`,
            'invalid-targeting',
            'Canonical geometry supports version 2 only.',
          )
        if (
          !nonnegative(target.maximumSelections) ||
          target.maximumSelections < 1 ||
          target.maximumSelections > ABILITY_DEFINITION_BUDGET.maximumSelections
        )
          issue(
            `${path}.targeting.maximumSelections`,
            'invalid-targeting',
            'Selections require a count from 1–16.',
          )
        if (record(target.shape)) {
          const shapeFields =
            target.shape.kind === 'line'
              ? ['kind', 'length']
              : target.shape.kind === 'circle'
                ? ['kind', 'radius']
                : ['kind']
          keys(target.shape, shapeFields, `${path}.targeting.shape`)
          if (target.shape.kind !== 'single' && target.maximumSelections !== 1)
            issue(
              `${path}.targeting.maximumSelections`,
              'invalid-targeting',
              'Area methods select one footprint.',
            )
        } else issue(`${path}.targeting.shape`, 'invalid-targeting', 'A typed shape is required.')
      }
    } else if (target !== null)
      issue(
        `${path}.targeting`,
        'unsupported-combination',
        'Modifier targeting must be null; the maintained contribution belongs to its owner.',
      )
    if (
      candidate.activation === 'ongoing' &&
      (candidate.mode !== 'modifier' ||
        candidate.cooldown !== null ||
        (Array.isArray(candidate.costs) &&
          candidate.costs.some((cost) => !record(cost) || cost.amount !== 0)))
    )
      issue(
        path,
        'unsupported-combination',
        'Ongoing supports only unpaid, source-owned modifiers without cooldown.',
      )
    if (candidate.accuracy !== undefined) {
      if (!validAccuracy(candidate.accuracy))
        issue(
          `${path}.accuracy`,
          'invalid-accuracy',
          'Accuracy is Standard or Fixed integer 0–10000 basis points, without legacy fields.',
        )
      if (
        !record(target) ||
        !['unit', 'ground-tile'].includes(target.kind as string) ||
        !['enemy', 'any'].includes(target.teamPolicy as string) ||
        !['enemies-only', 'all-units', 'all-except-actor'].includes(
          target.friendlyFire as string,
        ) ||
        candidate.mode !== 'action'
      )
        issue(
          `${path}.accuracy`,
          'accuracy-inapplicable',
          'Private accuracy requires an applicable hostile recipient hit check.',
        )
    }
    if (
      !array(
        candidate.effects,
        ABILITY_DEFINITION_BUDGET.maximumEffectsPerBehavior,
        `${path}.effects`,
      )
    )
      continue
    const effectIds = new Set<string>()
    const payloads: CombatTagPayload[] = []
    let allEffectsValid = true
    for (const [ordinal, effect] of candidate.effects.entries()) {
      const effectPath = `${path}.effects[${ordinal}]`
      if (!record(effect)) {
        issue(effectPath, 'invalid-payload', 'Effect must be an object.')
        allEffectsValid = false
        continue
      }
      keys(effect, ['id', 'payload', 'requirements', 'timing'], effectPath)
      stableId(effect.id, `${effectPath}.id`, effectIds)
      if (effect.requirements !== undefined)
        requirements(effect.requirements, `${effectPath}.requirements`)
      const errors = validateCombatTagPayload(effect.payload, {
        activation: candidate.activation as AbilityActivation,
        mode: candidate.mode as AbilityMode,
      })
      for (const error of errors) issues.push({ ...error, path: `${effectPath}.${error.path}` })
      if (errors.length > 0) {
        allEffectsValid = false
        continue
      }
      const payload = effect.payload as CombatTagPayload
      const tag = combatTagDefinition(payload.type)!
      if (effect.timing !== undefined && !tag.timing.includes(effect.timing as never))
        issue(
          `${effectPath}.timing`,
          'unsupported-combination',
          'This Tag does not support that timing.',
        )
      if (
        candidate.activation === 'ongoing' &&
        effect.requirements !== undefined &&
        effect.requirements !== null
      )
        issue(
          effectPath,
          'unsupported-combination',
          'Ongoing Requirements belong to the source behavior, not a conditional timed packet.',
        )
      payloads.push(payload)
    }
    if (
      candidate.accuracy !== undefined &&
      !payloads.some(
        (payload) =>
          'recipient' in payload && ['primary-unit', 'affected-units'].includes(payload.recipient),
      )
    )
      issue(
        `${path}.accuracy`,
        'accuracy-inapplicable',
        'Private accuracy requires at least one hit-dependent non-actor packet.',
      )
    if (allEffectsValid && record(target) && record(target.shape) && candidate.mode === 'action') {
      try {
        const { maximumSelections: _count, ...nativeTarget } = target
        void _count
        validateCombatActionDefinition({
          id: typeof candidate.id === 'string' ? candidate.id : 'invalid',
          version: 1,
          sourceType: 'discipline-skill',
          tags: [],
          target: { ...nativeTarget, geometryVersion: 2 } as unknown as CombatTargetSpec,
          cost: { spendsAction: true, mp: 0 },
          requirements: [],
          effects: payloads
            .filter((payload) => payload.type !== 'summon' && payload.type !== 'damage-bonus')
            .map(nativeCombatTagPayload),
        })
      } catch (error) {
        issue(
          path,
          'invalid-payload',
          error instanceof Error ? error.message : 'Invalid behavior mechanics.',
        )
      }
    }
    const summons = payloads.filter((payload) => payload.type === 'summon')
    if (candidate.mode === 'modifier') {
      for (const [ordinal, payload] of payloads.entries()) {
        if (payload.type !== 'apply-status' && payload.type !== 'remove-status') continue
        const element =
          payload.type === 'remove-status'
            ? 'fire'
            : payload.statusId === 'frozen'
              ? 'ice'
              : payload.statusId === 'wet'
                ? 'water'
                : payload.statusId === 'conductive'
                  ? 'storm'
                  : null
        if (
          !element ||
          !payloads.some(
            (hit) =>
              (hit.type === 'damage' || hit.type === 'pierce') &&
              hit.element === element &&
              (element === 'fire'
                ? payload.recipient === 'actor' &&
                  payload.type === 'remove-status' &&
                  payload.statusIds.length === 1 &&
                  payload.statusIds[0] === 'frozen'
                : hit.recipient === payload.recipient),
          )
        )
          issue(
            `${path}.effects[${ordinal}]`,
            'unsupported-combination',
            'Packet modifiers permit only explicit elemental companions associated with contributing damage.',
          )
      }
    }
    if (
      summons.length > 0 &&
      (summons.length !== 1 || !record(target) || target.kind !== 'empty-tile')
    )
      issue(
        path,
        'unsupported-combination',
        'Summon requires one spawn effect and empty-tile targeting.',
      )
    issues.push(...validateAbilityElementalCompanions(candidate.effects, path))
  }
  return issues
}

/** Task1 keeps old adapters from treating canonical presence as permission to use flat fields. */
export function assertLegacyAbilityAbsent(envelope: {
  readonly ability?: AbilityDefinition
}): void {
  if (!Object.hasOwn(envelope, 'ability')) return
  parseAbilityDefinition(envelope.ability)
  throw new TypeError(
    'canonical-activation-required: Ability definitions require the canonical activation resolver.',
  )
}

/** Shared with canonical summon payload validation; historical definitions never use this gate. */
export function validateAbilityElementalCompanions(
  effects: readonly unknown[],
  path: string,
): readonly AbilityDefinitionIssue[] {
  const issues: AbilityDefinitionIssue[] = []
  const issue = (path: string, code: AbilityDefinitionIssue['code'], message: string) =>
    issues.push({ path, code, message })
  const wrappers = effects.filter(record)
  const required = new Set<string>()
  for (const wrapper of wrappers) {
    if (!record(wrapper.payload) || !['damage', 'pierce'].includes(wrapper.payload.type as string))
      continue
    const damage = wrapper.payload
    const status =
      damage.element === 'ice'
        ? 'frozen'
        : damage.element === 'water'
          ? 'wet'
          : damage.element === 'storm'
            ? 'conductive'
            : damage.element === 'fire'
              ? 'cleanse-chilled'
              : null
    if (!status) continue
    const recipient = status === 'cleanse-chilled' ? 'actor' : damage.recipient
    const key = `${status}:${recipient}`
    if (required.has(key)) continue
    required.add(key)
    const companions = wrappers.filter((effect) => {
      if (!record(effect.payload) || effect.payload.recipient !== recipient) return false
      return status === 'cleanse-chilled'
        ? effect.payload.type === 'remove-status' &&
            Array.isArray(effect.payload.statusIds) &&
            effect.payload.statusIds.length === 1 &&
            effect.payload.statusIds[0] === 'frozen'
        : effect.payload.type === 'apply-status' && effect.payload.statusId === status
    })
    const companion = companions[0]
    if (
      companions.length !== 1 ||
      !companion ||
      (companion.requirements !== undefined && companion.requirements !== null)
    )
      issue(
        path,
        'elemental-companion',
        'Elemental damage requires exactly one unconditional explicit policy-2 companion per recipient.',
      )
    else if (
      status !== 'cleanse-chilled' &&
      record(companion.payload) &&
      (companion.payload.stacks !== 1 ||
        companion.payload.durationTurns !== 2 ||
        (status === 'frozen'
          ? companion.payload.potencyBasisPoints !== undefined
          : companion.payload.potencyBasisPoints === undefined))
    )
      issue(
        path,
        'elemental-companion',
        'Policy-2 companions require one application, two turns and the captured Storm vulnerability percentage where applicable.',
      )
  }
  return issues
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function nonnegative(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}
export function validAccuracy(value: unknown): value is CombatAccuracyRule {
  if (!record(value)) return false
  if (value.kind === 'standard') return Object.keys(value).every((key) => key === 'kind')
  return (
    value.kind === 'fixed' &&
    Object.keys(value).every((key) => ['kind', 'chanceBasisPoints'].includes(key)) &&
    nonnegative(value.chanceBasisPoints) &&
    value.chanceBasisPoints <= 10000
  )
}
