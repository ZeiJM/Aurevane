import { describe, expect, it } from 'vitest'
import { validateCombatEncounterState } from './actions'
import {
  parseAbilityDefinition,
  validateAbilityDefinition,
  type AbilityEffect,
} from './combat-definition'
import { source } from './combat-behavior.test-utils'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { capturedMatureSkillAbilitySource } from './combat-action-source'
import {
  chooseBuildAwareRecruitAiDecision,
  executeBuildAwareRecruitAiAction,
} from './recruit-ai-build'
import { reconcileCombatAbilitySources } from './combat-behavior-runtime'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { resolveMatureSkillVersion, type MatureSkillDefinition } from './mature-skills'
import {
  createCurrentStatDrivenCombatEncounterState,
  reattachStatDrivenCombatBridge,
  validateStatDrivenCombatEncounterState,
} from './stat-driven-combat'
import {
  evaluatePv1fMatureSkill,
  executePv1fMatureSkill,
  preparePv1fTurnEconomy,
  readPv1fActionEconomy,
  finishPv1fTurn,
} from './pv1f-action-economy'

function encounter() {
  const base = percentageDotEncounter()
  return {
    ...preparePv1fTurnEconomy(
      createCurrentStatDrivenCombatEncounterState(
        base,
        base.statBridge.combatants.map((profile) => ({
          ...profile,
          physicalPower: 20,
          mysticPower: 20,
          level: 1,
          criticalChance: 0,
        })),
      ),
    ),
    effectTimingPolicy: { version: 1, modes: { summon: 'instant' as const } },
  }
}

function summoning(
  timing: 'instant' | 'next-round' | 'delayed' = 'instant',
  prefix: readonly AbilityEffect[] = [],
): MatureSkillDefinition {
  const native = resolveMatureSkillVersion('wildwarden.renewing-herbs')!
  const profile = { ...native.summonProfile!, name: 'Captured Companion' }
  return {
    ...native,
    contentVersion: 20,
    effectDescriptions: undefined,
    ability: parseAbilityDefinition({
      schemaVersion: 1,
      behaviors: [
        {
          ...source().definition.behaviors[0]!,
          id: 'call',
          classification: 'utility',
          attackFamily: undefined,
          costs: [
            { resource: 'ap', amount: 23 },
            { resource: 'mp', amount: 3 },
            { resource: 'hp', amount: 2 },
          ],
          cooldown: { key: 'test.canonical-summon', ownerTurns: 2 },
          targeting: { ...native.target, geometryVersion: 3, maximumSelections: 1 },
          effects: [
            ...prefix,
            {
              id: 'spawn',
              timing,
              payload: { type: 'summon', recipient: 'selected-tile', profile },
            },
          ],
        },
      ],
    }),
  }
}

const tile = { kind: 'tile' as const, position: { x: 0, y: 1 } }

function recordedEvents(transition: { readonly events: readonly unknown[] }) {
  return transition.events.map((value) => {
    if (
      !value ||
      typeof value !== 'object' ||
      !('event' in value) ||
      typeof value.event !== 'string'
    )
      throw new Error('Expected a structured combat receipt.')
    return value as {
      event: string
      actionId?: string
      effectTag?: string
      sourceCommandVisibility?: unknown
    }
  })
}

