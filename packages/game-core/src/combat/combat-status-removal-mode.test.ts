import { reattachStatDrivenCombatBridge } from './stat-driven-combat'
import { prepareCombatAbilityCommand, commitCombatAbilityCommand } from './combat-ability-command'
import {
  reconcileCombatAbilitySources,
  combatAbilityCommandContext,
} from './combat-behavior-runtime'
import { projectedCombatEffectUtility } from './recruit-ai-build'
import { expect, it } from 'vitest'
import {
  evaluateCombatAction,
  executeCombatAction,
  type CombatActionDefinition,
  type CombatEffectDefinition,
} from './actions'
import { validateCombatActionDefinition } from './combat-authoring-validation'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { PV1F_COMBAT_CONTENT, preparePv1fTurnEconomy, finishPv1fTurn } from './pv1f-action-economy'
import { combatEffectPresentationTags } from './gameplay-tags'
import { parseAbilityDefinition } from './combat-definition'
import { source } from './combat-behavior.test-utils'
import { captureCombatAbilitySource } from './combat-behavior-capture'

const target = { kind: 'unit' as const, combatantId: 'enemy' }
function action(effects: CombatEffectDefinition[]): CombatActionDefinition {
  return {
    id: 'test.removal',
    version: 1,
    sourceType: 'discipline-skill',
    tags: [],
    cost: { mp: 0, spendsAction: false },
    requirements: [],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      friendlyFire: 'enemies-only',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 4,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
    },
    effects,
  }
}
function removal(mode?: unknown): Extract<CombatEffectDefinition, { type: 'remove-status' }> {
  return {
    type: 'remove-status',
    recipient: 'primary-unit',
    statusIds: ['mark'],
    ...(mode === undefined ? {} : { removalMode: mode }),
  } as Extract<CombatEffectDefinition, { type: 'remove-status' }>
}
function afflicted() {
  const initial = percentageDotEncounter()
  const result = executeCombatAction(
    initial,
    action([
      { type: 'apply-status', recipient: 'primary-unit', statusId: 'mark', stacks: 1 },
      { type: 'apply-status', recipient: 'primary-unit', statusId: 'slow', stacks: 1 },
      {
        type: 'apply-status',
        recipient: 'primary-unit',
        statusId: 'suppress',
        stacks: 1,
        potencyBasisPoints: 2500,
        durationTurns: 2,
      },
    ]),
    target,
    PV1F_COMBAT_CONTENT,
  ).state
  return reattachStatDrivenCombatBridge(result, initial.statBridge)
}
it('explicit named removal preserves unrelated Suppress while historical omission keeps the old Cleanse rule', () => {
  const state = afflicted()
  const before = JSON.stringify(state)
  const specified = executeCombatAction(
    state,
    action([removal('specified')]),
    target,
    PV1F_COMBAT_CONTENT,
  )
  expect(
    specified.events.filter((e) => e.event === 'status_removed').map((e) => e.statusId),
  ).toEqual(['mark'])
  expect(
    specified.state.statusState
      .find((row) => row.combatantId === 'enemy')!
      .statuses.map((row) => row.statusId)
      .sort(),
  ).toEqual(['slow', 'suppress'])
  const historical = executeCombatAction(state, action([removal()]), target, PV1F_COMBAT_CONTENT)
  expect(
    historical.events
      .filter((e) => e.event === 'status_removed')
      .map((e) => e.statusId)
      .sort(),
  ).toEqual(['mark', 'suppress'])
  expect(JSON.stringify(state)).toBe(before)
})
it('captures the explicit removal mode without rewriting historical definitions', () => {
  const raw = source({ effects: [{ id: 'consume', payload: removal('specified') }] })
  const parsed = parseAbilityDefinition(raw.definition)
  const captured = captureCombatAbilitySource({ ...raw, definition: parsed })
  expect(
    JSON.parse(JSON.stringify(captured)).definition.behaviors[0].effects[0].payload,
  ).toMatchObject({ removalMode: 'specified', statusIds: ['mark'] })
  expect(combatEffectPresentationTags(removal('specified'))).toEqual(['Conditional Cleanse'])
  expect(combatEffectPresentationTags(removal())).toEqual(['Cleanse'])
})
it.each(['all', 'anything', null, 7, []].map((mode) => ({ mode })))(
  'rejects malformed explicit removal mode $mode at native and canonical boundaries',
  ({ mode }) => {
    expect(() =>
      validateCombatActionDefinition(action([removal(mode)]), PV1F_COMBAT_CONTENT),
    ).toThrow()
    expect(() =>
      executeCombatAction(afflicted(), action([removal(mode)]), target, PV1F_COMBAT_CONTENT),
    ).toThrow()
    expect(() =>
      parseAbilityDefinition(
        source({ effects: [{ id: 'bad', payload: removal(mode) }] }).definition,
      ),
    ).toThrow()
  },
)
it('recognizes Covert as a positive Dispel target without broadening Cleanse', () => {
  expect(
    combatEffectPresentationTags({
      type: 'remove-status',
      recipient: 'primary-unit',
      statusIds: ['guarded', 'covert', 'blindside'],
      removalMode: 'specified',
    }),
  ).toEqual(['Dispel'])
})

