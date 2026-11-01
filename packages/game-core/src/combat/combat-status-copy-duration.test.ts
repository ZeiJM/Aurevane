import { describe, expect, it } from 'vitest'
import {
  endCombatTurn,
  executeCombatAction,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEffectDefinition,
  type CombatEncounterState,
} from './actions'
import { selectCurrentFinalFacing } from './board'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import { validateCombatTagPayload } from './combat-tag-registry'
import {
  applyCurrentBurnState,
  applyCurrentPoisonState,
  applyCurrentBleedState,
} from './combat-dots'

function action(
  effects: readonly CombatEffectDefinition[],
  id = 'test.copy-duration',
): CombatActionDefinition {
  return {
    id,
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
    effectTimingModes: effects.map(() => 'instant'),
  }
}
function encounter(): CombatEncounterState {
  return { ...percentageDotEncounter(), effectTimingPolicy: { version: 1, modes: {} } }
}
function cast(
  state: CombatEncounterState,
  effects: readonly CombatEffectDefinition[],
  target: string,
  id?: string,
) {
  return executeCombatAction(
    state,
    action(effects, id),
    { kind: 'unit', combatantId: target },
    PV1F_COMBAT_CONTENT,
  ).state
}
function status(state: CombatEncounterState, recipient: string, statusId: string) {
  return state.statusState
    .find((row) => row.combatantId === recipient)
    ?.statuses.find((row) => row.statusId === statusId)
}
function fullRounds(state: CombatEncounterState, count: number) {
  const target = state.tactical.battle.round + count
  while (
    state.tactical.battle.round < target ||
    state.tactical.battle.currentTurn?.combatantId !== 'actor'
  )
    state = endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
      PV1F_COMBAT_CONTENT,
    ).state
  return state
}
function copy(mode: 'amplify' | 'curse', statusId: string, current = true): CombatEffectDefinition {
  return {
    type: 'copy-statuses',
    recipient: 'primary-unit',
    mode,
    statusIds: [statusId],
    ...(current ? { durationPolicyVersion: 1 } : {}),
  } as CombatEffectDefinition
}
function reload(state: CombatEncounterState) {
  const restored = JSON.parse(JSON.stringify(state)) as CombatEncounterState
  expect(validateCombatEncounterState(restored)).toEqual([])
  return restored
}

