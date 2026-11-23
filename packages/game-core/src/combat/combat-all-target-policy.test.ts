import { expect, it } from 'vitest'
import type { CombatFriendlyFirePolicy } from './actions'
import { validateCombatEncounterState, endCombatTurn } from './actions'
import { selectCurrentFinalFacing } from './board'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { source } from './combat-behavior.test-utils'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import {
  createCurrentStatDrivenCombatEncounterState,
  reattachStatDrivenCombatBridge,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'
import { preparePv1fTurnEconomy, PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from './combat-behavior-runtime'
import { prepareCombatAbilityCommand, commitCombatAbilityCommand } from './combat-ability-command'
import { resolveMatureSkillVersion } from './mature-skills'
import { spawnCombatSummon } from './combat-summons'

function state() {
  const base = percentageDotEncounter()
  let initial: StatDrivenCombatEncounterState = createCurrentStatDrivenCombatEncounterState(
    base,
    base.statBridge.combatants.map((profile) => ({
      ...profile,
      level: 1,
      physicalPower: 20,
      mysticPower: 20,
      criticalChance: 0,
    })),
  )
  initial = {
    ...initial,
    tactical: {
      ...initial.tactical,
      width: 7,
      height: 7,
      tiles: Array.from({ length: 49 }, (_, index) => ({
        position: { x: index % 7, y: Math.floor(index / 7) },
        elevation: 0,
        terrainId: 'open',
      })),
      placements: initial.tactical.placements.map((row) => ({
        ...row,
        facing: 'north' as const,
        position: {
          actor: { x: 3, y: 3 },
          enemy: { x: 4, y: 3 },
          other: { x: 1, y: 1 },
          ally: { x: 3, y: 5 },
        }[row.combatantId]!,
      })),
    },
  }
  const profile = {
    ...resolveMatureSkillVersion('wildwarden.renewing-herbs', 6)!.summonProfile!,
    neverMoves: false,
  }
  for (const [ownerCombatantId, position] of [
    ['actor', { x: 5, y: 5 }],
    ['enemy', { x: 1, y: 5 }],
  ] as const)
    initial = spawnCombatSummon(initial, {
      ownerCombatantId,
      sourceSkillId: 'wildwarden.renewing-herbs',
      sourceSkillVersion: 5,
      profile,
      position,
      facing: 'north',
    }).state
  return preparePv1fTurnEconomy(initial)
}

function input(
  options: {
    policy?: boolean
    friendlyFire?: CombatFriendlyFirePolicy
    direction?: 'push' | 'pull'
    facing?: 'north' | 'east' | 'south' | 'west'
    timing?: 'next-round'
    mixed?: boolean
    distance?: number
  } = {},
) {
  const initial = state()
  initial.tactical.placements = initial.tactical.placements.map((row) =>
    row.combatantId === 'actor' ? { ...row, facing: options.facing ?? 'north' } : row,
  )
  const targeting = {
    geometryVersion: 3 as const,
    categories: ['self' as const],
    kind: 'self' as const,
    shape: { kind: 'single' as const },
    teamPolicy: 'self' as const,
    friendlyFire: options.friendlyFire ?? 'all-units',
    minimumRange: 0,
    maximumRange: 0,
    maximumSelections: 1,
    maximumElevationDifference: 3,
    requiresLineOfSight: false,
    ...(options.policy === false ? {} : { allTargetPolicyVersion: 1 as const }),
  }
  const captured = captureCombatAbilitySource(
    JSON.parse(
      JSON.stringify(
        source(
          {
            targeting,
            costs: [{ resource: 'ap', amount: 10 }],
            accuracy: { kind: 'fixed', chanceBasisPoints: 10000 },
            effects: [
              {
                id: 'hit',
                timing: options.timing,
                payload: {
                  type: 'damage',
                  amount: 20,
                  target: options.mixed ? 'enemy' : 'all',
                  scaling: { source: 'physical-power', coefficientBasisPoints: 2500 },
                  recipient: 'affected-units',
                  defenseKind: 'armor',
                },
              },
              {
                id: 'push',
                timing: options.timing,
                payload: {
                  type: 'displace',
                  target: 'all',
                  distance: options.distance ?? 1,
                  direction: options.direction ?? 'push',
                  recipient: 'affected-units',
                },
              },
            ],
          },
          'all-source',
        ),
      ),
    ),
  )
  const current = reattachStatDrivenCombatBridge(
    reconcileCombatAbilitySources(initial, [captured]),
    initial.statBridge,
  )
  return {
    state: current,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source: captured },
    selection: { kind: 'self' as const },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(current, captured),
  }
}
const recipients = (events: readonly { event: string; targetCombatantId?: string | null }[]) =>
  events
    .filter((event) => event.event === 'damage_applied')
    .map((event) => event.targetCombatantId!)

it('characterizes unmarked current bridge4 stat-scaled explicit All, independently of inherited enemy filters', () => {
  const cast = input({ policy: false, friendlyFire: 'enemies-only' })
  expect(cast.state.statBridge.schemaVersion).toBe(4)
  const out = commitCombatAbilityCommand(cast)
  expect(recipients(out.events)).toHaveLength(6)
  expect(recipients(out.events)).toContain('actor')
  expect(out.events).toContainEqual(
    expect.objectContaining({
      event: 'displacement_failed',
      combatantId: 'actor',
      reason: 'direction-undefined',
    }),
  )
})

it.each([
  ['all-units', 6, true],
  ['enemies-only', 3, false],
  ['allies-only', 3, true],
  ['all-except-actor', 5, false],
] as const)(
  'uses only explicit %s for global All recipient membership',
  (friendlyFire, count, self) => {
    const cast = input({ friendlyFire })
    const quote = prepareCombatAbilityCommand(cast)
    expect(quote.evaluation.legal).toBe(true)
    const out = commitCombatAbilityCommand(cast)
    expect(recipients(out.events)).toHaveLength(count)
    expect(recipients(out.events).includes('actor')).toBe(self)
    if (friendlyFire === 'enemies-only') expect(recipients(out.events)).not.toContain('ally')
    if (friendlyFire === 'allies-only') expect(recipients(out.events)).not.toContain('enemy')
  },
)

it.each([
  ['north', 0, -1],
  ['east', 1, 0],
  ['south', 0, 1],
  ['west', -1, 0],
] as const)('moves the caster forward/backward along captured %s facing', (facing, dx, dy) => {
  for (const direction of ['push', 'pull'] as const) {
    const cast = input({ facing, direction })
    const out = commitCombatAbilityCommand(cast)
    const sign = direction === 'push' ? 1 : -1
    const expected = { x: 3 + dx * sign, y: 3 + dy * sign }
    const blocked = expected.x === 4 && expected.y === 3
    expect(
      out.state.tactical.placements.find((row) => row.combatantId === 'actor')!.position,
    ).toEqual(blocked ? { x: 3, y: 3 } : expected)
    if (blocked)
      expect(out.events).toContainEqual(
        expect.objectContaining({
          event: 'displacement_failed',
          combatantId: 'actor',
          reason: 'occupied-tile',
        }),
      )
  }
})

it('freezes the caster origin before moving any recipient in an All packet', () => {
  const out = commitCombatAbilityCommand(input({ facing: 'west' }))
  expect(
    out.state.tactical.placements.find((row) => row.combatantId === 'actor')!.position,
  ).toEqual({ x: 2, y: 3 })
  // From original (3,3), ally directly south moves south. A moved origin (2,3) must not skew it.
  expect(out.state.tactical.placements.find((row) => row.combatantId === 'ally')!.position).toEqual(
    { x: 3, y: 6 },
  )
  expect(
    out.state.tactical.placements.find((row) => row.combatantId === 'other')!.position,
  ).toEqual({ x: 0, y: 1 })
})

it('pins opted-in displacement origin and facing across pending save/reload', () => {
  const cast = input({ timing: 'next-round', facing: 'north' })
  const queued = commitCombatAbilityCommand(cast).state
  let restored = JSON.parse(JSON.stringify(queued))
  expect(validateCombatEncounterState(restored)).toEqual([])
  restored.tactical.placements = restored.tactical.placements.map(
    (row: { combatantId: string; facing: string }) =>
      row.combatantId === 'actor' ? { ...row, facing: 'south' } : row,
  )
  const events = []
  for (let turn = 0; turn < 6; turn++) {
    const next = endCombatTurn(
      { ...restored, tactical: selectCurrentFinalFacing(restored.tactical, 'south').state },
      PV1F_COMBAT_CONTENT,
    )
    events.push(...next.events)
    restored = next.state
  }
  expect(events).toContainEqual(
    expect.objectContaining({
      event: 'combatant_displaced',
      combatantId: 'actor',
      to: { x: 3, y: 2 },
    }),
  )
  const invalid = JSON.parse(JSON.stringify(queued))
  invalid.pendingEffects.find(
    (row: { allDisplacement?: unknown }) => row.allDisplacement,
  ).allDisplacement.facing = 'diagonal'
  expect(validateCombatEncounterState(invalid)).not.toEqual([])
})

it('rejects unsupported targeting policy and unknown mechanical fields during capture', () => {
  const original = input().root.source
  for (const targeting of [
    { ...original.definition.behaviors[0]!.targeting, allTargetPolicyVersion: 2 },
    {
      ...original.definition.behaviors[0]!.targeting,
      allTargetPolicyVersion: undefined,
      unknownAllPolicy: 1,
    },
  ])
    expect(() =>
      captureCombatAbilitySource(
        JSON.parse(
          JSON.stringify({
            ...original,
            definition: {
              ...original.definition,
              behaviors: [{ ...original.definition.behaviors[0], targeting }],
            },
          }),
        ),
      ),
    ).toThrow()
})

it('keeps mixed Enemy damage local while All Push uses its independent opted-in team filter', () => {
  const cast = input({ mixed: true })
  const out = commitCombatAbilityCommand(cast)
  expect(recipients(out.events)).toEqual([]) // The shared aim is Self; Enemy damage has no local footprint.
  expect(out.events).toContainEqual(
    expect.objectContaining({ event: 'combatant_displaced', combatantId: 'actor' }),
  )
})

it('retains terrain and movement restrictions for facing-based self displacement', () => {
  const cast = input()
  const blocked = {
    ...cast,
    state: reattachStatDrivenCombatBridge(
      {
        ...cast.state,
        tactical: {
          ...cast.state.tactical,
          terrains: [...cast.state.tactical.terrains, { id: 'wall', traversalCost: null }],
          tiles: cast.state.tactical.tiles.map((tile) =>
            tile.position.x === 3 && tile.position.y === 2 ? { ...tile, terrainId: 'wall' } : tile,
          ),
        },
      },
      cast.state.statBridge,
    ),
  }
  blocked.context = combatAbilityCommandContext(blocked.state, blocked.root.source)
  const out = commitCombatAbilityCommand(blocked)
  expect(out.events).toContainEqual(
    expect.objectContaining({
      event: 'displacement_failed',
      combatantId: 'actor',
      reason: 'blocked-terrain',
    }),
  )
})

it('preserves opted-in All team membership through an actual automatic captured action', () => {
  const cast = input({ friendlyFire: 'enemies-only' })
  const reaction = captureCombatAbilitySource({
    ...cast.root.source,
    sourceInstanceId: 'automatic-all',
    abilityId: 'test.auto-all',
    ownerCombatantId: 'enemy',
    definition: {
      schemaVersion: 1,
      behaviors: [
        {
          ...cast.root.source.definition.behaviors[0]!,
          activation: 'automatic',
          costs: [],
          activationLimits: ['once-per-action'],
          requirementMode: 'simple',
          automaticTrigger: 'damage-taken',
          requirements: null,
          effects: cast.root.source.definition.behaviors[0]!.effects.filter(
            (effect) => effect.payload.type === 'damage',
          ),
        },
      ],
    },
  })
  const incoming = captureCombatAbilitySource(
    source({ costs: [], accuracy: { kind: 'fixed', chanceBasisPoints: 10000 } }, 'incoming'),
  )
  const current = reattachStatDrivenCombatBridge(
    reconcileCombatAbilitySources(cast.state, [incoming, reaction]),
    cast.state.statBridge,
  )
  const out = commitCombatAbilityCommand({
    state: current,
    actorId: 'actor',
    root: { kind: 'canonical', source: incoming },
    selection: { kind: 'unit', combatantId: 'enemy' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(current, incoming),
  })
  expect(out.events).toContainEqual(
    expect.objectContaining({ event: 'combat_action_used', actionId: 'test.auto-all' }),
  )
  const hits = out.events.filter(
    (event) => event.event === 'damage_applied' && event.actionId === 'test.auto-all',
  )
  expect(hits).toHaveLength(3)
  expect(hits).not.toContainEqual(expect.objectContaining({ targetCombatantId: 'enemy' }))
})

it.each([false, true])(
  'captures Ground, Self and All displacement through queued reload with caster walking=%s',
  (walked) => {
    for (const target of ['ground', 'self', 'all'] as const) {
      const cast = input({ timing: 'next-round', direction: 'pull', distance: 4, facing: 'north' })
      const original = cast.root.source
      const behavior = original.definition.behaviors[0]!
      const captured = captureCombatAbilitySource({
        ...original,
        sourceInstanceId: `queued-${target}`,
        definition: {
          schemaVersion: 1,
          behaviors: [
            {
              ...behavior,
              accuracy: target === 'ground' ? behavior.accuracy : undefined,
              targeting:
                target === 'ground'
                  ? {
                      ...behavior.targeting!,
                      kind: 'ground-tile',
                      categories: ['ground'],
                      teamPolicy: 'any',
                      shape: { kind: 'single' },
                      maximumRange: 2,
                    }
                  : behavior.targeting,
              effects: behavior.effects.flatMap((row) =>
                row.payload.type === 'displace'
                  ? [
                      {
                        ...row,
                        payload: {
                          ...row.payload,
                          target: target === 'self' ? ('self' as const) : ('all' as const),
                          recipient:
                            target === 'self' ? ('actor' as const) : ('affected-units' as const),
                        },
                      },
                    ]
                  : [],
              ),
            },
          ],
        },
      })
      const current = reattachStatDrivenCombatBridge(
        reconcileCombatAbilitySources({ ...cast.state, displacementOriginPolicyVersion: 1 }, [
          captured,
        ]),
        cast.state.statBridge,
      )
      const queued = commitCombatAbilityCommand({
        ...cast,
        state: current,
        root: { kind: 'canonical', source: captured },
        selection:
          target === 'ground' ? { kind: 'tile', position: { x: 3, y: 2 } } : { kind: 'self' },
        context: combatAbilityCommandContext(current, captured),
      }).state
      let restored = JSON.parse(JSON.stringify(queued))
      const pending = restored.pendingEffects.find(
        (row: { effect: { type: string } }) => row.effect.type === 'displace',
      )
      expect(pending.allDisplacement).toEqual({
        position: target === 'ground' ? { x: 3, y: 2 } : { x: 3, y: 3 },
        facing: 'north',
        ...(target === 'ground' ? { groundAnchor: true } : {}),
      })
      expect(validateCombatEncounterState(restored)).toEqual([])
      const invalid = JSON.parse(JSON.stringify(restored))
      invalid.pendingEffects.find(
        (row: { effect: { type: string } }) => row.effect.type === 'displace',
      ).allDisplacement.groundAnchor = false
      expect(validateCombatEncounterState(invalid)).not.toEqual([])
      restored.tactical.placements = restored.tactical.placements.map(
        (row: { combatantId: string }) =>
          row.combatantId === 'actor'
            ? {
                ...row,
                facing: 'south',
                ...(target === 'ground'
                  ? { position: { x: 3, y: 4 } }
                  : walked
                    ? { position: { x: 2, y: 3 } }
                    : {}),
              }
            : row,
      )
      const events = []
      for (let turn = 0; turn < 6; turn++) {
        const next = endCombatTurn(
          { ...restored, tactical: selectCurrentFinalFacing(restored.tactical, 'south').state },
          PV1F_COMBAT_CONTENT,
        )
        restored = next.state
        events.push(...next.events)
      }
      expect(events).toContainEqual(
        expect.objectContaining({
          event: 'combatant_displaced',
          combatantId: 'actor',
          to: target === 'ground' ? { x: 3, y: 2 } : { x: walked ? 2 : 3, y: 0 },
        }),
      )
    }
  },
)
