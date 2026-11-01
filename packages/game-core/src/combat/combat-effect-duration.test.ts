import { describe, expect, it } from 'vitest'
import { validateCombatTagPayload, nativeCombatTagPayload } from './combat-tag-registry'
import { createAuthorableEffectPayload } from './combat-effect-authoring'
import { validateCombatActionDefinition } from './combat-authoring-validation'
import {
  executeCombatAction,
  endCombatTurn,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEncounterState,
} from './actions'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { selectCurrentFinalFacing } from './board'
import { PV1F_COMBAT_CONTENT } from './pv1f-action-economy'

const content = PV1F_COMBAT_CONTENT
const profile = { kind: 'attack-percentage' as const, basisPoints: 100 }
function action(effects: CombatActionDefinition['effects']): CombatActionDefinition {
  return {
    id: 'test.long-duration',
    version: 1,
    sourceType: 'test',
    tags: [],
    requirements: [],
    cost: { spendsAction: false, mp: 0 },
    target: {
      kind: 'unit',
      teamPolicy: 'any',
      shape: { kind: 'single' },
      minimumRange: 0,
      maximumRange: 4,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire: 'all-units',
    },
    effects,
  }
}
function reload(state: CombatEncounterState): CombatEncounterState {
  const restored = JSON.parse(JSON.stringify(state)) as CombatEncounterState
  expect(validateCombatEncounterState(restored)).toEqual([])
  return restored
}
function finish(state: CombatEncounterState): CombatEncounterState {
  return reload(
    endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
      content,
    ).state,
  )
}