describe('current copies restore the actual source Skill lifetime', () => {
  it.each([
    {
      mode: 'amplify' as const,
      statusId: 'guarded',
      donor: 'ally',
      receiver: 'actor',
      durationTurns: 7,
      expiryRounds: 8,
    },
    {
      mode: 'curse' as const,
      statusId: 'root',
      donor: 'actor',
      receiver: 'enemy',
      durationTurns: 99,
      expiryRounds: 99,
    },
  ])(
    'refreshes $mode from source duration $durationTurns after countdown and reload without changing the donor',
    ({ mode, statusId, donor, receiver, durationTurns, expiryRounds }) => {
      let state = cast(
        encounter(),
        [{ type: 'apply-status', recipient: 'primary-unit', statusId, stacks: 1, durationTurns }],
        donor,
        `test.source.${durationTurns}`,
      )
      state = reload(fullRounds(state, 3))
      expect(status(state, donor, statusId)?.remainingOwnerTurnEnds).toBe(mode === 'curse' ? 97 : 4)
      const original = structuredClone(status(state, donor, statusId))
      state = reload(cast(state, [copy(mode, statusId)], mode === 'amplify' ? donor : receiver))
      expect(status(state, receiver, statusId)?.remainingOwnerTurnEnds).toBe(durationTurns)
      expect(status(state, donor, statusId)).toEqual(original)
      state = fullRounds(state, expiryRounds - 1)
      expect(status(state, receiver, statusId)).toBeDefined()
      state = fullRounds(state, 1)
      expect(status(state, receiver, statusId)).toBeUndefined()
    },
  )

  it('uses the longest originally authored source application rather than the latest cast or generic catalogue default', () => {
    let state = cast(
      encounter(),
      [
        {
          type: 'apply-status',
          recipient: 'primary-unit',
          statusId: 'guarded',
          stacks: 1,
          durationTurns: 9,
        },
      ],
      'ally',
      'source.long',
    )
    state = cast(
      state,
      [
        {
          type: 'apply-status',
          recipient: 'primary-unit',
          statusId: 'guarded',
          stacks: 1,
          durationTurns: 4,
        },
      ],
      'ally',
      'source.short',
    )
    state = reload(fullRounds(state, 2))
    state = reload(cast(state, [copy('amplify', 'guarded')], 'ally'))
    expect(status(state, 'actor', 'guarded')?.remainingOwnerTurnEnds).toBe(9)
    expect(status(state, 'actor', 'guarded')?.stacks).toBe(2)
  })

  it('retains the authored 99-turn lifetime and historical owner-turn-start offset without a timing policy', () => {
    let state: CombatEncounterState = percentageDotEncounter()
    state = cast(
      state,
      [
        {
          type: 'apply-status',
          recipient: 'primary-unit',
          statusId: 'guarded',
          stacks: 1,
          durationTurns: 99,
        },
      ],
      'ally',
    )
    state = reload(fullRounds(state, 3))
    expect(status(state, 'ally', 'guarded')?.remainingOwnerTurnStarts).toBe(97)
    state = reload(cast(state, [copy('amplify', 'guarded')], 'ally'))
    expect(status(state, 'actor', 'guarded')?.remainingOwnerTurnStarts).toBe(100)
    expect(status(state, 'actor', 'guarded')?.remainingOwnerTurnEnds).toBeUndefined()
  })

  it.each(['next-round', 'delayed'] as const)(
    'captures a full source lifetime for a %s copy before the donor expires',
    (timing) => {
      let state = cast(
        encounter(),
        [
          {
            type: 'apply-status',
            recipient: 'primary-unit',
            statusId: 'guarded',
            stacks: 1,
            durationTurns: 4,
          },
        ],
        'ally',
      )
      state = fullRounds(state, 3)
      const queued = action([copy('amplify', 'guarded')])
      queued.effectTimingModes = [timing]
      state = reload(
        executeCombatAction(
          state,
          queued,
          { kind: 'unit', combatantId: 'ally' },
          PV1F_COMBAT_CONTENT,
        ).state,
      )
      state = reload(fullRounds(state, timing === 'next-round' ? 1 : 2))
      expect(status(state, 'ally', 'guarded')).toBeUndefined()
      expect(status(state, 'actor', 'guarded')).toMatchObject({
        remainingOwnerTurnEnds: 4,
        originalDurationTurns: 4,
      })
    },
  )

  it.each([undefined, ['burn', 'bleed', 'poison']])(
    'current Copy Debuffs excludes typed DoTs for selection %j while historical copies retain them',
    (statusIds) => {
      let state = applyCurrentBurnState(encounter(), 'enemy', 'actor', 'test.burn', true, 1, 3)
      state = applyCurrentPoisonState(state, 'enemy', 'actor', 'test.poison', true, 1, 4)
      state = applyCurrentBleedState(state, 'enemy', 'actor', 'test.bleed', 1, 3, true)
      const payload = {
        type: 'copy-statuses' as const,
        recipient: 'primary-unit' as const,
        mode: 'curse' as const,
        ...(statusIds === undefined ? {} : { statusIds }),
      }
      expect(() => cast(state, [{ ...payload, durationPolicyVersion: 1 }], 'enemy')).toThrow(
        /eligible active statuses/,
      )
      const copied = cast(state, [payload], 'enemy')
      expect(copied.effectState?.burn.some((row) => row.targetCombatantId === 'enemy')).toBe(true)
      expect(copied.effectState?.poison.some((row) => row.targetCombatantId === 'enemy')).toBe(true)
      expect(copied.effectState?.bleed.some((row) => row.targetCombatantId === 'enemy')).toBe(true)
    },
  )

  it.each([0, 100, 1.5, NaN])(
    'rejects corrupted originally authored lifetime %s after persistence',
    (originalDurationTurns) => {
      const state = cast(
        encounter(),
        [
          {
            type: 'apply-status',
            recipient: 'primary-unit',
            statusId: 'guarded',
            stacks: 1,
            durationTurns: 7,
          },
        ],
        'ally',
      )
      for (const location of ['status', 'application']) {
        const corrupt = structuredClone(state)
        const donor = status(corrupt, 'ally', 'guarded')!
        if (location === 'status') donor.originalDurationTurns = originalDurationTurns
        else donor.applicationModifiers![0]!.originalDurationTurns = originalDurationTurns
        expect(validateCombatEncounterState(JSON.parse(JSON.stringify(corrupt)))).not.toEqual([])
      }
    },
  )

  it.each([true, false])(
    'captures omitted source duration from its pinned effective clock (timing policy %s), never the catalogue at copy time',
    (timed) => {
      const pinned = {
        ...PV1F_COMBAT_CONTENT,
        statuses: PV1F_COMBAT_CONTENT.statuses.map((row) =>
          row.id === 'guarded' ? { ...row, durationOwnerTurnStarts: timed ? 8 : 7 } : row,
        ),
      }
      const source = action(
        [{ type: 'apply-status', recipient: 'primary-unit', statusId: 'guarded', stacks: 1 }],
        'test.pinned-default',
      )
      let state = executeCombatAction(
        timed ? encounter() : percentageDotEncounter(),
        source,
        { kind: 'unit', combatantId: 'ally' },
        pinned,
      ).state
      state = reload(fullRounds(state, 2))
      expect(status(state, 'ally', 'guarded')?.remainingOwnerTurnStarts).toBe(5)
      state = reload(cast(state, [copy('amplify', 'guarded')], 'ally'))
      expect(status(state, 'actor', 'guarded')?.remainingOwnerTurnStarts).toBe(7)
    },
  )

  it('keeps historical unversioned copy captures on remaining-duration mechanics', () => {
    let state = cast(
      encounter(),
      [
        {
          type: 'apply-status',
          recipient: 'primary-unit',
          statusId: 'guarded',
          stacks: 1,
          durationTurns: 7,
        },
      ],
      'ally',
    )
    state = fullRounds(state, 3)
    state = cast(state, [copy('amplify', 'guarded', false)], 'ally')
    expect(status(state, 'actor', 'guarded')?.remainingOwnerTurnEnds).toBe(4)
  })

  it('does not guess a full source lifetime for historical donor snapshots with no origin capture', () => {
    let state = encounter()
    state.statusState = state.statusState.map((row) =>
      row.combatantId === 'ally'
        ? {
            ...row,
            statuses: [
              {
                statusId: 'guarded',
                statusVersion: 1,
                sourceCombatantId: 'ally',
                stacks: 1,
                remainingOwnerTurnStarts: 1,
                remainingOwnerTurnEnds: 1,
                timingState: 'active',
              },
            ],
          }
        : row,
    )
    state = cast(reload(state), [copy('amplify', 'guarded')], 'ally')
    expect(status(state, 'actor', 'guarded')?.remainingOwnerTurnEnds).toBe(1)
  })

  it('rejects unsupported copy duration policies at the canonical boundary', () => {
    expect(validateCombatTagPayload(copy('amplify', 'guarded'))).toEqual([])
    expect(
      validateCombatTagPayload({ ...copy('amplify', 'guarded'), durationPolicyVersion: 2 }),
    ).not.toEqual([])
  })
})
