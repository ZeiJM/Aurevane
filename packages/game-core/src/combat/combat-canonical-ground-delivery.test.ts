import { expect, it } from 'vitest'
import type { CombatTargetSelection, CombatEncounterState } from './actions'
import { validateCombatEncounterState } from './actions'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { reattachStatDrivenCombatBridge } from './stat-driven-combat'
import { source } from './combat-behavior.test-utils'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import {
  reconcileCombatAbilitySources,
  combatAbilityCommandContext,
} from './combat-behavior-runtime'
import { prepareCombatAbilityCommand, commitCombatAbilityCommand } from './combat-ability-command'
import { PV1F_COMBAT_CONTENT, preparePv1fTurnEconomy, finishPv1fTurn } from './pv1f-action-economy'
import {
  createCombatAbilityEventSession,
  captureCombatAbilityMutation,
  processCombatAbilityEvent,
} from './combat-ability-events'

const ground: CombatTargetSelection = { kind: 'tile', position: { x: 2, y: 1 } }
const unit: CombatTargetSelection = { kind: 'unit', combatantId: 'enemy' }
const mixed: CombatTargetSelection = {
  kind: 'selections',
  selections: [ground, { kind: 'unit', combatantId: 'other' }],
}
function damageIds(events: readonly unknown[]): string[] {
  return events.flatMap((event) => {
    if (
      !event ||
      typeof event !== 'object' ||
      !('event' in event) ||
      event.event !== 'damage_applied' ||
      !('amount' in event) ||
      typeof event.amount !== 'number' ||
      event.amount <= 0 ||
      !('targetCombatantId' in event) ||
      typeof event.targetCombatantId !== 'string'
    )
      return []
    return [event.targetCombatantId]
  })
}
function flying<T extends CombatEncounterState>(state: T): T {
  return {
    ...state,
    statusState: state.statusState.map((row) =>
      ['enemy', 'other'].includes(row.combatantId)
        ? {
            ...row,
            statuses: [
              {
                statusId: 'airborne',
                statusVersion: 1,
                stacks: 1,
                remainingOwnerTurnStarts: 2,
                sourceCombatantId: 'actor',
              },
            ],
          }
        : row,
    ),
  }
}
function command(
  selection: CombatTargetSelection,
  timing: 'instant' | 'next-round' = 'instant',
  airborne = true,
) {
  const captured = captureCombatAbilitySource(
    source({
      targeting: {
        ...source().definition.behaviors[0]!.targeting!,
        geometryVersion: 3,
        categories: ['enemy', 'ground'],
        maximumSelections: 3,
      },
      accuracy: { kind: 'fixed', chanceBasisPoints: 10000 },
      effects: [
        { id: 'hit', timing, payload: { type: 'damage', recipient: 'affected-units', amount: 10 } },
      ],
    }),
  )
  const base = {
    ...preparePv1fTurnEconomy(percentageDotEncounter()),
    airbornePolicyVersion: 1 as const,
  }
  const state = reconcileCombatAbilitySources(airborne ? flying(base) : base, [captured])
  return {
    state,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source: captured },
    selection,
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, captured),
  }
}
it.each([
  [ground, []],
  [unit, ['enemy']],
  [mixed, ['other']],
  [{ kind: 'selections', selections: [ground, unit] }, ['enemy']],
] as const)(
  'preserves instant Ground versus direct unit delivery for %j with one payment',
  (selection, hitIds) => {
    const input = command(selection)
    expect(prepareCombatAbilityCommand(input).evaluation.legal).toBe(true)
    const cast = commitCombatAbilityCommand(input)
    expect(
      cast.events.flatMap((e) =>
        e.event === 'damage_applied' && e.amount > 0 ? [e.targetCombatantId] : [],
      ),
    ).toEqual(hitIds)
    const actor = cast.state.tactical.battle.combatants.find((u) => u.id === 'actor')!
    expect(actor.mp).toBe(18)
    expect(actor.hp).toBe(999)
    expect(actor.temporaryResources.find((r) => r.key === 'pv1f.action-economy')!.current).toBe(89)
  },
)
it.each([
  [ground, []],
  [unit, ['enemy']],
  [mixed, ['other']],
] as const)(
  'retains %j delivery after JSON storage and late Airborne activation',
  (selection, hitIds) => {
    const cast = commitCombatAbilityCommand(command(selection, 'next-round', false))
    expect(cast.events.some((e) => e.event === 'damage_applied')).toBe(false)
    let next = reattachStatDrivenCombatBridge(
      flying(JSON.parse(JSON.stringify(cast.state)) as CombatEncounterState),
      percentageDotEncounter().statBridge,
    )
    expect(validateCombatEncounterState(next)).toEqual([])
    const events: unknown[] = []
    for (let i = 0; i < 4; i++) {
      const advanced = finishPv1fTurn(next, 'west')
      next = advanced.state
      events.push(...advanced.events)
    }
    expect(next.tactical.battle.round).toBe(2)
    expect(damageIds(events)).toEqual(hitIds)
    expect(next.tactical.battle.combatants.find((u) => u.id === 'actor')!.mp).toBe(18)
    expect(next.tactical.battle.combatants.find((u) => u.id === 'actor')!.hp).toBe(999)
  },
)
it('rejects forged pending Ground delivery identities and preserves absent-policy history', () => {
  const captured = commitCombatAbilityCommand(command(ground, 'next-round', false)).state
  expect(captured.pendingEffects![0]!.groundTargetedRecipientIds).toEqual(['enemy'])
  for (const ids of [['enemy', 'enemy'], ['absent'], ['actor'], [42], 'enemy']) {
    const invalid = JSON.parse(JSON.stringify(captured))
    invalid.pendingEffects[0].groundTargetedRecipientIds = ids
    expect(
      validateCombatEncounterState(invalid).some((issue) => issue.field === 'pendingEffects'),
    ).toBe(true)
  }
  for (const patch of [
    { airbornePolicyVersion: undefined },
    { pendingEffects: [{ ...captured.pendingEffects![0]!, groundTargeted: true as const }] },
  ]) {
    expect(
      validateCombatEncounterState({ ...captured, ...patch }).some(
        (issue) => issue.field === 'pendingEffects',
      ),
    ).toBe(true)
  }
  const input = command(ground)
  const state = { ...input.state, airbornePolicyVersion: undefined }
  const legacy = commitCombatAbilityCommand({
    ...input,
    state,
    context: combatAbilityCommandContext(state, input.root.source),
  })
  expect(
    legacy.events.flatMap((e) =>
      e.event === 'damage_applied' && e.amount > 0 ? [e.targetCombatantId] : [],
    ),
  ).toEqual(['enemy'])
})
it('derives Ground area delivery from the out-of-turn Automatic owner, not the current actor', () => {
  const captured = captureCombatAbilitySource({
    ...source({
      activation: 'automatic',
      automaticTarget: { subject: 'triggering' },
      costs: [{ resource: 'mp', amount: 1 }],
      requirements: { kind: 'event', eventType: 'healing_applied', phase: 'after' },
      targeting: {
        ...source().definition.behaviors[0]!.targeting!,
        geometryVersion: 3,
        kind: 'ground-tile',
        categories: ['ground'],
        shape: { kind: 'line', length: 2 },
        minimumRange: 0,
        maximumRange: 2,
      },
      effects: [
        { id: 'hit', payload: { type: 'damage', recipient: 'affected-units', amount: 10 } },
      ],
    }),
    ownerCombatantId: 'other',
  })
  const base = { ...percentageDotEncounter(), airbornePolicyVersion: 1 as const }
  const state = reconcileCombatAbilitySources(
    {
      ...base,
      statusState: base.statusState.map((row) =>
        row.combatantId === 'actor'
          ? {
              ...row,
              statuses: [
                {
                  statusId: 'airborne',
                  statusVersion: 1,
                  stacks: 1,
                  remainingOwnerTurnStarts: 2,
                  sourceCombatantId: 'actor',
                },
              ],
            }
          : row,
      ),
    },
    [captured],
  )
  const context = combatAbilityCommandContext(state, captured)
  const session = createCombatAbilityEventSession(context.triggerGuard)
  const mutation = captureCombatAbilityMutation(state, state, 'automatic-ground', session, {
    events: [{ type: 'healing_applied', phase: 'after' }],
    triggeringCombatantId: 'actor',
    affectedCombatantIds: ['actor'],
    resourceMutations: [],
  })
  const out = processCombatAbilityEvent(
    mutation.state,
    mutation.frame,
    PV1F_COMBAT_CONTENT,
    context,
    session,
    0,
    commitCombatAbilityCommand,
  )
  expect(
    out.events.some((e) => e.event === 'damage_applied' && e.targetCombatantId === 'actor'),
  ).toBe(false)
  expect(out.events).toContainEqual(
    expect.objectContaining({
      event: 'combat_accuracy_resolved',
      targetCombatantId: 'actor',
      hit: false,
      hitChanceBasisPoints: 0,
    }),
  )
  expect(out.state.tactical.battle.combatants.find((u) => u.id === 'other')!.mp).toBe(19)
})

