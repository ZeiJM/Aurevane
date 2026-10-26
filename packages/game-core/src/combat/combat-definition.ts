import {
  isSimpleRequirement,
  simpleRequirementSubjects,
  simpleEffectRequirementSubjects,
  simpleAutomaticTargetSubjects,
  SIMPLE_AUTOMATIC_TRIGGER_OPTIONS,
  type SimpleAutomaticTriggerId,
} from './combat-simple-requirements'
import {
  combatEffectTimingMode,
  currentCombatEffectTimingTag,
  type CombatEffectTimingPolicy,
} from './combat-effect-timing'
import { automaticAbilityEventSupported } from './combat-ability-events'
import {
  validateCombatGroundAreaDefinition,
  type CombatGroundAreaDefinition,
} from './combat-ground-areas'
import type { CombatTargetSpec } from './actions'
import { validateCombatActionDefinition } from './combat-authoring-validation'
import { canonicalAbilityTargetSpec, combatTargetAllowsHostileHit } from './combat-targeting-shapes'
import { validateSkillCooldownDefinition, type SkillCooldownDefinition } from './skill-cooldowns'
import {
  validateAbilityRequirements,
  isBeforeActionModifierRequirement,
  hasUnanchoredAutomaticStateRequirement,
  type RequirementNode,
  type AbilityResource,
  type AbilityClassification,
  type AbilityAttackFamily,
  type AbilityRequirementSubject,
} from './combat-requirements'
import {
  combatTagPresentationIssues,
  type CombatTagPresentationSnapshot,
  validateCombatTagPayload,
  nativeCombatTagPayload,
  combatTagDefinition,
  type CombatTagPayload,
} from './combat-tag-registry'

export type { RequirementNode, AbilityRequirementContext } from './combat-requirements'
export type AutomaticAbilityTargetSubject = 'owner' | 'triggering' | 'selected' | 'affected'
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
  readonly timing?: 'instant' | 'next-round' | 'delayed' | 'controlled'
}
export interface AbilityGroundAreaDefinition extends Omit<
  CombatGroundAreaDefinition,
  'entryEffectOrdinals'
