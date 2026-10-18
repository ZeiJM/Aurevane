import { expect } from 'vitest'
import { commitCombatAbilityCommand, prepareCombatAbilityCommand } from './combat-ability-command'
import { readFileSync } from 'node:fs'
import type { AbilityDefinition } from './combat-definition'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from './combat-behavior-runtime'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import {
  reattachStatDrivenCombatBridge,
  createCurrentStatDrivenCombatEncounterState,
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'
import { PV1F_COMBAT_CONTENT, preparePv1fTurnEconomy, finishPv1fTurn } from './pv1f-action-economy'
import type { CombatEncounterState, CombatTargetSelection, CombatActionIssueCode } from './actions'
import type { MatureSkillDefinition } from './mature-skills'

interface Candidate {
  kind: 'skill' | 'essence' | 'resonance' | 'basic'
  id: string
  after: Partial<MatureSkillDefinition> & {
    contentVersion: number
    sourceDisciplineId?: string
    ability?: AbilityDefinition
    tags?: string[]
    skill?: { tags: string[] }
  }
}
const rows: Candidate[] = JSON.parse(
  readFileSync(
    new URL(
      '../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
      import.meta.url,
    ),
    'utf8',
  ),
).records
export function captured(id: string) {
  const row = rows.find((r) => r.id === id)!
  if (!row.after.ability) throw new Error(`Missing proposed canonical Ability for ${id}.`)
  return captureCombatAbilitySource({
    schemaVersion: 1,
    sourceInstanceId: id,
    ownerCombatantId: 'actor',
    abilityId: id,
    contentVersion: row.after.contentVersion,
    sourceKind: row.kind === 'skill' ? 'discipline-skill' : row.kind,
    sourceDisciplineId: row.after.sourceDisciplineId,
    tags: row.after.tags ?? row.after.skill?.tags ?? [],
    definition: row.after.ability,
  })
}
export function pair(a: string, b: string) {
  return rows.find(
    (r) => r.kind === 'resonance' && r.id.startsWith(`resonance.${[a, b].sort().join('-')}.`),
  )!.id
}
export function fixture(ids: string[]) {
  const raw = percentageDotEncounter()
  const state = preparePv1fTurnEconomy(
    createCurrentStatDrivenCombatEncounterState(
      {
        ...raw,
        statBalancePolicyVersion: 1,
        duelBalancePolicyVersion: 1,
        elementalDamagePolicyVersion: 2,
        skillPacketPolicyVersion: 1,
        effectTimingPolicy: { version: 1, modes: {} },
      },
      raw.statBridge.combatants.map((p) => ({
        ...p,
        physicalPower: 20,
        mysticPower: 20,
        level: 1,
        accuracy: 14000,
        criticalChance: 0,
        statusResistance: 0,
      })),
    ),
  )
  return reattachStatDrivenCombatBridge(
    reconcileCombatAbilitySources(state, ids.map(captured)),
    state.statBridge,
  )
}
export function input(
  state: CombatEncounterState,
  id: string,
  selection: CombatTargetSelection = { kind: 'unit', combatantId: 'enemy' },
  behaviorId?: string,
) {
  const root = captured(id)
  return {
    state,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source: root, behaviorId },
    selection,
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, root),
  }
}
export function unit(state: CombatEncounterState, id = 'actor') {
  return state.tactical.battle.combatants.find((u) => u.id === id)!
}
export function ap(state: CombatEncounterState) {
  return unit(state).temporaryResources.find((r) => r.key === 'pv1f.action-economy')?.current
}

export function give<T extends CombatEncounterState>(state: T, statusId: string, id = 'enemy') {
  const definition = PV1F_COMBAT_CONTENT.statuses.find((s) => s.id === statusId)!
  state.statusState = state.statusState.map((r) =>
    r.combatantId !== id
      ? r
      : {
          ...r,
          statuses: [
            ...r.statuses,
            {
              statusId,
              statusVersion: definition.version,
              stacks: 1,
              remainingOwnerTurnStarts: 2,
              sourceCombatantId: 'actor',
              ...(statusId === 'suppress' ? { potencyBasisPoints: 2500 } : {}),
              ...(statusId === 'mark' ? { sourceScopedMark: true } : {}),
            },
          ],
        },
  )
  return state
}
export function damage(events: readonly unknown[]) {
  return events.flatMap((e) =>
    typeof e === 'object' &&
    e !== null &&
    'event' in e &&
    e.event === 'damage_applied' &&
    'amount' in e &&
    typeof e.amount === 'number'
      ? [e.amount]
      : [],
  )
}
export function hasStatus(state: CombatEncounterState, statusId: string, id = 'actor') {
  return (
    state.statusState
      .find((r) => r.combatantId === id)
      ?.statuses.some((s) => s.statusId === statusId) ?? false
  )
}

export function commitRosterCommand(command: Parameters<typeof commitCombatAbilityCommand>[0]) {
  const before = JSON.stringify(command.state)
  const quote = prepareCombatAbilityCommand(command)
  expect(quote.evaluation.legal, JSON.stringify(quote.evaluation)).toBe(true)
  expect(JSON.stringify(command.state)).toBe(before)
  const result = commitCombatAbilityCommand(command)
  expect(JSON.stringify(command.state)).toBe(before)
  const root = command.root
  if (root.kind !== 'canonical') throw new Error('These roster cases use canonical commands.')
  expect(
    result.state.capturedAbilitySources?.find(
      (row) => row.sourceInstanceId === root.source.sourceInstanceId,
    )?.definition,
  ).toEqual(root.source.definition)
  return { ...result, state: restoreRosterEncounter(result.state) }
}
export function rejectRosterCommand(
  command: Parameters<typeof prepareCombatAbilityCommand>[0],
  expected?: { code: CombatActionIssueCode; message?: string },
) {
  const before = JSON.stringify(command.state)
  const quote = prepareCombatAbilityCommand(command)
  expect(quote.evaluation.legal).toBe(false)
  if (expected) expect(quote.evaluation.issues).toEqual([expect.objectContaining(expected)])
  expect(JSON.stringify(command.state)).toBe(before)
}
export function restoreRosterEncounter(
  state: CombatEncounterState,
): StatDrivenCombatEncounterState {
  const saved = JSON.parse(JSON.stringify(state)) as StatDrivenCombatEncounterState
  expect(validateStatDrivenCombatEncounterState(saved)).toEqual([])
  return saved
}
export function advanceRosterTurns(state: CombatEncounterState, turns: number) {
  let live = restoreRosterEncounter(state)
  for (let i = 0; i < turns; i++) live = finishPv1fTurn(live, 'east').state
  return live
}