describe('canonical Summon command routing', () => {
  it('retains privacy when a queued Summon is part of the Skill establishing Covert', () => {
    const state = encounter()
    const definition = summoning('next-round', [
      {
        id: 'hide',
        timing: 'next-round',
        payload: { type: 'apply-status', recipient: 'actor', statusId: 'covert', stacks: 1 },
      },
    ])
    let out = executePv1fMatureSkill(state, definition, tile)
    expect(out.state.pendingSummons).toHaveLength(1)
    expect(out.state.pendingSummons![0].sourceCommandVisibility).toEqual({
      kind: 'team-only',
      teamId: 'players',
    })
    const events = [...recordedEvents(out)]
    for (let turn = 0; turn < 8 && out.state.tactical.battle.round < 2; turn++) {
      out = finishPv1fTurn(out.state, 'east')
      events.push(...recordedEvents(out))
    }
    expect(
      events.find((event) => event.event === 'summon_spawned')?.sourceCommandVisibility,
    ).toEqual({ kind: 'team-only', teamId: 'players' })
  })

  it('inherits the captured Summon timing policy when its packet has no explicit timing', () => {
    const state = {
      ...encounter(),
      effectTimingPolicy: { version: 8, modes: { summon: 'next-round' as const } },
    }
    const original = summoning()
    const behavior = original.ability!.behaviors[0]!
    const definition = {
      ...original,
      ability: parseAbilityDefinition({
        schemaVersion: 1,
        behaviors: [
          {
            ...behavior,
            effects: behavior.effects.map(({ timing: _timing, ...effect }) => {
              void _timing
              return effect
            }),
          },
        ],
      }),
    }
    const quote = evaluatePv1fMatureSkill(state, definition, tile)
    expect(quote.evaluation.projectedEffects).toContainEqual(
      expect.objectContaining({ effectType: 'summon', activationRound: 2, after: 'pending' }),
    )
    const committed = executePv1fMatureSkill(state, definition, tile)
    expect(committed.state.pendingSummons?.[0]?.activationRound).toBe(2)
    expect(committed.state.effectTimingPolicy?.version).toBe(8)
  })
  it.each([
    { maximumSelections: 2, shape: { kind: 'single' } },
    { maximumSelections: 1, shape: { kind: 'circle', radius: 1 } },
  ])('rejects unsupported multi-tile Summon selection %j', (targeting) => {
    const definition = summoning().ability!
    const behavior = definition.behaviors[0]!
    expect(
      validateAbilityDefinition({
        ...definition,
        behaviors: [{ ...behavior, targeting: { ...behavior.targeting, ...targeting } }],
      }),
    ).toContainEqual(
      expect.objectContaining({
        code: 'unsupported-combination',
        message: expect.stringContaining('single'),
      }),
    )
  })
  it.each(['instant', 'next-round'] as const)(
    'lets the standard AI choose and commit a legal %s summon after JSON reconnect',
    (timing) => {
      const initial = encounter()
      const definition = summoning(timing)
      const captured = capturedMatureSkillAbilitySource(initial, definition)!
      const state = JSON.parse(
        JSON.stringify(reconcileCombatAbilitySources(initial, [captured])),
      ) as ReturnType<typeof encounter>
      const turn = state.tactical.battle.currentTurn!
      turn.movementSpent = turn.movementMaximum
      turn.movementRemaining = 0
      state.tactical.placements = state.tactical.placements.map((placement) =>
        placement.combatantId === 'enemy'
          ? { ...placement, position: { x: 4, y: 0 } }
          : placement.combatantId === 'other'
            ? { ...placement, position: { x: 4, y: 4 } }
            : placement,
      )
      const saved = JSON.stringify(state)
      const decision = chooseBuildAwareRecruitAiDecision({
        state,
        tieBreakSeed: 1,
        skillOptions: { committedSkills: [definition] },
      })
      expect(JSON.stringify(state)).toBe(saved)
      expect(decision.intent).toMatchObject({
        kind: 'action',
        actionId: definition.id,
        behaviorId: 'call',
      })
      if (decision.intent.kind !== 'action') throw new Error('Expected Summon action.')
      const committed = executeBuildAwareRecruitAiAction(
        state,
        decision.intent.actionId,
        decision.intent.target,
        { committedSkills: [definition] },
        { behaviorId: decision.intent.behaviorId },
      )
      expect(readPv1fActionEconomy(committed.state, 'actor')?.current).toBe(77)
      expect(
        timing === 'instant'
          ? committed.state.effectState?.summons
          : committed.state.pendingSummons,
      ).toHaveLength(1)
      expect(validateStatDrivenCombatEncounterState(committed.state)).toEqual([])
    },
  )

  it('retains cast privacy on a queued summon and its later spawn receipt', () => {
    const initial = encounter()
    initial.statusState = initial.statusState.map((row) =>
      row.combatantId === 'actor'
        ? {
            ...row,
            statuses: [
              {
                statusId: 'covert',
                statusVersion: 1,
                stacks: 1,
                remainingOwnerTurnStarts: 2,
                sourceCombatantId: 'actor',
              },
            ],
          }
        : row,
    )
    let result = executePv1fMatureSkill(initial, summoning('next-round'), tile)
    expect(result.state.pendingSummons?.[0]?.sourceCommandVisibility).toEqual({
      kind: 'team-only',
      teamId: 'players',
    })
    expect(
      recordedEvents(result).find((event) => event.event === 'effect_pending')
        ?.sourceCommandVisibility,
    ).toEqual({ kind: 'team-only', teamId: 'players' })
    const events = [...recordedEvents(result)]
    for (let guard = 0; guard < 8 && result.state.tactical.battle.round < 2; guard++) {
      result = finishPv1fTurn(result.state, 'east')
      events.push(...recordedEvents(result))
    }
    expect(
      events.find((event) => event.event === 'summon_spawned')?.sourceCommandVisibility,
    ).toEqual({ kind: 'team-only', teamId: 'players' })
  })
  it('rejects impassable ground in the quote and leaves every resource unchanged', () => {
    const initial = encounter()
    const state = {
      ...initial,
      tactical: {
        ...initial.tactical,
        terrains: [...initial.tactical.terrains, { id: 'wall', traversalCost: null }],
        tiles: initial.tactical.tiles.map((row) =>
          row.position.x === 0 && row.position.y === 1 ? { ...row, terrainId: 'wall' } : row,
        ),
      },
    }
    const before = JSON.stringify(state)
    const quote = evaluatePv1fMatureSkill(state, summoning(), tile)
    expect(quote.evaluation.legal).toBe(false)
    expect(quote.evaluation.issues).toContainEqual(
      expect.objectContaining({
        code: 'target-not-found',
        message: expect.stringContaining('passable'),
      }),
    )
    expect(JSON.stringify(state)).toBe(before)
    expect(() => executePv1fMatureSkill(state, summoning(), tile)).toThrow()
    expect(JSON.stringify(state)).toBe(before)
  })

  it('captures a conditional packet before HP payment crosses its threshold', () => {
    const definition = summoning()
    const behavior = definition.ability!.behaviors[0]!
    const conditional = {
      ...definition,
      ability: parseAbilityDefinition({
        schemaVersion: 1,
        behaviors: [
          {
            ...behavior,
            effects: behavior.effects.map((effect) => ({
              ...effect,
              requirements: {
                kind: 'resource-state',
                subject: 'owner',
                resource: 'hp',
                comparison: 'at-most',
                amount: 999,
              },
            })),
          },
        ],
      }),
    }
    const state = encounter()
    expect(
      evaluatePv1fMatureSkill(state, conditional, tile).evaluation.projectedEffects.some(
        (effect) => effect.effectType === 'summon',
      ),
    ).toBe(false)
    const result = executePv1fMatureSkill(state, conditional, tile)
    expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')?.hp).toBe(
      998,
    )
    expect(result.state.effectState?.summons ?? []).toHaveLength(0)
    expect(readPv1fActionEconomy(result.state, 'actor')?.current).toBe(77)
  })

  it('keeps the captured profile when a later same-version catalogue object changes', () => {
    const initial = encounter()
    const definition = summoning()
    const captured = capturedMatureSkillAbilitySource(initial, definition)!
    const state = reattachStatDrivenCombatBridge(
      reconcileCombatAbilitySources(initial, [captured]),
      initial.statBridge,
    )
    const changed = JSON.parse(JSON.stringify(definition)) as MatureSkillDefinition
    const payload = changed.ability!.behaviors[0]!.effects[0]!.payload
    if (payload.type !== 'summon') throw new Error('Expected Summon.')
    Object.assign(payload.profile, { name: 'Later replacement' })
    const result = executePv1fMatureSkill(state, changed, tile)
    expect(result.state.effectState?.summons?.[0]?.profile.name).toBe('Captured Companion')
    expect(
      result.state.capturedAbilitySources?.find((row) => row.abilityId === definition.id)
        ?.definition,
    ).toEqual(captured.definition)
  })

  it('retains existing owner-turn lifetime and removes the complete summon without input', () => {
    let state = executePv1fMatureSkill(encounter(), summoning(), tile).state
    const summon = state.effectState!.summons![0]!
    let completed = 0
    for (let guard = 0; guard < 40 && state.effectState?.summons?.length; guard++) {
      const actor = state.tactical.battle.currentTurn?.combatantId
      const result = finishPv1fTurn(state, 'east')
      state = result.state
      if (actor === summon.combatantId) completed++
    }
    expect(completed).toBe(summon.profile.lifetimeTurns)
    expect(state.effectState?.summons ?? []).toHaveLength(0)
    expect(state.tactical.battle.combatants.some((unit) => unit.id === summon.combatantId)).toBe(
      false,
    )
    expect(
      state.statBridge.combatants.some((profile) => profile.combatantId === summon.combatantId),
    ).toBe(false)
    expect(validateStatDrivenCombatEncounterState(state)).toEqual([])
  })

  it('rejects queued casts without the required captured timing policy before payment', () => {
    const state = { ...encounter(), effectTimingPolicy: undefined }
    const saved = JSON.stringify(state)
    expect(() => evaluatePv1fMatureSkill(state, summoning('next-round'), tile)).toThrow(
      'canonical-summon-pinned-timing-policy-required',
    )
    expect(JSON.stringify(state)).toBe(saved)
  })
  it('quotes without mutation and atomically pays once for the exact captured profile', () => {
    const state = encounter()
    const definition = summoning()
    const before = JSON.stringify(state)
    const quote = evaluatePv1fMatureSkill(state, definition, tile)
    expect(quote.evaluation.legal).toBe(true)
    expect(quote.evaluation.projectedEffects).toContainEqual(
      expect.objectContaining({ effectType: 'summon', after: 'active' }),
    )
    expect(JSON.stringify(state)).toBe(before)
    const result = executePv1fMatureSkill(state, definition, tile)
    const summoned = result.state.effectState?.summons?.[0]
    expect(summoned?.profile.name).toBe('Captured Companion')
    expect(summoned?.sourceSkillVersion).toBe(20)
    expect(
      result.state.statBridge.combatants.some(
        (profile) => profile.combatantId === summoned?.combatantId,
      ),
    ).toBe(true)
    expect(readPv1fActionEconomy(result.state, 'actor')?.current).toBe(77)
    expect(
      result.state.tactical.battle.combatants.find((unit) => unit.id === 'actor'),
    ).toMatchObject({ hp: 998, mp: 17 })
    expect(recordedEvents(result).filter((event) => event.event === 'summon_spawned')).toHaveLength(
      1,
    )
    expect(result.state.tactical.battle.rng).toEqual(state.tactical.battle.rng)
    expect(validateStatDrivenCombatEncounterState(result.state)).toEqual([])
    const saved = JSON.stringify(result.state)
    expect(
      evaluatePv1fMatureSkill(result.state, definition, { kind: 'tile', position: { x: 0, y: 2 } })
        .evaluation.legal,
    ).toBe(false)
    expect(JSON.stringify(result.state)).toBe(saved)
  })

  it.each(['next-round', 'delayed'] as const)(
    'queues a pinned %s profile and activates once at its actual round',
    (timing) => {
      const state = encounter()
      const definition = summoning(timing)
      const quote = evaluatePv1fMatureSkill(state, definition, tile)
      const round = state.tactical.battle.round + (timing === 'next-round' ? 1 : 2)
      expect(quote.evaluation.projectedEffects).toContainEqual(
        expect.objectContaining({ effectType: 'summon', after: 'pending', activationRound: round }),
      )
      let result = executePv1fMatureSkill(state, definition, tile)
      expect(result.state.effectState?.summons ?? []).toHaveLength(0)
      expect(result.state.pendingSummons?.[0]).toMatchObject({
        activationRound: round,
        input: { sourceSkillVersion: 20, profile: { name: 'Captured Companion' } },
      })
      expect(readPv1fActionEconomy(result.state, 'actor')?.current).toBe(77)
      const allEvents = [...recordedEvents(result)]
      for (let n = 0; n < 16 && result.state.tactical.battle.round < round; n++) {
        result = finishPv1fTurn(result.state, 'east')
        allEvents.push(...recordedEvents(result))
      }
      expect(result.state.tactical.battle.round).toBe(round)
      expect(result.state.effectState?.summons).toHaveLength(1)
      expect(result.state.effectState?.summons?.[0]?.profile.name).toBe('Captured Companion')
      expect(result.state.pendingSummons ?? []).toHaveLength(0)
      expect(allEvents.filter((event) => event.event === 'summon_spawned')).toHaveLength(1)
      expect(validateStatDrivenCombatEncounterState(result.state)).toEqual([])
    },
  )

  it.each(['instant', 'next-round'] as const)(
    'retains payment but creates no %s Summon after a before-action defeat',
    (timing) => {
      const initial = encounter()
      initial.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.hp = 10
      const reaction = captureCombatAbilitySource({
        ...source({
          id: 'interrupt',
          activation: 'automatic',
          costs: [{ resource: 'mp', amount: 1 }],
          activationLimits: ['once-per-action'],
          requirements: { kind: 'event', eventType: 'combat_action_used', phase: 'before' },
          automaticTarget: { subject: 'triggering' },
          effects: [
            { id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 20 } },
          ],
        }),
        ownerCombatantId: 'enemy',
      })
      const definition = summoning(timing)
      const state = reattachStatDrivenCombatBridge(
        reconcileCombatAbilitySources(initial, [
          reaction,
          capturedMatureSkillAbilitySource(initial, definition)!,
        ]),
        initial.statBridge,
      )
      const result = executePv1fMatureSkill(state, definition, tile)
      expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')?.hp).toBe(
        0,
      )
      expect(readPv1fActionEconomy(result.state, 'actor')?.current).toBe(77)
      expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')?.mp).toBe(
        17,
      )
      expect(result.state.pendingSummons ?? []).toHaveLength(0)
      expect(result.state.effectState?.summons ?? []).toHaveLength(0)
      expect(result.events).toContainEqual(
        expect.objectContaining({ event: 'combat_action_interrupted' }),
      )
      expect(
        recordedEvents(result).some(
          (event) =>
            event.event === 'summon_spawned' ||
            (event.event === 'effect_pending' && event.effectTag === 'summon'),
        ),
      ).toBe(false)
      expect(validateCombatEncounterState(result.state)).toEqual([])
    },
  )

  it('preserves preceding actor effects and resolves Summon before after-action reactions', () => {
    const initial = encounter()
    initial.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.hp = 500
    const reaction = captureCombatAbilitySource(
      source(
        {
          id: 'after-mend',
          activation: 'automatic',
          classification: 'recovery',
          attackFamily: undefined,
          costs: [],
          activationLimits: ['once-per-action'],
          requirements: { kind: 'event', eventType: 'combat_action_used', phase: 'after' },
          automaticTarget: { subject: 'owner' },
          targeting: {
            ...source().definition.behaviors[0]!.targeting!,
            kind: 'self',
            teamPolicy: 'self',
            friendlyFire: 'allies-only',
            minimumRange: 0,
            maximumRange: 0,
          },
          effects: [{ id: 'heal', payload: { type: 'healing', recipient: 'actor', amount: 7 } }],
        },
        'after-source',
      ),
    )
    const definition = summoning('instant', [
      { id: 'prepare', payload: { type: 'healing', recipient: 'actor', amount: 3 } },
    ])
    const state = reattachStatDrivenCombatBridge(
      reconcileCombatAbilitySources(initial, [
        reaction,
        capturedMatureSkillAbilitySource(initial, definition)!,
      ]),
      initial.statBridge,
    )
    const result = executePv1fMatureSkill(state, definition, tile)
    const firstHeal = recordedEvents(result).findIndex(
      (event) =>
        event.event === 'healing_applied' && event.actionId === 'wildwarden.renewing-herbs',
    )
    const spawn = recordedEvents(result).findIndex((event) => event.event === 'summon_spawned')
    const response = recordedEvents(result).findIndex(
      (event) => event.event === 'healing_applied' && event.actionId === 'test.ability',
    )
    expect(firstHeal).toBeGreaterThanOrEqual(0)
    expect(spawn).toBeGreaterThan(firstHeal)
    expect(response).toBeGreaterThan(spawn)
    expect(result.state.effectState?.summons).toHaveLength(1)
    expect(validateStatDrivenCombatEncounterState(result.state)).toEqual([])
  })

  it('rejects a Summon followed by another packet instead of changing authored order', () => {
    const definition = summoning().ability!
    const behavior = definition.behaviors[0]!
    expect(
      validateAbilityDefinition({
        ...definition,
        behaviors: [
          {
            ...behavior,
            effects: [
              ...behavior.effects,
              { id: 'late', payload: { type: 'healing', recipient: 'actor', amount: 3 } },
            ],
          },
        ],
      }),
    ).toContainEqual(
      expect.objectContaining({
        code: 'unsupported-combination',
        message: expect.stringContaining('final'),
      }),
    )
  })
})
