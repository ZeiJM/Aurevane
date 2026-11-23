import { expect, it } from 'vitest'
import { source } from './combat-behavior.test-utils'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { preparePv1fTurnEconomy, finishPv1fTurn, PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import { reattachStatDrivenCombatBridge } from './stat-driven-combat'
import { applySkillCooldown } from './skill-cooldowns'
import {
  reconcileCombatAbilitySources,
  primeCombatControlledAbility,
  combatAbilityCommandContext,
  combatControlledAbilityAvailability,
  cancelCombatControlledAbility,
} from './combat-behavior-runtime'
import { prepareCombatAbilityCommand, commitCombatAbilityCommand } from './combat-ability-command'
import { validateCombatAbilityState } from './combat-ability-state'

function fixture() {
  const root = captureCombatAbilitySource(
    source({
      effects: [
        {
          id: 'hit',
          timing: 'controlled',
          payload: { type: 'damage', recipient: 'primary-unit', amount: 10 },
        },
      ],
    }),
  )
  const modifier = captureCombatAbilitySource({
    ...source(
      {
        id: 'extra',
        mode: 'modifier',
        targeting: null,
        costs: [
          { resource: 'ap', amount: 7 },
          { resource: 'mp', amount: 1 },
        ],
        cooldown: { key: 'modifier-clock', ownerTurns: 2 },
        effects: [
          { id: 'extra-hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 3 } },
        ],
      },
      '["opaque","modifier"]',
    ),
    abilityId: 'test.modifier',
    contentVersion: 7,
  })
  const state = reconcileCombatAbilitySources(preparePv1fTurnEconomy(percentageDotEncounter()), [
    root,
    modifier,
  ])
  const refs = [{ sourceInstanceId: modifier.sourceInstanceId, behaviorId: 'extra' }]
  const primeInput = {
    state,
    actorId: 'actor',
    sourceInstanceId: root.sourceInstanceId,
    behaviorId: 'strike',
    manualModifiers: refs,
  }
  const command = (next: typeof state, manualModifiers = refs) => ({
    state: next,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source: root },
    manualModifiers,
    selection: { kind: 'unit' as const, combatantId: 'enemy' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(next, root),
  })
  return { root, modifier, state, refs, primeInput, command }
}

const areaCases = ([2, 3] as const).flatMap((geometryVersion) =>
  ([{ kind: 'line', length: 2 }, { kind: 'circle', radius: 2 }, { kind: 'all' }] as const).map(
    (shape) => ({ geometryVersion, shape }),
  ),
)
function areaFixture({ geometryVersion, shape }: (typeof areaCases)[number]) {
  const f = fixture()
  const root = captureCombatAbilitySource({
    ...f.root,
    definition: {
      schemaVersion: 1,
      behaviors: [
        {
          ...f.root.definition.behaviors[0]!,
          targeting: {
            ...f.root.definition.behaviors[0]!.targeting!,
            geometryVersion,
            ...(geometryVersion === 3 ? { categories: ['enemy'] as const } : {}),
            minimumRange: 0,
            maximumRange:
              shape.kind === 'line' ? shape.length : shape.kind === 'circle' ? shape.radius : 0,
            requiresLineOfSight: false,
            shape,
          },
          effects: [
            {
              id: 'area-hit',
              timing: 'controlled',
              payload: { type: 'damage', recipient: 'affected-units', amount: 10 },
            },
          ],
        },
      ],
    },
  })
  const state = reconcileCombatAbilitySources(preparePv1fTurnEconomy(percentageDotEncounter()), [
    root,
    f.modifier,
  ])
  return { ...f, root, state, primeInput: { ...f.primeInput, state } }
}

it.each(areaCases)(
  'rejects an impossible primary-unit attachment before a geometry$geometryVersion $shape.kind prime is consumed',
  (area) => {
    const f = areaFixture(area)
    const empty = primeCombatControlledAbility({
      ...f.primeInput,
      manualModifiers: undefined,
    }).state
    const released = commitCombatAbilityCommand({
      ...f.command(empty, []),
      root: { kind: 'canonical', source: f.root },
      selection:
        area.shape.kind === 'line'
          ? { kind: 'direction', direction: 'east' }
          : { kind: 'activate' },
    })
    expect(released.state.abilityRuntime!.controlled!.primes).toEqual([])
    const before = JSON.stringify(f.state)
    expect(() => primeCombatControlledAbility(f.primeInput)).toThrow('modifier-root-incompatible')
    expect(JSON.stringify(f.state)).toBe(before)
  },
)

it.each(areaCases)(
  'rejects forged persisted primary-unit attachments on geometry$geometryVersion $shape.kind primes',
  (area) => {
    const f = areaFixture(area)
    const saved = JSON.parse(
      JSON.stringify(
        primeCombatControlledAbility({ ...f.primeInput, manualModifiers: undefined }).state,
      ),
    )
    for (const collection of ['primes', 'used'])
      saved.abilityRuntime.controlled[collection][0].manualModifiers = [
        {
          ...f.refs[0],
          abilityId: f.modifier.abilityId,
          contentVersion: f.modifier.contentVersion,
        },
      ]
    expect(validateCombatAbilityState(saved)).not.toEqual([])
  },
)

it('rejects primary-unit attachments and forged restores for a Ground-only Single root with no unit choice', () => {
  const f = fixture()
  const root = captureCombatAbilitySource({
    ...f.root,
    definition: {
      schemaVersion: 1,
      behaviors: [
        {
          ...f.root.definition.behaviors[0]!,
          targeting: {
            ...f.root.definition.behaviors[0]!.targeting!,
            geometryVersion: 3,
            categories: ['ground'],
          },
        },
      ],
    },
  })
  const state = reconcileCombatAbilitySources(preparePv1fTurnEconomy(percentageDotEncounter()), [
    root,
    f.modifier,
  ])
  const before = JSON.stringify(state)
  expect(() => primeCombatControlledAbility({ ...f.primeInput, state })).toThrow(
    'modifier-root-incompatible',
  )
  expect(JSON.stringify(state)).toBe(before)
  const saved = JSON.parse(
    JSON.stringify(
      primeCombatControlledAbility({ ...f.primeInput, state, manualModifiers: undefined }).state,
    ),
  )
  for (const collection of ['primes', 'used'])
    saved.abilityRuntime.controlled[collection][0].manualModifiers = [
      { ...f.refs[0], abilityId: f.modifier.abilityId, contentVersion: f.modifier.contentVersion },
    ]
  expect(validateCombatAbilityState(saved)).not.toEqual([])
})

it.each(['actor', 'affected-units'] as const)(
  'retains a supported %s modifier on an area prime and release',
  (recipient) => {
    const f = areaFixture({ geometryVersion: 3, shape: { kind: 'circle', radius: 2 } })
    const modifier = captureCombatAbilitySource({
      ...f.modifier,
      definition: {
        schemaVersion: 1,
        behaviors: [
          {
            ...f.modifier.definition.behaviors[0]!,
            effects: [
              {
                id: 'area-extra',
                timing: 'instant',
                payload:
                  recipient === 'actor'
                    ? { type: 'damage-bonus', recipient, multiplierBasisPoints: 11000 }
                    : { type: 'damage', recipient, amount: 3 },
              },
            ],
          },
        ],
      },
    })
    const state = reconcileCombatAbilitySources(preparePv1fTurnEconomy(percentageDotEncounter()), [
      f.root,
      modifier,
    ])
    const primed = primeCombatControlledAbility({ ...f.primeInput, state }).state
    expect(validateCombatAbilityState(primed)).toEqual([])
    const released = commitCombatAbilityCommand({
      ...f.command(primed),
      root: { kind: 'canonical', source: f.root },
      selection: { kind: 'activate' },
    })
    expect(released.state.abilityRuntime!.controlled!.primes).toEqual([])
    expect(released.events).toContainEqual(
      expect.objectContaining({ event: 'ap_spent', amount: 18 }),
    )
  },
)

it('free prime pins the exact Manual modifier capture and exposes only owner reference choices', () => {
  const f = fixture()
  const before = JSON.stringify(f.state)
  const primed = primeCombatControlledAbility(f.primeInput)
  expect(primed.events).toEqual([])
  expect(primed.state.tactical).toEqual(f.state.tactical)
  expect(primed.state.abilityRuntime!.usage).toEqual([])
  expect(primed.state.abilityRuntime!.controlled!.primes[0]).toMatchObject({
    manualModifiers: [{ ...f.refs[0], abilityId: 'test.modifier', contentVersion: 7 }],
  })
  expect(
    combatControlledAbilityAvailability({ ...f.primeInput, state: primed.state }),
  ).toMatchObject({
    phase: 'primed',
    canCancel: true,
    manualModifiers: f.refs,
  })
  expect(JSON.stringify(f.state)).toBe(before)
  expect(validateCombatAbilityState(JSON.parse(JSON.stringify(primed.state)))).toEqual([])
})

it('release cannot add, omit or replace an attachment and an illegal attempt retains the free prime', () => {
  const f = fixture()
  const primed = primeCombatControlledAbility(f.primeInput).state
  const before = JSON.stringify(primed)
  expect(() => prepareCombatAbilityCommand(f.command(primed, []))).toThrow(
    'controlled-modifier-bundle-mismatch',
  )
  expect(() => commitCombatAbilityCommand(f.command(primed, []))).toThrow(
    'controlled-modifier-bundle-mismatch',
  )
  expect(() =>
    commitCombatAbilityCommand(f.command(primed, [{ ...f.refs[0]!, behaviorId: 'other' }])),
  ).toThrow()
  expect(JSON.stringify(primed)).toBe(before)
  const emptyPrime = primeCombatControlledAbility({
    ...f.primeInput,
    manualModifiers: undefined,
  }).state
  expect(() => commitCombatAbilityCommand(f.command(emptyPrime))).toThrow(
    'controlled-modifier-bundle-mismatch',
  )
})

it('reload releases the same bundle once with aggregate payment and its participating cooldown', () => {
  const f = fixture()
  const primed = JSON.parse(
    JSON.stringify(primeCombatControlledAbility(f.primeInput).state),
  ) as typeof f.state
  const prepared = prepareCombatAbilityCommand(f.command(primed))
  expect(prepared.evaluation.legal).toBe(true)
  expect(prepared.costs).toEqual([
    { resource: 'ap', amount: 18 },
    { resource: 'mp', amount: 3 },
    { resource: 'hp', amount: 1 },
  ])
  const released = commitCombatAbilityCommand(f.command(primed))
  expect(released.state.abilityRuntime!.controlled!.primes).toEqual([])
  expect(released.events).toContainEqual(
    expect.objectContaining({ event: 'ap_spent', amount: 18, remaining: 82 }),
  )
  expect(released.events.filter((event) => event.event === 'combat_action_used')).toHaveLength(1)
  expect(released.events).toContainEqual(
    expect.objectContaining({
      event: 'skill_cooldown_started',
      cooldownKey: 'modifier-clock',
      ownerTurns: 2,
    }),
  )
  expect(() => commitCombatAbilityCommand(f.command(released.state))).toThrow()
  expect(validateCombatAbilityState(released.state)).toEqual([])
})

it('free structural admission does not require current resources, Requirements or ready modifier cooldown', () => {
  const f = fixture()
  const unavailable = captureCombatAbilitySource({
    ...f.modifier,
    definition: {
      schemaVersion: 1,
      behaviors: [
        {
          ...f.modifier.definition.behaviors[0]!,
          costs: [{ resource: 'mp', amount: 1000 }],
          requirements: {
            kind: 'resource-state',
            subject: 'owner',
            resource: 'mp',
            comparison: 'at-least',
            amount: 1000,
          },
        },
      ],
    },
  })
  const initial = reconcileCombatAbilitySources(preparePv1fTurnEconomy(percentageDotEncounter()), [
    f.root,
    unavailable,
  ])
  const state = {
    ...initial,
    tactical: {
      ...initial.tactical,
      battle: {
        ...initial.tactical.battle,
        combatants: initial.tactical.battle.combatants.map((unit) =>
          unit.id === 'actor'
            ? applySkillCooldown(unit, unavailable.definition.behaviors[0]!.cooldown!, {
                actionId: unavailable.abilityId,
                definitionVersion: unavailable.contentVersion,
              }).combatant
            : unit,
        ),
      },
    },
  }
  const primed = primeCombatControlledAbility({ ...f.primeInput, state }).state
  expect(primed.tactical).toEqual(state.tactical)
  expect(() => commitCombatAbilityCommand(f.command(primed))).toThrow()
  expect(primed.abilityRuntime!.controlled!.primes).toHaveLength(1)
})

it('normalizes a two-modifier set and preserves it through no-input turns and cancellation', () => {
  const f = fixture()
  const other = captureCombatAbilitySource({
    ...f.modifier,
    sourceInstanceId: 'z-modifier',
    abilityId: 'test.second-modifier',
  })
  const state = reconcileCombatAbilitySources(f.state, [f.root, f.modifier, other])
  const refs = [...f.refs, { sourceInstanceId: other.sourceInstanceId, behaviorId: 'extra' }]
  let primed = primeCombatControlledAbility({
    ...f.primeInput,
    state,
    manualModifiers: [...refs].reverse(),
  }).state
  expect(
    primed.abilityRuntime!.controlled!.primes[0]!.manualModifiers?.map(
      (row) => row.sourceInstanceId,
    ),
  ).toEqual(refs.map((row) => row.sourceInstanceId))
  expect(prepareCombatAbilityCommand(f.command(primed, refs)).evaluation.legal).toBe(true)
  const captured = structuredClone(primed.abilityRuntime!.controlled)
  for (let i = 0; i < 4; i++)
    primed = finishPv1fTurn(
      reattachStatDrivenCombatBridge(primed, percentageDotEncounter().statBridge),
      'west',
    ).state
  expect(primed.abilityRuntime!.controlled).toEqual(captured)
  expect(primed.abilityRuntime!.usage).toEqual([])
  const cancelled = cancelCombatControlledAbility({
    ...f.primeInput,
    manualModifiers: undefined,
    state: primed,
  }).state
  expect(cancelled.tactical).toEqual(primed.tactical)
  expect(cancelled.abilityRuntime!.controlled!.primes).toEqual([])
  expect(cancelled.abilityRuntime!.controlled!.used).toEqual(captured!.used)
})

it('attachment source removal cancels the whole prime and preserves the once-per-battle admission', () => {
  const f = fixture()
  const primed = primeCombatControlledAbility(f.primeInput).state
  const removed = reconcileCombatAbilitySources(primed, [f.root])
  expect(removed.abilityRuntime!.controlled!.primes).toEqual([])
  expect(removed.abilityRuntime!.controlled!.used).toHaveLength(1)
  expect(validateCombatAbilityState(removed)).toEqual([])
  const restored = reconcileCombatAbilitySources(removed, [f.root, f.modifier])
  expect(() => primeCombatControlledAbility({ ...f.primeInput, state: restored })).toThrow(
    'controlled-prime-used',
  )
})

it.each(['contentVersion', 'abilityId', 'behaviorId', 'sourceInstanceId', 'extra'])(
  'rejects forged persisted attachment %s in both admission and prime records',
  (field) => {
    const f = fixture()
    const primed = primeCombatControlledAbility(f.primeInput).state
    for (const collection of ['primes', 'used'] as const) {
      const saved = JSON.parse(JSON.stringify(primed))
      saved.abilityRuntime.controlled[collection][0].manualModifiers[0][field] =
        field === 'contentVersion' ? 8 : 'forged'
      expect(validateCombatAbilityState(saved)).not.toEqual([])
    }
  },
)

it('rejects malformed, foreign, inactive and incompatible free-prime attachments before any mutation', () => {
  const f = fixture()
  const before = JSON.stringify(f.state)
  for (const manualModifiers of [
    [f.refs[0]!, f.refs[0]!],
    [{ ...f.refs[0]!, sourceInstanceId: 'missing' }],
    [{ ...f.refs[0]!, extra: true }],
    Array.from({ length: 16 }, (_, i) => ({ sourceInstanceId: String(i), behaviorId: 'extra' })),
  ])
    expect(() => primeCombatControlledAbility({ ...f.primeInput, manualModifiers })).toThrow()
  const foreign = {
    ...f.state,
    capturedAbilitySources: [f.root, { ...f.modifier, ownerCombatantId: 'enemy' }],
  }
  expect(() => primeCombatControlledAbility({ ...f.primeInput, state: foreign })).toThrow(
    'modifier-source-owner-mismatch',
  )
  const inactive = {
    ...f.state,
    abilityRuntime: { ...f.state.abilityRuntime!, activeSourceIds: [f.root.sourceInstanceId] },
  }
  expect(() => primeCombatControlledAbility({ ...f.primeInput, state: inactive })).toThrow(
    'modifier-source-inactive',
  )
  const selfRoot = captureCombatAbilitySource({
    ...f.root,
    definition: {
      schemaVersion: 1,
      behaviors: [
        {
          ...f.root.definition.behaviors[0]!,
          classification: 'utility',
          attackFamily: undefined,
        },
      ],
    },
  })
  const incompatible = reconcileCombatAbilitySources(
    preparePv1fTurnEconomy(percentageDotEncounter()),
    [selfRoot, f.modifier],
  )
  expect(() => primeCombatControlledAbility({ ...f.primeInput, state: incompatible })).toThrow(
    'modifier-root-incompatible',
  )
  expect(JSON.stringify(f.state)).toBe(before)
})
