import { describe, expect, it } from 'vitest'
import {
  executeCombatAction,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEncounterState,
  type CombatResolutionTransition,
} from './actions'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { PHASE4_STATUSES } from './status-content'
import { createAuthorableEffectPayload, AUTHORABLE_EFFECT_TAGS } from './combat-effect-authoring'
import { validateCombatTagPayload } from './combat-tag-registry'
import { endCombatTurn } from './actions'
import { selectCurrentFinalFacing } from './board'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { source } from './combat-behavior.test-utils'
import {
  activateCombatAbility,
  reconcileCombatAbilitySources,
  combatAbilityCommandContext,
} from './combat-behavior-runtime'
import { createCombatTriggerGuard } from './combat-kernel-types'
import { applyCurrentPoisonState } from './combat-dots'
import { preparePv1fTurnEconomy } from './pv1f-action-economy'

const content = { statuses: PHASE4_STATUSES }
function action(
  effects: CombatActionDefinition['effects'],
  tags: string[] = [],
): CombatActionDefinition {
  return {
    id: 'test.counter',
    version: 1,
    sourceType: 'test',
    tags,
    target: {
      kind: 'unit',
      teamPolicy: 'any',
      shape: { kind: 'single' },
      minimumRange: 0,
      maximumRange: 4,
      requiresLineOfSight: false,
      maximumElevationDifference: 0,
      friendlyFire: 'all-units',
    },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    effects,
  }
}
function cast(
  state: CombatEncounterState,
  effects: CombatActionDefinition['effects'],
  tags: string[] = [],
  target = 'enemy',
) {
  return executeCombatAction(
    state,
    action(effects, tags),
    { kind: 'unit', combatantId: target },
    content,
  )
}
function counter(kind = 'full', basisPoints = 15000) {
  return {
    type: 'apply-status',
    recipient: 'primary-unit',
    statusId: 'counter',
    stacks: 1,
    durationTurns: 2,
    counter: { kind, basisPoints },
  } as unknown as CombatActionDefinition['effects'][number]
}
function ready(kind = 'full', basisPoints = 15000) {
  return cast(percentageDotEncounter(), [counter(kind, basisPoints)]).state
}
const hp = (state: CombatEncounterState, id: string) =>
  state.tactical.battle.combatants.find((unit) => unit.id === id)!.hp