> {
  /** Stable group-local IDs survive reordering and specialized packet routing. */
  readonly entryEffectIds: readonly string[]
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
  readonly requirementMode?: 'simple'
  readonly automaticTrigger?: SimpleAutomaticTriggerId
  readonly targeting: AbilityTargeting | null
  readonly effects: readonly AbilityEffect[]
  readonly groundArea?: AbilityGroundAreaDefinition
  /** Private authoring; public projections must recursively omit this and accuracyRule. */
  readonly accuracy?: CombatAccuracyRule
  readonly automaticTarget?: { readonly subject: AutomaticAbilityTargetSubject }
  readonly activationLimits?: readonly AbilityActivationLimit[]
}
export interface AbilityDefinition {
  readonly tagPresentation?: readonly CombatTagPresentationSnapshot[]
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
    | 'invalid-ground-area'
    | 'invalid-requirement'
    | 'requirement-budget'
    | 'invalid-accuracy'
    | 'invalid-activation-limit'
    | 'accuracy-inapplicable'
    | 'unsupported-tag'
    | 'unsupported-recipient'
    | 'unsupported-combination'
    | 'automatic-modifier-before-action-required'
    | 'invalid-automatic-target'
    | 'automatic-target-required'
    | 'automatic-state-anchor-required'
    | 'automatic-event-unsupported'
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
  keys(value, ['schemaVersion', 'behaviors', 'tagPresentation'], '')
  for (const path of combatTagPresentationIssues(value.tagPresentation))
    issue(path, 'invalid-definition', 'Choose exact presentation from an implemented Tag.')
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
        'requirementMode',
        'automaticTrigger',
        'targeting',
        'effects',
        'accuracy',
        'activationLimits',
        'automaticTarget',
        'groundArea',
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
    if (candidate.requirementMode !== undefined && candidate.requirementMode !== 'simple')
      issue(`${path}.requirementMode`, 'invalid-requirement', 'Unknown Requirement profile.')
    if (
      candidate.requirementMode === 'simple' &&
      !isSimpleRequirement(candidate.requirements as RequirementNode | null)
    )
      issue(
        `${path}.requirements`,
        'invalid-requirement',
        'Simple Requirements require None or one registered positive status, Primed or strict HP/MP percentage predicate.',
      )
    if (
      candidate.requirementMode === 'simple' &&
      record(candidate.requirements) &&
      'subject' in candidate.requirements &&
      !simpleRequirementSubjects(candidate as unknown as AbilityBehavior).includes(
        candidate.requirements.subject as AbilityRequirementSubject,
      )
    )
      issue(
        `${path}.requirements.subject`,
        'invalid-requirement',
        'Requirement Target must use the genuine subject of this execution path.',
      )
    if (
      candidate.automaticTrigger !== undefined &&
      ((candidate.requirementMode !== 'simple' &&
        candidate.automaticTrigger !== 'requirements-met') ||
        candidate.activation !== 'automatic' ||
        candidate.mode !== 'action' ||
        !SIMPLE_AUTOMATIC_TRIGGER_OPTIONS.some(({ id }) => id === candidate.automaticTrigger))
    )
      issue(
        `${path}.automaticTrigger`,
        'automatic-event-unsupported',
        'A predefined execution trigger requires a Simple Automatic action.',
      )
    if (
      candidate.activation === 'automatic' &&
      candidate.mode === 'modifier' &&
      candidate.requirementMode !== 'simple' &&
      validateAbilityRequirements(candidate.requirements).length === 0 &&
      !isBeforeActionModifierRequirement(candidate.requirements as RequirementNode | null)
    )
      issue(
        `${path}.requirements`,
        'automatic-modifier-before-action-required',
        'Automatic modifiers require an action qualifier or combat_action_used/before in every satisfying branch; crossing and other event hooks are unsupported.',
      )
    if (
      candidate.activation === 'automatic' &&
      candidate.mode === 'action' &&
      validateAbilityRequirements(candidate.requirements).length === 0
    ) {
      const requirement = candidate.requirements as RequirementNode | null
      const readiness = candidate.automaticTrigger === 'requirements-met'
      if (
        hasUnanchoredAutomaticStateRequirement(requirement) &&
        !(candidate.requirementMode === 'simple' && candidate.automaticTrigger !== undefined) &&
        candidate.automaticTrigger !== 'requirements-met'
      )
        issue(
          `${path}.requirements`,
          'automatic-state-anchor-required',
          'Nonowner state branches require an actual event anchor.',
        )
      function checkEvents(node: RequirementNode): void {
        if (node.kind === 'all' || node.kind === 'any') node.children.forEach(checkEvents)
        else if (
          readiness &&
          ['event', 'action', 'resource-threshold-crossing', 'resource-change'].includes(node.kind)
        )
          issue(
            `${path}.requirements`,
            'invalid-requirement',
            'Readiness requires current state predicates; event pulses use their authored event activation.',
          )
        else if (
          node.kind === 'event' &&
          !automaticAbilityEventSupported(node.eventType, node.phase)
        )
          issue(
            `${path}.requirements`,
            'automatic-event-unsupported',
            'This Automatic event/phase has no supported mutation handler.',
          )
      }
      if (requirement) checkEvents(requirement)
    }
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
            'categories',
          ],
          `${path}.targeting`,
        )
        if (
          target.geometryVersion !== undefined &&
          target.geometryVersion !== 2 &&
          target.geometryVersion !== 3
        )
          issue(
            `${path}.targeting.geometryVersion`,
            'invalid-targeting',
            'Canonical geometry supports versions 2 and 3.',
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
    if (Object.hasOwn(candidate, 'automaticTarget')) {
      const binding = candidate.automaticTarget
      if (
        !record(binding) ||
        !['owner', 'triggering', 'selected', 'affected'].includes(binding.subject as string) ||
        candidate.activation !== 'automatic' ||
        candidate.mode !== 'action' ||
        !record(target) ||
        !['self', 'unit', 'ground-tile', 'empty-tile'].includes(target.kind as string) ||
        !record(target.shape) ||
        !['single', 'line'].includes(target.shape.kind as string) ||
        (target.kind === 'self' && binding.subject !== 'owner')
      )
        issue(
          `${path}.automaticTarget`,
          'invalid-automatic-target',
          'Automatic single/Line actions bind a causal subject; Self binds owner; Circle/All use owner activation.',
        )
      if (
        candidate.requirementMode === 'simple' &&
        record(binding) &&
        !simpleAutomaticTargetSubjects(candidate as unknown as AbilityBehavior).includes(
          binding.subject as AbilityRequirementSubject,
        )
      )
        issue(
          `${path}.automaticTarget`,
          'invalid-automatic-target',
          'Automatic target must bind an available native role compatible with its authored target geometry.',
        )
      if (record(binding)) keys(binding, ['subject'], `${path}.automaticTarget`)
    } else if (
      candidate.activation === 'automatic' &&
      candidate.mode === 'action' &&
      record(target) &&
      target.kind !== 'self' &&
      record(target.shape) &&
      ['single', 'line'].includes(target.shape.kind as string)
    )
      issue(
        `${path}.automaticTarget`,
        'automatic-target-required',
        'Automatic single-unit actions require an explicit causal subject.',
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
        !combatTargetAllowsHostileHit(target as unknown as CombatTargetSpec) ||
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
      if (effect.requirements !== undefined) {
        requirements(effect.requirements, `${effectPath}.requirements`)
        if (
          candidate.requirementMode === 'simple' &&
          !isSimpleRequirement(effect.requirements as RequirementNode | null)
        )
          issue(
            `${effectPath}.requirements`,
            'invalid-requirement',
            'Simple effect Requirements require None or one supported predicate.',
          )
      }
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
      if (
        candidate.requirementMode === 'simple' &&
        record(effect.requirements) &&
        !simpleEffectRequirementSubjects(candidate as unknown as AbilityBehavior, payload).includes(
          effect.requirements.subject as AbilityRequirementSubject,
        )
      )
        issue(
          `${effectPath}.requirements.subject`,
          'invalid-requirement',
          'Effect Requirements must use the supported Self/Target role for this recipient and geometry.',
        )
      const tag = combatTagDefinition(payload.type)!
      if (effect.timing !== undefined && !tag.timing.includes(effect.timing as never))
        issue(
          `${effectPath}.timing`,
          'unsupported-combination',
          'This Tag does not support that timing.',
        )
      if (
        effect.timing === 'controlled' &&
        (candidate.activation !== 'manual' || candidate.mode !== 'action')
      )
        issue(
          `${effectPath}.timing`,
          'unsupported-combination',
          'Controlled requires a player-released whole Manual action.',
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
    if (Object.hasOwn(candidate, 'groundArea')) {
      const ground = candidate.groundArea
      const groundPath = `${path}.groundArea`
      if (record(ground))
        keys(ground, ['durationRounds', 'visualPresetId', 'entryEffectIds', 'timing'], groundPath)
      try {
        if (
          !record(ground) ||
          candidate.mode !== 'action' ||
          !record(target) ||
          (target.categories !== undefined &&
            (!Array.isArray(target.categories) ||
              target.categories.some((category) => category !== 'ground'))) ||
          candidate.effects.some((effect) => record(effect) && effect.timing === 'controlled') ||
          !allEffectsValid ||
          !Array.isArray(ground.entryEffectIds) ||
          ground.entryEffectIds.length === 0 ||
          new Set(ground.entryEffectIds).size !== ground.entryEffectIds.length ||
          ground.entryEffectIds.some((id) => typeof id !== 'string')
        )
          throw new TypeError(
            'Persistent areas require Ground-only action targeting and distinct supported effect IDs; Controlled areas are unsupported.',
          )
        const entryEffectIds = ground.entryEffectIds
        const nativeEffects = candidate.effects.filter(
          (effect) =>
            record(effect) &&
            record(effect.payload) &&
            !['move', 'summon', 'damage-bonus'].includes(effect.payload.type as string),
        ) as unknown as AbilityEffect[]
        if (
          nativeEffects.some(
            (effect) => entryEffectIds.includes(effect.id) && effect.payload.type === 'pierce',
          )
        )
          throw new TypeError(
            'Pierce requires its specialized equipment Armor resolver and cannot repeat on Ground entry.',
          )
        validateCombatGroundAreaDefinition({
          target: canonicalAbilityTargetSpec(target as unknown as CombatTargetSpec),
          effects: nativeEffects.map((effect) => nativeCombatTagPayload(effect.payload)),
          groundArea: {
            durationRounds: ground.durationRounds as number,
            visualPresetId: ground.visualPresetId as CombatGroundAreaDefinition['visualPresetId'],
            entryEffectOrdinals: entryEffectIds.map((id) =>
              nativeEffects.findIndex((effect) => effect.id === id),
            ),
            ...(Object.hasOwn(ground, 'timing')
              ? { timing: ground.timing as CombatGroundAreaDefinition['timing'] }
              : {}),
          },
        })
      } catch (error) {
        issue(
          groundPath,
          'invalid-ground-area',
          error instanceof Error ? error.message : 'Invalid persistent Ground area.',
        )
      }
    }
    if (
      candidate.effects.some((effect) => record(effect) && effect.timing === 'controlled') &&
      payloads.some((payload) => payload.type === 'summon')
    )
      issue(
        path,
        'unsupported-combination',
        'Controlled Summon requires its dedicated release authority.',
      )
    if (
      candidate.effects.some((effect) => record(effect) && effect.timing === 'controlled') &&
      payloads.some(
        (payload) =>
          payload.type === 'return-to-turn-start' && payload.anchorMode !== 'cast-position',
      )
    )
      issue(
        path,
        'unsupported-combination',
        'Controlled Rewind requires a captured cast-position anchor.',
      )
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
        validateCombatActionDefinition({
          id: typeof candidate.id === 'string' ? candidate.id : 'invalid',
          version: 1,
          sourceType: 'discipline-skill',
          tags: [],
          target: canonicalAbilityTargetSpec(target as unknown as CombatTargetSpec),
          cost: { spendsAction: true, mp: 0 },
          requirements: [],
          effects: payloads
            .filter(
              (payload) =>
                payload.type !== 'summon' &&
                payload.type !== 'damage-bonus' &&
                payload.type !== 'move',
            )
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
    const moves = payloads.filter((payload) => payload.type === 'move')
    if (
      moves.length &&
      (moves.length !== 1 ||
        payloads[0]?.type !== 'move' ||
        payloads.some((payload) => payload.type === 'summon'))
    )
      issue(
        path,
        'unsupported-combination',
        'Move must occur once, first, and cannot share a group with Summon.',
      )
    const summons = payloads.filter((payload) => payload.type === 'summon')
    if (
      summons.length > 0 &&
      record(target) &&
      (target.maximumSelections !== 1 || !record(target.shape) || target.shape.kind !== 'single')
    )
      issue(path, 'unsupported-combination', 'Summon requires one single empty-tile selection.')
    if (summons.length > 0 && payloads.at(-1)?.type !== 'summon')
      issue(
        path,
        'unsupported-combination',
        'Summon must be the final effect in its Manual action group.',
      )
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

/** Resolve current global authority or historical defaults without mutating captured definitions. */
export function applyAbilityTimingDefaults(
  behavior: AbilityBehavior,
  policy?: CombatEffectTimingPolicy,
): AbilityBehavior {
  if (
    !policy ||
    (policy.tagAuthority !== 'global' && !Object.values(policy.modes).includes('controlled'))
  )
    return behavior
  const effects = behavior.effects.map((effect) => {
    if (
      (policy.tagAuthority !== 'global' && effect.timing !== undefined) ||
      effect.payload.type === 'move' ||
      effect.payload.type === 'damage-bonus'
    )
      return effect
    const tag =
      effect.payload.type === 'summon'
        ? 'summon'
        : currentCombatEffectTimingTag(nativeCombatTagPayload(effect.payload))
    const timing = combatEffectTimingMode(policy, tag)
    return (policy.tagAuthority === 'global' || timing === 'controlled') && effect.timing !== timing
      ? { ...effect, timing }
      : effect
  })
  const activationLimits =
    policy.tagAuthority === 'global' && behavior.activationLimits?.includes('once-per-battle')
      ? behavior.activationLimits.filter((limit) => limit !== 'once-per-battle')
      : behavior.activationLimits
  const groundArea =
    policy.tagAuthority === 'global' && behavior.groundArea
      ? { ...behavior.groundArea, timing: combatEffectTimingMode(policy, 'ground-area') }
      : behavior.groundArea
  if (
    effects.every((effect, ordinal) => effect === behavior.effects[ordinal]) &&
    activationLimits === behavior.activationLimits &&
    groundArea === behavior.groundArea
  )
    return behavior
  return parseAbilityDefinition({
    schemaVersion: 1,
    behaviors: [
      {
        ...behavior,
        effects,
        ...(activationLimits ? { activationLimits } : {}),
        ...(groundArea ? { groundArea } : {}),
      },
    ],
  }).behaviors[0]!
}