describe('editable effect duration authority', () => {
  it.each(['guarded', 'counter', 'endure', 'reveal', 'suppress', 'burn', 'poison', 'bleed'])(
    'accepts 99 and rejects 100 for %s through canonical and native validation',
    (tag) => {
      const starter = createAuthorableEffectPayload(
        ['guarded', 'suppress'].includes(tag) ? `status:${tag}` : tag,
      )!
      const field = starter.type === 'sensory' ? 'revealedDurationOwnerTurnStarts' : 'durationTurns'
      for (const turns of [31, 99, 100]) {
        const payload = {
          ...starter,
          [field]: turns,
          ...(['burn', 'poison', 'bleed'].includes(tag)
            ? { damageProfile: profile, ...(tag === 'bleed' ? { ticks: turns } : {}) }
            : {}),
        }
        const valid = turns <= 99
        expect(validateCombatTagPayload(payload).length === 0, `${tag}:${turns}`).toBe(valid)
        const native = () =>
          validateCombatActionDefinition(
            action([payload as CombatActionDefinition['effects'][number]]),
          )
        if (valid) expect(native).not.toThrow()
        else expect(native).toThrow()
      }
    },
  )

  it.each(['hp-recovery', 'mp-recovery', 'mp-restore'])(
    'accepts 99 future turns and rejects 100 for %s',
    (tag) => {
      for (const durationTurns of [99, 100]) {
        const payload = {
          ...createAuthorableEffectPayload(tag)!,
          durationTurns,
          ticks: durationTurns + 1,
        }
        expect(validateCombatTagPayload(payload).length === 0).toBe(durationTurns === 99)
        const validate = () =>
          validateCombatActionDefinition(action([nativeCombatTagPayload(payload)]))
        if (durationTurns === 99) expect(validate).not.toThrow()
        else expect(validate).toThrow()
      }
    },
  )

  it.each(['counter', 'endure', 'reveal', 'suppress', 'mark'])(
    'persists %s across 99 complete active rounds and expires on the next boundary',
    (tag) => {
      const starter = createAuthorableEffectPayload(
        ['suppress', 'mark'].includes(tag) ? `status:${tag}` : tag,
      )!
      const payload = {
        ...starter,
        ...(starter.type === 'sensory'
          ? { revealedDurationOwnerTurnStarts: 99 }
          : { durationTurns: 99 }),
      }
      const initial = percentageDotEncounter()
      if (tag === 'reveal')
        initial.statusState = initial.statusState.map((row) =>
          row.combatantId === 'enemy'
            ? {
                ...row,
                statuses: [
                  {
                    statusId: 'covert',
                    statusVersion: 1,
                    stacks: 1,
                    sourceCombatantId: 'enemy',
                    remainingOwnerTurnStarts: 3,
                  },
                ],
              }
            : row,
        )
      let state = reload(
        executeCombatAction(
          { ...initial, effectTimingPolicy: { version: 1, modes: { endure: 'next-round' } } },
          action([payload as CombatActionDefinition['effects'][number]]),
          { kind: 'unit', combatantId: 'enemy' },
          content,
        ).state,
      )
      const recipient = starter.recipient === 'actor' ? 'actor' : 'enemy'
      const statusId = tag === 'reveal' ? 'revealed' : tag
      const status = () =>
        state.statusState
          .find((row) => row.combatantId === recipient)
          ?.statuses.find((row) => row.statusId === statusId)
      while (state.tactical.battle.round === 1) state = finish(state)
      expect(status()?.remainingOwnerTurnEnds).toBe(99)
      while (state.tactical.battle.round < 101) {
        expect(status()).toBeDefined()
        state = finish(state)
      }
      expect(status()).toBeUndefined()
    },
  )

  it('preserves all 99 percentage DoT ticks across actual turn endings and reloads', () => {
    let state: CombatEncounterState = {
      ...percentageDotEncounter(),
      dotTriggerPolicyVersion: 2,
      effectTimingPolicy: {
        version: 1,
        modes: { damage: 'instant', burn: 'instant', poison: 'instant', bleed: 'instant' },
      },
    }
    state = reload(
      executeCombatAction(
        state,
        action([
          { type: 'damage', recipient: 'primary-unit', amount: 100, durationTurns: 0 },
          { type: 'burn', recipient: 'primary-unit', damageProfile: profile, durationTurns: 99 },
          { type: 'poison', recipient: 'primary-unit', damageProfile: profile, durationTurns: 99 },
          {
            type: 'bleed',
            recipient: 'primary-unit',
            damageProfile: profile,
            durationTurns: 99,
            ticks: 99,
          },
        ]),
        { kind: 'unit', combatantId: 'enemy' },
        content,
      ).state,
    )
    for (let tick = 1; tick <= 99; tick++) {
      while (state.tactical.battle.currentTurn!.combatantId !== 'enemy') state = finish(state)
      expect(state.effectState?.burn[0]?.remainingTicks).toBe(100 - tick)
      expect(state.effectState?.poison[0]?.remainingTicks).toBe(100 - tick)
      expect(state.effectState?.bleed[0]?.remainingTicks).toBe(100 - tick)
      state = finish(state)
      expect(state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.hp).toBe(
        900 - tick * 3,
      )
    }
    expect(state.effectState?.burn).toEqual([])
    expect(state.effectState?.poison).toEqual([])
    expect(state.effectState?.bleed).toEqual([])
  })

  it('preserves retained fixed-damage Bleed for 99 turns with its original per-tick damage', () => {
    let state = reload(
      executeCombatAction(
        percentageDotEncounter(),
        action([
          {
            type: 'bleed',
            recipient: 'primary-unit',
            damagePerTick: 1,
            ticks: 99,
            durationTurns: 99,
          },
        ]),
        { kind: 'unit', combatantId: 'enemy' },
        content,
      ).state,
    )
    for (let tick = 1; tick <= 99; tick++) {
      while (state.tactical.battle.currentTurn!.combatantId !== 'enemy') state = finish(state)
      state = finish(state)
      expect(state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.hp).toBe(
        1000 - tick,
      )
    }
    expect(state.effectState?.bleed).toEqual([])
  })

  it('preserves a 99-turn recovery schedule with one immediate and 99 future applications', () => {
    let state: CombatEncounterState = percentageDotEncounter()
    state = {
      ...state,
      tactical: {
        ...state.tactical,
        battle: {
          ...state.tactical.battle,
          combatants: state.tactical.battle.combatants.map((unit) =>
            unit.id === 'ally' ? { ...unit, hp: 1 } : unit,
          ),
        },
      },
    }
    const recovery = action([
      { type: 'healing', recipient: 'primary-unit', amount: 1, ticks: 100, durationTurns: 99 },
    ])
    state = reload(
      executeCombatAction(state, recovery, { kind: 'unit', combatantId: 'ally' }, content).state,
    )
    expect(state.effectState?.ongoingRecovery[0]?.remainingFutureTicks).toBe(99)
    for (let tick = 1; tick <= 99; tick++) {
      while (state.tactical.battle.currentTurn!.combatantId !== 'ally') state = finish(state)
      state = finish(state)
      expect(state.tactical.battle.combatants.find((unit) => unit.id === 'ally')!.hp).toBe(2 + tick)
    }
    expect(state.effectState?.ongoingRecovery).toEqual([])
    expect(() =>
      validateCombatActionDefinition(
        action([
          { type: 'healing', recipient: 'primary-unit', amount: 1, ticks: 101, durationTurns: 100 },
        ]),
      ),
    ).toThrow()
  })
})