it.each([{ kind: 'line', length: 3 }, { kind: 'circle', radius: 3 }, { kind: 'all' }] as const)(
  'preserves Ground-only area admission for %j across envelope aliases and delayed storage',
  (shape) => {
    for (const kind of ['unit', 'ground-tile'] as const) {
      for (const timing of ['instant', 'next-round'] as const) {
        const captured = captureCombatAbilitySource(
          source({
            targeting: {
              ...source().definition.behaviors[0]!.targeting!,
              geometryVersion: 3,
              categories: ['enemy', 'ground'],
              friendlyFire: 'all-units',
              kind,
              shape,
              minimumRange: 0,
              maximumRange: shape.kind === 'all' ? 0 : 3,
            },
            effects: [
              {
                id: 'hit',
                timing,
                payload: { type: 'damage', recipient: 'affected-units', amount: 10 },
              },
            ],
          }),
        )
        const base = {
          ...preparePv1fTurnEconomy(percentageDotEncounter()),
          airbornePolicyVersion: 1 as const,
        }
        const state = reconcileCombatAbilitySources(
          {
            ...base,
            tactical: {
              ...base.tactical,
              placements: base.tactical.placements.map((p) => ({
                ...p,
                position:
                  p.combatantId === 'ally'
                    ? { x: 2, y: 1 }
                    : p.combatantId === 'enemy'
                      ? { x: 3, y: 1 }
                      : p.combatantId === 'other'
                        ? { x: 4, y: 1 }
                        : p.position,
              })),
            },
            statusState: base.statusState.map((row) =>
              timing === 'instant' && ['ally', 'enemy'].includes(row.combatantId)
                ? {
                    ...row,
                    statuses: [
                      {
                        statusId: 'airborne',
                        statusVersion: 1,
                        stacks: 1,
                        remainingOwnerTurnStarts: 2,
                        sourceCombatantId: 'actor',
                      },
                    ],
                  }
                : row,
            ),
          },
          [captured],
        )
        const selection: CombatTargetSelection =
          shape.kind === 'line' ? { kind: 'direction', direction: 'east' } : { kind: 'activate' }
        const input = {
          state,
          actorId: 'actor',
          root: { kind: 'canonical' as const, source: captured },
          selection,
          content: PV1F_COMBAT_CONTENT,
          context: combatAbilityCommandContext(state, captured),
        }
        expect(prepareCombatAbilityCommand(input).evaluation.affectedCombatantIds).toEqual([
          'ally',
          'enemy',
          'other',
        ])
        const cast = commitCombatAbilityCommand(input)
        const events: unknown[] = [...cast.events]
        let next = reattachStatDrivenCombatBridge(
          JSON.parse(JSON.stringify(cast.state)) as CombatEncounterState,
          base.statBridge,
        )
        if (timing === 'next-round') {
          next = {
            ...next,
            statusState: next.statusState.map((row) =>
              ['ally', 'enemy'].includes(row.combatantId)
                ? {
                    ...row,
                    statuses: [
                      {
                        statusId: 'airborne',
                        statusVersion: 1,
                        stacks: 1,
                        remainingOwnerTurnStarts: 2,
                        sourceCombatantId: 'actor',
                      },
                    ],
                  }
                : row,
            ),
          }
          expect(next.pendingEffects![0]!.groundTargetedRecipientIds).toEqual(['ally'])
          for (let turn = 0; turn < 4; turn++) {
            const advanced = finishPv1fTurn(next, 'west')
            next = advanced.state
            events.push(...advanced.events)
          }
        }
        expect(damageIds(events)).toEqual(['enemy', 'other'])
        expect(next.tactical.battle.combatants.find((unit) => unit.id === 'ally')!.hp).toBe(1000)
        expect(next.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.mp).toBe(18)
        expect(next.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.hp).toBe(999)
      }
    }
  },
)
