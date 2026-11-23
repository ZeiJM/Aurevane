import { describe, expect, it } from 'vitest'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { reconcileCombatAbilitySources } from './combat-behavior-runtime'
import { source } from './combat-behavior.test-utils'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import {
  finishPv1fTurn,
  preparePv1fTurnEconomy,
  executePv1fAction,
  PV1F_COMBAT_CONTENT,
} from './pv1f-action-economy'
import { activateCombatAbilitySources, commitCombatAbilityCommand } from './combat-ability-command'
import { combatAbilityCommandContext } from './combat-behavior-runtime'
import { capturedResonanceAbilitySource } from './combat-action-source'
import { resolveResonanceForPair } from './resonance'
import { automaticAbilityTargetCandidates } from './combat-automatic-targets'
import {
  validateAbilityDefinition,
  type AbilityBehavior,
  type AutomaticAbilityTargetSubject,
} from './combat-definition'

function resonance(
  rule: AutomaticAbilityTargetSubject,
  classification: AbilityBehavior['classification'] = 'attack',
  ground = false,
) {
  const ally = rule.endsWith('ally')
  return captureCombatAbilitySource({
    ...source(
      {
        id: 'automatic',
        activation: 'automatic',
        requirementMode: 'simple',
        automaticTrigger: 'turn-started',
        automaticTarget: { subject: rule },
        classification,
        attackFamily: classification === 'attack' ? 'physical' : undefined,
        costs: [{ resource: 'mp', amount: 1 }],
        cooldown: { key: 'selector', ownerTurns: 1 },
        targeting: {
          geometryVersion: 3,
          kind: ground ? 'ground-tile' : 'unit',
          teamPolicy: ground ? 'any' : ally ? 'ally' : 'enemy',
          categories: ground ? ['ground'] : [ally ? 'ally' : 'enemy'],
          friendlyFire: 'all-units',
          shape: { kind: 'single' },
          minimumRange: 0,
          maximumRange: 4,
          requiresLineOfSight: false,
          maximumElevationDifference: null,
          maximumSelections: 1,
        },
        effects: [
          {
            id: 'effect',
            timing: 'instant',
            payload:
              classification === 'attack'
                ? {
                    type: 'damage',
                    recipient: 'affected-units',
                    amount: 7,
                    ...(ground ? { target: 'ground' as const } : {}),
                  }
                : classification === 'recovery'
                  ? {
                      type: 'healing',
                      recipient: 'affected-units',
                      amount: 7,
                      ...(ground ? { target: 'ground' as const } : {}),
                    }
                  : {
                      type: 'apply-status',
                      recipient: 'affected-units',
                      statusId: 'guarded',
                      stacks: 1,
                      durationTurns: 2,
                      ...(ground ? { target: 'ground' as const } : {}),
                    },
          },
        ],
      },
      'resonance.selector',
    ),
    ownerCombatantId: 'enemy',
    abilityId: 'resonance.selector',
    sourceKind: 'resonance',
  })
}
function battle(captured: ReturnType<typeof resonance>) {
  const base = percentageDotEncounter()
  return reconcileCombatAbilitySources(
    preparePv1fTurnEconomy({
      ...base,
      tactical: {
        ...base.tactical,
        battle: {
          ...base.tactical.battle,
          combatants: base.tactical.battle.combatants.map((unit) => ({ ...unit, hp: 500 })),
        },
      },
    }),
    [captured],
  ) as typeof base
}
function configure(captured: ReturnType<typeof resonance>, patch: Partial<AbilityBehavior>) {
  return captureCombatAbilitySource({
    ...captured,
    definition: {
      ...captured.definition,
      behaviors: [{ ...captured.definition.behaviors[0]!, ...patch }],
    },
  })
}