describe('Counter captured reactive status', () => {
  it('replaces only the current Vengeance choice and authors a typed positive Counter', () => {
    expect(AUTHORABLE_EFFECT_TAGS.some((tag) => tag.id === 'vengeance')).toBe(false)
    expect(createAuthorableEffectPayload('counter')).toMatchObject({
      type: 'apply-status',
      statusId: 'counter',
      counter: { kind: 'full', basisPoints: 10000 },
      durationTurns: 2,
    })
  })
  it.each([
    ['physical', 'physical', 970],
    ['physical', 'mystic', 1000],
    ['mystic', 'mystic', 970],
    ['mystic', 'physical', 1000],
    ['full', 'mystic', 970],
    ['full', 'physical', 970],
  ])('filters %s Counter against %s damage at 150%%', (kind, family, expected) => {
    const result = cast(
      ready(kind),
      [{ type: 'damage', recipient: 'primary-unit', amount: 20 }],
      [family],
    )
    expect(hp(result.state, 'actor')).toBe(expected)
    expect(hp(result.state, 'enemy')).toBe(980)
    expect(validateCombatEncounterState(result.state)).toEqual([])
  })
  it('uses actual HP loss after Barrier and keeps reflection out of recursive returns', () => {
    let state = cast(ready(), [counter('full', 20000)], [], 'actor').state
    state = cast(state, [{ type: 'barrier-change', recipient: 'primary-unit', amount: 15 }]).state
    const result = cast(
      state,
      [{ type: 'damage', recipient: 'primary-unit', amount: 20 }],
      ['physical'],
    )
    expect(hp(result.state, 'actor')).toBe(993)
    expect(hp(result.state, 'enemy')).toBe(995)
    expect(
      result.events.filter(
        (event) =>
          event.event === 'damage_applied' && event.actionId === 'status.reflect.current.v1',
      ),
    ).toHaveLength(1)
  })
  it('retains the profile through JSON capture and Copy Buffs', () => {
    const initial = JSON.parse(JSON.stringify(ready('mystic', 17500))) as CombatEncounterState
    const copied = cast(initial, [
      { type: 'copy-statuses', recipient: 'primary-unit', mode: 'amplify' },
    ]).state
    expect(
      copied.statusState
        .find((row) => row.combatantId === 'actor')
        ?.statuses.find((row) => row.statusId === 'counter'),
    ).toMatchObject({ counter: { kind: 'mystic', basisPoints: 17500 } })
    expect(validateCombatEncounterState(copied)).toEqual([])
  })
  it.each([0, -1, 1.1, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid Counter rate %s',
    (rate) => {
      expect(validateCombatTagPayload(counter('full', rate))).not.toEqual([])
    },
  )
  it('rejects unknown Counter types and profile metadata on other statuses', () => {
    expect(validateCombatTagPayload(counter('fire'))).not.toEqual([])
    expect(validateCombatTagPayload({ ...counter(), statusId: 'inspired' })).not.toEqual([])
    expect(validateCombatTagPayload(counter('full', 25000))).toEqual([])
  })
  it('expires at the captured duration rather than keeping a permanent return', () => {
    let state = ready()
    for (let turn = 0; turn < 8; turn++)
      state = endCombatTurn(
        { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
        content,
      ).state
    expect(
      state.statusState
        .find((row) => row.combatantId === 'enemy')
        ?.statuses.some((row) => row.statusId === 'counter'),
    ).toBe(false)
  })
  it('Full Counter returns sourced periodic damage before its duration expires', () => {
    let state = ready()
    state = {
      ...state,
      statusState: state.statusState.map((row) =>
        row.combatantId === 'enemy'
          ? {
              ...row,
              statuses: [
                ...row.statuses,
                {
                  statusId: 'test.tick',
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
    const periodicContent = {
      statuses: [
        ...content.statuses,
        {
          id: 'test.tick',
          version: 1,
          maximumStacks: 1,
          durationOwnerTurnStarts: 2,
          damageTakenMultiplierBasisPoints: 10000,
          endOfTurn: { type: 'damage' as const, amount: 10 },
        },
      ],
    }
    for (let turn = 0; turn < 2; turn++)
      state = endCombatTurn(
        { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
        periodicContent,
      ).state
    expect(hp(state, 'enemy')).toBe(990)
    expect(hp(state, 'actor')).toBe(985)
    expect(state.effectState?.damageHistory.some((row) => row.combatantId === 'actor')).toBe(false)
  })
  it('preserves the damage family through delayed packet settlement', () => {
    let state = ready('mystic')
    state = { ...state, effectTimingPolicy: { version: 1, modes: { damage: 'next-round' } } }
    state = cast(
      state,
      [{ type: 'damage', recipient: 'primary-unit', amount: 20 }],
      ['mystic'],
    ).state
    expect(hp(state, 'actor')).toBe(1000)
    for (let turn = 0; turn < 4; turn++)
      state = endCombatTurn(
        { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
        content,
      ).state
    expect(hp(state, 'actor')).toBe(970)
  })

  it('rounds once across repeated packets and excludes overkill from a mutual defeat', () => {
    const rounded = cast(
      ready('full', 5000),
      [
        { type: 'damage', recipient: 'primary-unit', amount: 1 },
        { type: 'damage', recipient: 'primary-unit', amount: 1 },
      ],
      ['physical'],
    )
    expect(hp(rounded.state, 'actor')).toBe(999)
    let state = ready()
    state = {
      ...state,
      tactical: {
        ...state.tactical,
        battle: {
          ...state.tactical.battle,
          combatants: state.tactical.battle.combatants.map((unit) => ({
            ...unit,
            hp: unit.id === 'actor' ? 3 : unit.id === 'enemy' ? 2 : 0,
          })),
        },
      },
    }
    const result = cast(
      state,
      [{ type: 'damage', recipient: 'primary-unit', amount: 100 }],
      ['physical'],
    )
    expect(hp(result.state, 'actor')).toBe(0)
    expect(hp(result.state, 'enemy')).toBe(0)
    expect(result.events.filter((event) => event.event === 'battle_completed')).toEqual([
      { event: 'battle_completed', winningTeamId: null },
    ])
  })
  it('does not return fully absorbed damage or activate a pending Counter early', () => {
    const protectedState = cast(ready(), [
      { type: 'barrier-change', recipient: 'primary-unit', amount: 20 },
    ]).state
    expect(
      hp(
        cast(
          protectedState,
          [{ type: 'damage', recipient: 'primary-unit', amount: 20 }],
          ['physical'],
        ).state,
        'actor',
      ),
    ).toBe(1000)
    const initial = {
      ...percentageDotEncounter(),
      effectTimingPolicy: { version: 1, modes: { counter: 'next-round' as const } },
    }
    let state = cast(initial, [counter()]).state
    expect(state.pendingEffects).toHaveLength(1)
    expect(
      hp(
        cast(state, [{ type: 'damage', recipient: 'primary-unit', amount: 20 }], ['physical'])
          .state,
        'actor',
      ),
    ).toBe(1000)
    for (let turn = 0; turn < 4; turn++)
      state = endCombatTurn(
        { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
        content,
      ).state
    expect(
      hp(
        cast(state, [{ type: 'damage', recipient: 'primary-unit', amount: 20 }], ['physical'])
          .state,
        'actor',
      ),
    ).toBe(970)
  })
  it('rejects a malformed restored profile', () => {
    const state = ready()
    const invalid = {
      ...state,
      statusState: state.statusState.map((row) => ({
        ...row,
        statuses: row.statuses.map((status) => ({
          ...status,
          counter: { kind: 'fire', basisPoints: 0 },
        })),
      })),
    } as unknown as CombatEncounterState
    expect(validateCombatEncounterState(invalid)).not.toEqual([])
  })

  it.each(['discipline-skill', 'essence', 'resonance'] as const)(
    'uses the same captured Counter through a canonical %s source',
    (sourceKind) => {
      const captured = captureCombatAbilitySource({
        ...source({
          classification: 'utility',
          attackFamily: undefined,
          costs: [],
          effects: [
            {
              id: 'return',
              payload: {
                type: 'apply-status',
                recipient: 'primary-unit',
                statusId: 'counter',
                stacks: 1,
                durationTurns: 2,
                counter: { kind: 'full', basisPoints: 15000 },
              },
            },
          ],
        }),
        sourceKind,
      })
      const initial = reconcileCombatAbilitySources(
        preparePv1fTurnEconomy(percentageDotEncounter()),
        [captured],
      )
      const granted = activateCombatAbility({
        state: initial,
        actorId: 'actor',
        source: captured,
        selection: { kind: 'unit', combatantId: 'enemy' },
        content,
        context: combatAbilityCommandContext(initial, captured),
      })
      const state = cast(
        granted.state,
        [{ type: 'damage', recipient: 'primary-unit', amount: 20 }],
        ['physical'],
      ).state
      expect(hp(state, 'actor')).toBe(970)
      expect(validateCombatEncounterState(state)).toEqual([])
    },
  )
  it('returns only damage received while Counter was active within an ordered command', () => {
    const damage = { type: 'damage' as const, recipient: 'primary-unit' as const, amount: 20 }
    expect(
      hp(cast(percentageDotEncounter(), [damage, counter()], ['physical']).state, 'actor'),
    ).toBe(1000)
    expect(
      hp(
        cast(
          ready(),
          [
            damage,
            {
              type: 'remove-status',
              recipient: 'primary-unit',
              statusIds: ['counter'],
              removalMode: 'specified',
            },
          ],
          ['physical'],
        ).state,
        'actor',
      ),
    ).toBe(970)
  })

  it('Full Counter also returns a sourced Poison movement tick', () => {
    let state = cast(percentageDotEncounter(), [counter()], [], 'ally').state
    state = applyCurrentPoisonState(state, 'enemy', 'ally', 'test.poison', false, undefined, 3, {
      capturedDamage: 100,
      profile: { kind: 'attack-percentage', basisPoints: 1000 },
    })
    state = {
      ...state,
      effectState: {
        ...state.effectState!,
        poison: state.effectState!.poison.map((row) => ({ ...row, movementRemainder: 4 })),
      },
    }
    const moved = cast(
      state,
      [{ type: 'displace', recipient: 'primary-unit', direction: 'push', distance: 1 }],
      [],
      'ally',
    )
    expect(hp(moved.state, 'ally')).toBe(990)
    expect(hp(moved.state, 'enemy')).toBe(985)
  })
  it('uses attack family rather than element and filters mixed native packets separately', () => {
    expect(
      hp(
        cast(
          ready('physical'),
          [{ type: 'damage', recipient: 'primary-unit', amount: 20, element: 'fire' }],
          ['physical'],
        ).state,
        'actor',
      ),
    ).toBe(970)
    expect(
      hp(
        cast(
          ready('mystic'),
          [{ type: 'damage', recipient: 'primary-unit', amount: 20, element: 'storm' }],
          ['physical'],
        ).state,
        'actor',
      ),
    ).toBe(1000)
    const mixed = cast(ready('physical'), [
      { type: 'damage', recipient: 'primary-unit', amount: 10, defenseKind: 'armor' },
      { type: 'damage', recipient: 'primary-unit', amount: 10, defenseKind: 'ward' },
    ])
    expect(hp(mixed.state, 'actor')).toBe(985)
  })
  it('prepares the successor only once when a periodic Counter defeats the incoming actor', () => {
    let state = cast(percentageDotEncounter(), [counter()], [], 'actor').state
    state = {
      ...state,
      tactical: {
        ...state.tactical,
        battle: {
          ...state.tactical.battle,
          combatants: state.tactical.battle.combatants.map((unit) =>
            unit.id === 'enemy' ? { ...unit, hp: 3 } : unit,
          ),
        },
      },
      statusState: state.statusState.map((row) =>
        row.combatantId === 'actor'
          ? {
              ...row,
              statuses: [
                ...row.statuses,
                {
                  statusId: 'test.tick',
                  statusVersion: 1,
                  stacks: 1,
                  remainingOwnerTurnStarts: 2,
                  sourceCombatantId: 'enemy',
                },
              ],
            }
          : row.combatantId === 'other'
            ? {
                ...row,
                statuses: [
                  {
                    statusId: 'test.successor',
                    statusVersion: 1,
                    stacks: 1,
                    remainingOwnerTurnStarts: 2,
                    sourceCombatantId: 'other',
                  },
                ],
              }
            : row,
      ),
    }
    const contentWithTicks = {
      statuses: [
        ...content.statuses,
        {
          id: 'test.tick',
          version: 1,
          maximumStacks: 1,
          durationOwnerTurnStarts: 2,
          damageTakenMultiplierBasisPoints: 10000,
          endOfTurn: { type: 'damage' as const, amount: 10 },
        },
        {
          id: 'test.successor',
          version: 1,
          maximumStacks: 1,
          durationOwnerTurnStarts: 2,
          damageTakenMultiplierBasisPoints: 10000,
        },
      ],
    }
    let guard = createCombatTriggerGuard({ triggerChainId: 'periodic-counter' })
    const observed: CombatResolutionTransition['events'][number][] = []
    const hooks = {
      getGuard: () => guard,
      setGuard: (next: typeof guard) => {
        guard = next
      },
      observeMutation: (_before: CombatEncounterState, transition: CombatResolutionTransition) => {
        observed.push(...transition.events)
        return transition.state
      },
    }
    const result = endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
      contentWithTicks,
      false,
      hooks,
    )
    expect(result.state.tactical.battle.currentTurn?.combatantId).toBe('other')
    expect(
      result.state.statusState
        .find((row) => row.combatantId === 'other')
        ?.statuses.find((status) => status.statusId === 'test.successor')?.remainingOwnerTurnStarts,
    ).toBe(1)
    expect(
      observed.filter((event) => event.event === 'turn_started').map((event) => event.combatantId),
    ).toEqual(['other'])
    expect(validateCombatEncounterState(result.state)).toEqual([])
  })

  it('allows mutual defeat from a lethal final periodic tick', () => {
    let state = cast(percentageDotEncounter(), [counter()], [], 'actor').state
    state = {
      ...state,
      tactical: {
        ...state.tactical,
        battle: {
          ...state.tactical.battle,
          combatants: state.tactical.battle.combatants.map((unit) => ({
            ...unit,
            hp: unit.id === 'actor' ? 10 : unit.id === 'enemy' ? 3 : 0,
          })),
        },
      },
      statusState: state.statusState.map((row) =>
        row.combatantId === 'actor'
          ? {
              ...row,
              statuses: [
                ...row.statuses,
                {
                  statusId: 'test.tick',
                  statusVersion: 1,
                  stacks: 1,
                  remainingOwnerTurnStarts: 2,
                  sourceCombatantId: 'enemy',
                },
              ],
            }
          : row,
      ),
    }
    const contentWithTicks = {
      statuses: [
        ...content.statuses,
        {
          id: 'test.tick',
          version: 1,
          maximumStacks: 1,
          durationOwnerTurnStarts: 2,
          damageTakenMultiplierBasisPoints: 10000,
          endOfTurn: { type: 'damage' as const, amount: 10 },
        },
      ],
    }
    const result = endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
      contentWithTicks,
    )
    expect(hp(result.state, 'actor')).toBe(0)
    expect(hp(result.state, 'enemy')).toBe(0)
    expect(result.events.filter((event) => event.event === 'battle_completed')).toEqual([
      { event: 'battle_completed', winningTeamId: null },
    ])
    expect(validateCombatEncounterState(result.state)).toEqual([])
  })
  it('rejects zero duration and conflicting generic Counter tuning', () => {
    expect(validateCombatTagPayload({ ...counter(), durationTurns: 0 })).not.toEqual([])
    expect(validateCombatTagPayload({ ...counter(), potencyBasisPoints: 1000 })).not.toEqual([])
    expect(validateCombatTagPayload({ ...counter(), power: 1 })).not.toEqual([])
  })
})