it.each([false, true])(
  'preserves historical Covert removal after capture/restore with delayed=%s',
  (delayed) => {
    const initial = afflicted()
    const covert = executeCombatAction(
      initial,
      action([
        {
          type: 'apply-status',
          recipient: 'primary-unit',
          statusId: 'covert',
          stacks: 1,
          durationTurns: 4,
        },
        {
          type: 'apply-status',
          recipient: 'primary-unit',
          statusId: 'suppress',
          stacks: 1,
          potencyBasisPoints: 2500,
          durationTurns: 4,
        },
      ]),
      target,
      PV1F_COMBAT_CONTENT,
    ).state
    const state = preparePv1fTurnEconomy(reattachStatDrivenCombatBridge(covert, initial.statBridge))
    const payload = { ...removal(), statusIds: ['covert'] }
    for (const specified of [false, true]) {
      const root = captureCombatAbilitySource(
        source({
          costs: [],
          effects: [
            {
              id: 'dispel',
              timing: delayed ? 'delayed' : 'instant',
              payload: { ...payload, ...(specified ? { removalMode: 'specified' as const } : {}) },
            },
          ],
        }),
      )
      const restored = JSON.parse(
        JSON.stringify(reconcileCombatAbilitySources(state, [root])),
      ) as typeof state
      const input = {
        state: restored,
        actorId: 'actor',
        root: { kind: 'canonical' as const, source: root },
        selection: target,
        content: PV1F_COMBAT_CONTENT,
        context: combatAbilityCommandContext(restored, root),
      }
      const prepared = prepareCombatAbilityCommand(input)
      expect(prepared.evaluation.legal).toBe(true)
      const out = commitCombatAbilityCommand(input)
      const events: unknown[] = [...out.events]
      let live = JSON.parse(JSON.stringify(out.state)) as typeof out.state
      if (delayed) {
        expect(live.pendingEffects).toHaveLength(1)
        for (
          let turns = 0;
          live.tactical.battle.round < restored.tactical.battle.round + 2 && turns < 10;
          turns++
        ) {
          const next = finishPv1fTurn(
            reattachStatDrivenCombatBridge(live, initial.statBridge),
            'east',
          )
          live = next.state
          events.push(...next.events)
        }
        expect(live.pendingEffects ?? []).toEqual([])
      }
      const removed = events
        .flatMap((event) =>
          event !== null &&
          typeof event === 'object' &&
          'event' in event &&
          event.event === 'status_removed' &&
          'statusId' in event &&
          typeof event.statusId === 'string'
            ? [event.statusId]
            : [],
        )
        .sort()
      expect(removed).toEqual(specified ? ['covert'] : ['covert', 'suppress'])
      if (specified)
        expect(
          live.statusState
            .find((row) => row.combatantId === 'enemy')!
            .statuses.some((row) => row.statusId === 'suppress'),
        ).toBe(true)
    }
    expect(combatEffectPresentationTags(payload)).toEqual(['Cleanse'])
  },
)

it('keeps specified removals through canonical preparation, JSON restore and committed settlement', () => {
  const root = captureCombatAbilitySource(
    source({ costs: [], effects: [{ id: 'consume', payload: removal('specified') }] }),
  )
  const state = JSON.parse(
    JSON.stringify(reconcileCombatAbilitySources(preparePv1fTurnEconomy(afflicted()), [root])),
  )
  const input = {
    state,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source: root },
    selection: target,
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, root),
  }
  const before = JSON.stringify(state)
  const quote = prepareCombatAbilityCommand(input)
  expect(quote.evaluation.legal).toBe(true)
  expect(JSON.stringify(state)).toBe(before)
  const committed = commitCombatAbilityCommand(input)
  expect(
    committed.events.filter((e) => e.event === 'status_removed').map((e) => e.statusId),
  ).toEqual(['mark'])
  expect(
    committed.state.statusState
      .find((row) => row.combatantId === 'enemy')!
      .statuses.some((row) => row.statusId === 'suppress'),
  ).toBe(true)
})
it('projects the exact removal to the existing AI utility path without mutating the encounter', () => {
  const state = afflicted()
  const effects = [removal('specified')]
  const before = JSON.stringify(state)
  const evaluation = evaluateCombatAction(state, action(effects), target, PV1F_COMBAT_CONTENT)
  expect(evaluation.projectedEffects).toContainEqual(
    expect.objectContaining({
      effectType: 'remove-status',
      combatantId: 'enemy',
      before: 'mark',
      after: 'none',
    }),
  )
  expect(
    projectedCombatEffectUtility(
      evaluation,
      state as ReturnType<typeof percentageDotEncounter>,
      effects,
    ),
  ).toBe(-8)
  expect(JSON.stringify(state)).toBe(before)
})