describe('authored automatic Resonance selection', () => {
  it.each([
    ['owner', 'loss'],
    ['owner', 'crossing'],
    ['selected', 'loss'],
    ['selected', 'crossing'],
  ] as const)(
    'preserves %s-specific HP %s mutation evidence for selector reactions',
    (subject, condition) => {
      for (const rule of ['selected', 'nearest-enemy'] as const) {
        if (subject === 'owner' && rule === 'selected') continue
        const captured = configure(resonance('nearest-enemy', 'recovery'), {
          automaticTarget: { subject: rule },
          requirementMode: undefined,
          automaticTrigger: undefined,
          cooldown: null,
          requirements: {
            kind: 'all',
            children: [
              { kind: 'event', eventType: 'damage_applied', phase: 'after' },
              condition === 'loss'
                ? {
                    kind: 'resource-change',
                    subject,
                    resource: 'hp',
                    direction: 'lost',
                    minimumAmount: 1,
                  }
                : {
                    kind: 'resource-threshold-crossing',
                    subject,
                    resource: 'hp',
                    direction: 'below',
                    thresholdBasisPoints: 5000,
                  },
            ],
          },
        })
        const reaction = captureCombatAbilitySource({
          ...captured,
          ownerCombatantId: subject === 'owner' ? 'enemy' : 'actor',
        })
        const incoming = captureCombatAbilitySource(
          source(
            {
              costs: [],
              effects: [
                {
                  id: 'damage',
                  timing: 'instant',
                  payload: { type: 'damage', recipient: 'primary-unit', amount: 10 },
                },
              ],
            },
            'selector.mutation-incoming',
          ),
        )
        const state = reconcileCombatAbilitySources(battle(reaction), [reaction, incoming])
        if (condition === 'crossing')
          state.tactical.battle.combatants = state.tactical.battle.combatants.map((unit) =>
            unit.id === 'enemy' ? { ...unit, hp: 505 } : unit,
          )
        const out = commitCombatAbilityCommand({
          state,
          actorId: 'actor',
          root: { kind: 'canonical', source: incoming },
          selection: { kind: 'unit', combatantId: 'enemy' },
          content: PV1F_COMBAT_CONTENT,
          context: combatAbilityCommandContext(state, incoming),
        })
        expect(out.events, `${subject}/${condition}/${rule}`).toContainEqual(
          expect.objectContaining({
            event: 'healing_applied',
            sourceCombatantId: reaction.ownerCombatantId,
            targetCombatantId: subject === 'owner' ? 'actor' : 'enemy',
            amount: 7,
          }),
        )
      }
    },
  )
  it.each(['loss', 'crossing'] as const)(
    "does not graft a damaged unit's %s evidence onto an undamaged nearer candidate",
    (condition) => {
      const captured = configure(resonance('nearest-enemy', 'recovery'), {
        requirementMode: undefined,
        automaticTrigger: undefined,
        cooldown: null,
        requirements: {
          kind: 'all',
          children: [
            { kind: 'event', eventType: 'damage_applied', phase: 'after' },
            condition === 'loss'
              ? {
                  kind: 'resource-change',
                  subject: 'selected',
                  resource: 'hp',
                  direction: 'lost',
                  minimumAmount: 1,
                }
              : {
                  kind: 'resource-threshold-crossing',
                  subject: 'selected',
                  resource: 'hp',
                  direction: 'below',
                  thresholdBasisPoints: 5000,
                },
          ],
        },
      })
      const reaction = captureCombatAbilitySource({ ...captured, ownerCombatantId: 'actor' })
      const incoming = captureCombatAbilitySource(
        source(
          {
            costs: [],
            effects: [
              {
                id: 'damage',
                timing: 'instant',
                payload: { type: 'damage', recipient: 'primary-unit', amount: 10 },
              },
            ],
          },
          'selector.mutation-incoming',
        ),
      )
      const state = reconcileCombatAbilitySources(battle(reaction), [reaction, incoming])
      state.tactical.battle.combatants = state.tactical.battle.combatants.map((unit) =>
        unit.id === 'enemy'
          ? { ...unit, hp: 100 }
          : condition === 'crossing' && unit.id === 'other'
            ? { ...unit, hp: 505 }
            : unit,
      )
      const out = commitCombatAbilityCommand({
        state,
        actorId: 'actor',
        root: { kind: 'canonical', source: incoming },
        selection: { kind: 'unit', combatantId: 'other' },
        content: PV1F_COMBAT_CONTENT,
        context: combatAbilityCommandContext(state, incoming),
      })
      expect(out.events).toContainEqual(
        expect.objectContaining({
          event: 'healing_applied',
          sourceCombatantId: 'actor',
          targetCombatantId: 'other',
          amount: 7,
        }),
      )
      expect(out.events).not.toContainEqual(
        expect.objectContaining({ event: 'healing_applied', targetCombatantId: 'enemy' }),
      )
      expect(out.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.hp).toBe(100)
    },
  )
  it('executes a current validated Resonance envelope through pair-bound capture and reload', () => {
    const current = resolveResonanceForPair('wildwarden', 'edgedancer')!
    const authored = resonance('lowest-hp-enemy')
    const captured = capturedResonanceAbilitySource(
      percentageDotEncounter(),
      'enemy',
      {
        ...current,
        id: authored.abilityId,
        ability: authored.definition,
      },
      current.disciplinePair,
    )!
    expect(captured.sourceInstanceId).toContain('wildwarden')
    expect(captured.sourceInstanceId).toContain('edgedancer')
    const state = battle(captureCombatAbilitySource(JSON.parse(JSON.stringify(captured))))
    state.tactical.battle.combatants = state.tactical.battle.combatants.map((unit) =>
      unit.id === 'ally' ? { ...unit, hp: 100 } : unit,
    )
    const out = finishPv1fTurn(state, 'west')
    expect(out.events).toContainEqual(
      expect.objectContaining({
        event: 'damage_applied',
        sourceCombatantId: 'enemy',
        targetCombatantId: 'ally',
      }),
    )
    expect(out.state.capturedAbilitySources).toContainEqual(captured)
  })
  it.each(['attack', 'utility', 'recovery'] as const)(
    'supports Enemy, Ally and Ground delivery for %s',
    (purpose) => {
      for (const rule of [
        'nearest-enemy',
        'nearest-ally',
        'lowest-hp-enemy',
        'lowest-hp-ally',
      ] as const) {
        for (const ground of [false, true]) {
          const out = finishPv1fTurn(battle(resonance(rule, purpose, ground)), 'west')
          expect(out.events).toContainEqual(
            expect.objectContaining({
              event: 'combat_action_used',
              actorId: 'enemy',
              actionId: 'resonance.selector',
            }),
          )
          expect(out.events).toContainEqual(
            expect.objectContaining({
              event:
                purpose === 'attack'
                  ? 'damage_applied'
                  : purpose === 'recovery'
                    ? 'healing_applied'
                    : 'status_applied',
              sourceCombatantId: 'enemy',
              targetCombatantId: rule.endsWith('ally') ? 'other' : 'actor',
            }),
          )
          expect(out.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.mp).toBe(
            19,
          )
        }
      }
    },
  )
  it('orders absolute HP before distance, excludes dead/self anchors and breaks ties by ID', () => {
    const state = battle(resonance('lowest-hp-enemy'))
    state.tactical.battle.combatants = state.tactical.battle.combatants.map((unit) => ({
      ...unit,
      hp: unit.id === 'ally' ? 100 : unit.id === 'enemy' ? 1 : 500,
      maxHp: unit.id === 'ally' ? 100 : unit.maxHp,
    }))
    expect(automaticAbilityTargetCandidates(state, 'enemy', 'lowest-hp-enemy')).toEqual([
      'ally',
      'actor',
    ])
    expect(automaticAbilityTargetCandidates(state, 'enemy', 'lowest-hp-ally')).toEqual(['other'])
    state.tactical.battle.combatants = state.tactical.battle.combatants.map((unit) =>
      unit.id === 'ally' ? { ...unit, hp: 0 } : unit,
    )
    expect(automaticAbilityTargetCandidates(state, 'enemy', 'lowest-hp-enemy')).toEqual(['actor'])
    state.tactical.battle.combatants = state.tactical.battle.combatants.map((unit) => ({
      ...unit,
      hp: 500,
    }))
    state.tactical.placements = state.tactical.placements.map((row) =>
      row.combatantId === 'ally' ? { ...row, position: { x: 2, y: 2 } } : row,
    )
    expect(automaticAbilityTargetCandidates(state, 'enemy', 'nearest-enemy')).toEqual([
      'actor',
      'ally',
    ])
  })
  it.each(['selected-requirement', 'elevation', 'invisible', 'LOS'] as const)(
    'skips a nearest anchor rejected by %s admission',
    (reason) => {
      const captured = resonance('nearest-enemy')
      const behavior = captured.definition.behaviors[0]!
      const changed = configure(captured, {
        ...(reason === 'selected-requirement'
          ? {
              requirements: {
                kind: 'resource-state',
                subject: 'selected',
                resource: 'hp',
                comparison: 'less-than',
                basisPoints: 2000,
              } as const,
            }
          : {}),
        targeting: {
          ...behavior.targeting!,
          maximumElevationDifference: reason === 'elevation' ? 0 : null,
          requiresLineOfSight: reason === 'LOS',
        },
      })
      const state = battle(changed)
      if (reason === 'selected-requirement')
        state.tactical.battle.combatants = state.tactical.battle.combatants.map((unit) =>
          unit.id === 'ally' ? { ...unit, hp: 100 } : unit,
        )
      if (reason === 'elevation')
        state.tactical.tiles = state.tactical.tiles.map((tile) =>
          tile.position.x === 1 && tile.position.y === 1 ? { ...tile, elevation: 3 } : tile,
        )
      if (reason === 'invisible')
        state.statusState = state.statusState.map((row) =>
          row.combatantId === 'actor'
            ? {
                ...row,
                statuses: [
                  {
                    statusId: 'invisible',
                    statusVersion: 1,
                    sourceCombatantId: 'actor',
                    stacks: 1,
                    remainingOwnerTurnStarts: 2,
                  },
                ],
              }
            : row,
        )
      if (reason === 'LOS') {
        state.tactical.terrains = [...state.tactical.terrains, { id: 'wall', traversalCost: null }]
        state.tactical.tiles = state.tactical.tiles.map((tile) =>
          tile.position.x === 2 && tile.position.y === 1 ? { ...tile, terrainId: 'wall' } : tile,
        )
        const positions = { enemy: { x: 3, y: 1 }, other: { x: 4, y: 1 }, ally: { x: 3, y: 3 } }
        state.tactical.placements = state.tactical.placements.map((row) =>
          row.combatantId in positions
            ? { ...row, position: positions[row.combatantId as keyof typeof positions] }
            : row,
        )
      }
      const out = finishPv1fTurn(state, 'west')
      expect(out.events).toContainEqual(
        expect.objectContaining({
          event: 'damage_applied',
          sourceCombatantId: 'enemy',
          targetCombatantId: 'ally',
        }),
      )
      expect(out.events).not.toContainEqual(
        expect.objectContaining({ event: 'damage_applied', targetCombatantId: 'actor' }),
      )
    },
  )
  it.each(['no-range', 'unaffordable'] as const)(
    'suppresses %s without RNG, payment or cooldown changes',
    (reason) => {
      const captured = resonance('nearest-enemy')
      const state = battle(
        reason === 'no-range'
          ? configure(captured, {
              targeting: { ...captured.definition.behaviors[0]!.targeting!, maximumRange: 0 },
            })
          : captured,
      )
      if (reason === 'unaffordable')
        state.tactical.battle.combatants = state.tactical.battle.combatants.map((unit) =>
          unit.id === 'enemy' ? { ...unit, mp: 0 } : unit,
        )
      const before = JSON.stringify(state)
      const out = finishPv1fTurn(state, 'west')
      expect(out.events).not.toContainEqual(
        expect.objectContaining({ event: 'combat_action_used', actionId: 'resonance.selector' }),
      )
      expect(out.state.tactical.battle.rng).toEqual(state.tactical.battle.rng)
      expect(out.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.mp).toBe(
        reason === 'unaffordable' ? 0 : 20,
      )
      expect(out.events).not.toContainEqual(
        expect.objectContaining({
          event: 'skill_cooldown_started',
          actionId: 'resonance.selector',
        }),
      )
      expect(JSON.stringify(state)).toBe(before)
    },
  )
  it('uses its rule on a real off-turn reaction and keeps the owner as caster', () => {
    const captured = configure(resonance('nearest-ally', 'utility'), {
      automaticTrigger: 'damage-taken',
    })
    const out = executePv1fAction(battle(captured), 'basic.attack.unarmed.basic', {
      kind: 'unit',
      combatantId: 'enemy',
    })
    expect(out.events).toContainEqual(
      expect.objectContaining({
        event: 'status_applied',
        sourceCombatantId: 'enemy',
        targetCombatantId: 'other',
        statusId: 'guarded',
      }),
    )
    expect(out.state.tactical.battle.currentTurn!.combatantId).toBe('actor')
    expect(out.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.mp).toBe(19)
  })
  it('keeps source-only Self siblings on the owner when aiming at an enemy', () => {
    const captured = resonance('nearest-enemy')
    const next = configure(captured, {
      effects: [
        ...captured.definition.behaviors[0]!.effects,
        {
          id: 'self-heal',
          timing: 'instant',
          payload: { type: 'healing', recipient: 'actor', target: 'self', amount: 11 },
        },
      ],
    })
    const out = finishPv1fTurn(battle(next), 'west')
    expect(out.events).toContainEqual(
      expect.objectContaining({
        event: 'healing_applied',
        sourceCombatantId: 'enemy',
        targetCombatantId: 'enemy',
      }),
    )
    expect(out.events).not.toContainEqual(
      expect.objectContaining({ event: 'healing_applied', targetCombatantId: 'actor' }),
    )
  })
  it('admits advanced event-bound selectors without rewriting their trigger predicates', () => {
    const captured = resonance('nearest-enemy')
    const next = configure(captured, {
      requirementMode: undefined,
      automaticTrigger: undefined,
      requirements: {
        kind: 'all',
        children: [
          { kind: 'event', eventType: 'turn_started', phase: 'after' },
          {
            kind: 'subject-relation',
            subject: 'triggering',
            otherSubject: 'owner',
            relation: 'same-unit',
          },
          {
            kind: 'resource-state',
            subject: 'selected',
            resource: 'hp',
            comparison: 'less-than',
            amount: 200,
          },
        ],
      },
    })
    const state = battle(next)
    state.tactical.battle.combatants = state.tactical.battle.combatants.map((unit) =>
      unit.id === 'ally' ? { ...unit, hp: 100 } : unit,
    )
    const out = finishPv1fTurn(state, 'west')
    expect(out.events).toContainEqual(
      expect.objectContaining({
        event: 'damage_applied',
        sourceCombatantId: 'enemy',
        targetCombatantId: 'ally',
      }),
    )
    expect(
      out.state.capturedAbilitySources!.find(
        (source) => source.sourceInstanceId === next.sourceInstanceId,
      ),
    ).toEqual(next)
  })
  it('uses requirements-satisfied selection and pays once under an authored activation limit', () => {
    const captured = configure(resonance('nearest-enemy'), {
      automaticTrigger: 'requirements-met',
      cooldown: null,
      activationLimits: ['once-per-battle'],
      requirements: {
        kind: 'resource-state',
        subject: 'selected',
        resource: 'hp',
        comparison: 'less-than',
        basisPoints: 2000,
      },
    })
    const state = battle(captured)
    state.tactical.battle.combatants = state.tactical.battle.combatants.map((unit) =>
      unit.id === 'ally' ? { ...unit, hp: 100 } : unit,
    )
    const first = activateCombatAbilitySources(state, [captured], PV1F_COMBAT_CONTENT)
    expect(first.events).toContainEqual(
      expect.objectContaining({
        event: 'damage_applied',
        sourceCombatantId: 'enemy',
        targetCombatantId: 'ally',
      }),
    )
    const second = activateCombatAbilitySources(first.state, [captured], PV1F_COMBAT_CONTENT)
    expect(second.events).toEqual([])
    expect(second.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.mp).toBe(19)
  })
  it('rejects selectors for Self-only, Circle/All and unsupported target forms without migrating causal captures', () => {
    const captured = resonance('nearest-enemy')
    const behavior = captured.definition.behaviors[0]!
    for (const targeting of [
      {
        ...behavior.targeting!,
        kind: 'self' as const,
        teamPolicy: 'self' as const,
        categories: ['self' as const],
        maximumRange: 0,
      },
      { ...behavior.targeting!, shape: { kind: 'circle' as const, radius: 2 } },
      { ...behavior.targeting!, shape: { kind: 'all' as const } },
      { ...behavior.targeting!, kind: 'empty-tile' as const },
    ])
      expect(
        validateAbilityDefinition({
          ...captured.definition,
          behaviors: [{ ...behavior, targeting }],
        }),
      ).toContainEqual(expect.objectContaining({ code: 'invalid-automatic-target' }))
    const historical = configure(captured, {
      automaticTarget: { subject: 'triggering' },
      automaticTrigger: 'damage-taken',
    })
    expect(captureCombatAbilitySource(JSON.parse(JSON.stringify(historical)))).toEqual(historical)
    expect(finishPv1fTurn(battle(historical), 'west').events).not.toContainEqual(
      expect.objectContaining({ event: 'combat_action_used', actionId: 'resonance.selector' }),
    )
  })
  it.each([
    ['nearest-enemy', 'attack', 'actor'],
    ['nearest-ally', 'utility', 'other'],
    ['lowest-hp-ally', 'recovery', 'other'],
  ] as const)(
    'executes %s for %s on the actual owner turn-start boundary',
    (rule, purpose, target) => {
      const captured = resonance(rule, purpose)
      const state = battle(captured)
      const out = finishPv1fTurn(state, 'west')
      expect(out.events).toContainEqual(
        expect.objectContaining({
          event: 'combat_action_used',
          actorId: 'enemy',
          actionId: 'resonance.selector',
        }),
      )
      expect(out.events).toContainEqual(
        expect.objectContaining({
          event:
            purpose === 'attack'
              ? 'damage_applied'
              : purpose === 'recovery'
                ? 'healing_applied'
                : 'status_applied',
          sourceCombatantId: 'enemy',
          targetCombatantId: target,
        }),
      )
      expect(out.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.mp).toBe(19)
      expect(out.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.mp).toBe(20)
    },
  )
  it('aims Ground beneath the selected anchor without turning that unit into the caster', () => {
    const out = finishPv1fTurn(battle(resonance('nearest-enemy', 'attack', true)), 'west')
    expect(out.events).toContainEqual(
      expect.objectContaining({
        event: 'damage_applied',
        sourceCombatantId: 'enemy',
        targetCombatantId: 'actor',
      }),
    )
  })
  it.each([false, true])('skips a Line anchor outside its actual lane (Ground: %s)', (ground) => {
    const captured = resonance('lowest-hp-enemy', 'attack', ground)
    const next = configure(captured, {
      targeting: {
        ...captured.definition.behaviors[0]!.targeting!,
        shape: { kind: 'line', length: 1 },
        maximumRange: 1,
      },
    })
    const state = battle(next)
    state.tactical.battle.combatants = state.tactical.battle.combatants.map((unit) =>
      unit.id === 'actor' ? { ...unit, hp: 1 } : unit,
    )
    state.tactical.placements = state.tactical.placements.map((row) =>
      row.combatantId === 'actor'
        ? { ...row, position: { x: 0, y: 1 } }
        : row.combatantId === 'ally'
          ? { ...row, position: { x: 2, y: 2 } }
          : row,
    )
    const out = finishPv1fTurn(state, 'west')
    expect(out.events).toContainEqual(
      expect.objectContaining({
        event: 'damage_applied',
        sourceCombatantId: 'enemy',
        targetCombatantId: 'ally',
      }),
    )
    expect(out.events).not.toContainEqual(
      expect.objectContaining({ event: 'damage_applied', targetCombatantId: 'actor' }),
    )
  })
  it('skips the nearest candidate when canonical minimum range excludes it', () => {
    const captured = resonance('nearest-enemy')
    const behavior = captured.definition.behaviors[0]!
    const next = captureCombatAbilitySource({
      ...captured,
      definition: {
        ...captured.definition,
        behaviors: [{ ...behavior, targeting: { ...behavior.targeting!, minimumRange: 2 } }],
      },
    })
    const out = finishPv1fTurn(battle(next), 'west')
    expect(out.events).toContainEqual(
      expect.objectContaining({
        event: 'damage_applied',
        targetCombatantId: 'ally',
        sourceCombatantId: 'enemy',
      }),
    )
    expect(out.events).not.toContainEqual(
      expect.objectContaining({ event: 'damage_applied', targetCombatantId: 'actor' }),
    )
  })
})
