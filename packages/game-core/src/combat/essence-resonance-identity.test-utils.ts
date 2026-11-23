import { readFileSync } from 'node:fs'
import type { AbilityBehavior, AbilityDefinition } from './combat-definition'
import type { RequirementNode } from './combat-requirements'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { parseCombatEffectTimingPolicy } from './combat-effect-timing'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { preparePv1fTurnEconomy, PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import {
  reconcileCombatAbilitySources,
  primeCombatControlledAbility,
  combatAbilityCommandContext,
} from './combat-behavior-runtime'
import {
  reattachStatDrivenCombatBridge,
  createCurrentStatDrivenCombatEncounterState,
} from './stat-driven-combat'
import {
  applyCurrentPoisonState,
  applyCurrentBurnState,
  applyCurrentBleedState,
} from './combat-dots'
import { compareCombatStatusInstances } from './combat-accuracy-status'
import { give } from './roster-outcome.test-utils'
import type { CombatEncounterState } from './actions'

export type IdentityRow = {
  kind: 'skill' | 'essence' | 'resonance' | 'basic'
  id: string
  beforeVersion: number
  beforeDigest: string
  after: {
    contentVersion: number
    enabled: boolean
    name?: string
    id?: string
    essenceId?: string
    sourceDisciplineId?: string
    disciplinePair?: readonly [string, string]
    tags?: readonly string[]
    skill?: { tags: readonly string[] }
    ability: AbilityDefinition
  }
}
export function readIdentityJson(name: string) {
  return JSON.parse(
    readFileSync(
      new URL(`../../../../docs/superpowers/specs/${name}.json`, import.meta.url),
      'utf8',
    ),
  )
}
export const identityBaseline = readIdentityJson('2026-10-18-modular-correction-cohort') as {
  records: IdentityRow[]
}
export const identityCandidate = readIdentityJson(
  '2026-10-19-essence-resonance-identity-cohort',
) as {
  records: IdentityRow[]
  requiredRecordCount: number
  reviewedRecordCount: number
  previousManifestSha256: string
  designManifestSha256: string
  review: { id: string; kind: string; decision: string }[]
}
export const identityDesigns = readIdentityJson('2026-10-19-essence-resonance-designs') as {
  records: {
    id: string
    singleDiscipline?: string
    disciplinePair?: readonly [string, string]
    canonicalAbility: AbilityDefinition
    keepOrRevise: string
  }[]
}
const map = new Map(identityBaseline.records.map((row) => [row.id, row]))
for (const row of identityCandidate.records) map.set(row.id, row)
export const identityExtensions = [...map.values()].filter(
  (row) => row.kind === 'essence' || row.kind === 'resonance',
)
export const identityResonances = identityExtensions.filter((row) => row.kind === 'resonance')
export const identitySkills = identityBaseline.records.filter((row) => row.kind === 'skill')
const release = JSON.parse(
  readFileSync(
    new URL(
      '../../../../docs/verification/release-assets/2026-10-18-modular-release-control.json',
      import.meta.url,
    ),
    'utf8',
  ),
)
export const identityTimingPolicy = parseCombatEffectTimingPolicy(release.catalogue.policy)
export function requirementNodes(node: RequirementNode | null): RequirementNode[] {
  return node ? [node, ...('children' in node ? node.children.flatMap(requirementNodes) : [])] : []
}
export function witnessLeaves(node: RequirementNode | null): RequirementNode[] {
  return !node
    ? []
    : node.kind === 'all'
      ? node.children.flatMap(witnessLeaves)
      : node.kind === 'any'
        ? witnessLeaves(node.children[0]!)
        : [node]
}
export function identitySource(row: IdentityRow, ownerCombatantId = 'actor') {
  return captureCombatAbilitySource({
    schemaVersion: 1,
    sourceInstanceId: `${ownerCombatantId}:${row.id}`,
    ownerCombatantId,
    abilityId: row.id,
    contentVersion: row.after.contentVersion,
    sourceKind: row.kind === 'skill' ? 'discipline-skill' : row.kind,
    sourceDisciplineId: row.after.sourceDisciplineId,
    tags: row.after.tags ?? row.after.skill?.tags ?? [],
    definition: row.after.ability,
  })
}
export function actionFacts(row: IdentityRow, behavior: AbilityBehavior) {
  return {
    classification: behavior.classification,
    ...(behavior.attackFamily ? { attackFamily: behavior.attackFamily } : {}),
    sourceDisciplineId: row.after.sourceDisciplineId,
    tags: [
      ...(row.after.tags ?? []).filter((tag) => !['attack', 'physical', 'mystic'].includes(tag)),
      ...(behavior.classification === 'attack' ? ['attack', behavior.attackFamily!] : []),
    ],
  }
}
export function matchingActions(requirements: RequirementNode | null, pair?: readonly string[]) {
  const filters = requirementNodes(requirements).filter((node) => node.kind === 'action')
  return identitySkills
    .filter((row) => !pair || pair.includes(row.after.sourceDisciplineId!))
    .flatMap((row) =>
      row.after.ability.behaviors.flatMap((behavior) => {
        const facts = actionFacts(row, behavior)
        return filters.every(
          (node) =>
            node.kind === 'action' &&
            (!node.classification || node.classification === facts.classification) &&
            (!node.attackFamily || node.attackFamily === facts.attackFamily) &&
            (!node.sourceDisciplineId || node.sourceDisciplineId === facts.sourceDisciplineId) &&
            (!node.requiredTags || node.requiredTags.every((tag) => facts.tags.includes(tag))),
        )
          ? [{ row, behavior, facts }]
          : []
      }),
    )
}
export function identityState(sources: ReturnType<typeof identitySource>[]) {
  const base = percentageDotEncounter()
  const prepared = preparePv1fTurnEconomy(
    createCurrentStatDrivenCombatEncounterState(
      {
        ...base,
        modularSkillPolicyVersion: 1 as const,
        statBalancePolicyVersion: 1 as const,
        duelBalancePolicyVersion: 1 as const,
        elementalDamagePolicyVersion: 2 as const,
        skillPacketPolicyVersion: 1 as const,
        effectTimingPolicy: identityTimingPolicy,
      },
      base.statBridge.combatants.map((profile) => ({
        ...profile,
        physicalPower: 20,
        mysticPower: 20,
        level: 1,
        accuracy: 14000,
        criticalChance: 0,
        statusResistance: 0,
      })),
    ),
  )
  for (const unit of prepared.tactical.battle.combatants) {
    unit.maxMp = 500
    unit.mp = 250
    unit.hp = 700
  }
  return reattachStatDrivenCombatBridge(
    reconcileCombatAbilitySources(prepared, sources),
    prepared.statBridge,
  )
}
export function identityUnit(state: CombatEncounterState, id = 'actor') {
  return state.tactical.battle.combatants.find((unit) => unit.id === id)!
}
export function identityCommand(
  state: CombatEncounterState,
  source: ReturnType<typeof identitySource>,
  selection: Parameters<
    typeof import('./combat-ability-command').commitCombatAbilityCommand
  >[0]['selection'],
  behaviorId?: string,
) {
  return {
    state,
    actorId: source.ownerCombatantId,
    root: { kind: 'canonical' as const, source, behaviorId },
    selection,
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, source),
  }
}
/** Native statuses and real Controlled priming, not fabricated Requirement context values. */
export function seedWitness(
  state: CombatEncounterState,
  requirements: RequirementNode | null,
  roles: Record<'owner' | 'triggering' | 'selected' | 'affected', string>,
) {
  const leaves = witnessLeaves(requirements)
  const bounds = new Map<string, { low: number; high: number }>()
  for (const node of leaves) {
    if (node.kind === 'resource-state' || node.kind === 'resource-threshold-crossing') {
      const id = roles[node.subject],
        unit = identityUnit(state, id),
        maximum = node.resource === 'hp' ? unit.maxHp : node.resource === 'mp' ? unit.maxMp : 100
      const key = `${id}:${node.resource}`,
        interval = bounds.get(key) ?? { low: 1, high: maximum }
      if (node.kind === 'resource-state') {
        const threshold = node.amount ?? (maximum * node.basisPoints!) / 10000
        if (node.comparison === 'at-least')
          interval.low = Math.max(interval.low, Math.ceil(threshold))
        else interval.high = Math.min(interval.high, Math.floor(threshold))
      } else {
        const threshold = Math.floor((maximum * node.thresholdBasisPoints) / 10000)
        if (node.direction === 'below') interval.high = Math.min(interval.high, threshold)
        else interval.low = Math.max(interval.low, threshold + 1)
      }
      bounds.set(key, interval)
    }
  }
  for (const [key, interval] of bounds) {
    if (interval.low > interval.high) return null
    const [id, resource] = key.split(':') as [string, 'hp' | 'mp' | 'ap'],
      unit = identityUnit(state, id)
    const value = Math.floor((interval.low + interval.high) / 2)
    if (resource === 'ap')
      unit.temporaryResources = unit.temporaryResources.map((row) =>
        row.key === 'pv1f.action-economy' ? { ...row, current: value } : row,
      )
    else unit[resource] = value
  }
  for (const node of leaves)
    if (node.kind === 'status-presence' && node.present) {
      const target = roles[node.subject],
        source = target === 'actor' ? 'enemy' : 'actor'
      const captured = {
        capturedDamage: 30,
        profile: { kind: 'attack-percentage' as const, basisPoints: 1000 },
      }
      if (node.statusId === 'poison')
        state = applyCurrentPoisonState(
          state,
          source,
          target,
          'test.identity-poison',
          true,
          4,
          3,
          captured,
        )
      else if (node.statusId === 'bleed')
        state = applyCurrentBleedState(
          state,
          source,
          target,
          'test.identity-bleed',
          0,
          3,
          true,
          captured,
        )
      else if (node.statusId === 'burn')
        state = applyCurrentBurnState(
          state,
          source,
          target,
          'test.identity-burn',
          true,
          4,
          3,
          {
            capturedDamage: 30,
            profile: { kind: 'attack-percentage', basisPoints: 2000, decayBasisPointsPerTick: 500 },
          },
          1000,
        )
      else if (
        !state.statusState
          .find((row) => row.combatantId === target)!
          .statuses.some((status) => status.statusId === node.statusId)
      )
        give(state, node.statusId, target)
    }
  state.statusState = state.statusState.map((unit) => ({
    ...unit,
    statuses: [...unit.statuses].sort(compareCombatStatusInstances),
  }))
  for (const node of leaves)
    if (node.kind === 'prime-presence' && node.present) {
      const source = state.capturedAbilitySources!.find(
        (row) => row.abilityId === node.abilityId && row.ownerCombatantId === roles[node.subject],
      )
      if (!source) throw new Error(`Missing real prime source ${node.abilityId}`)
      state = primeCombatControlledAbility({
        state,
        actorId: source.ownerCombatantId,
        sourceInstanceId: source.sourceInstanceId,
        behaviorId: source.definition.behaviors[0]!.id,
      }).state
    }
  return state
}
