import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { commitCombatAbilityCommand } from './combat-ability-command'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from './combat-behavior-runtime'
import type { AbilityDefinition } from './combat-definition'
import { executeCombatAction, type CombatActionDefinition } from './actions'
import { validateCombatActionDefinition } from './combat-authoring-validation'
import { activePersistentCombatStatusRows, pendingCombatStatusRows } from './combat-effect-timing'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import {
  absorbDirectDamageWithBarrier,
  currentBarrierAmount,
  grantBarrier,
  validateBarrierEffect,
  validateBarrierState,
} from './combat-barrier'
import { applyCurrentBleedState } from './combat-dots'
import { validateCombatTagPayload } from './combat-tag-registry'
import { finishPv1fTurn, preparePv1fTurnEconomy, PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import {
  createAiQualityResources,
  createPvpQualityResources,
  timeoutAiTurn,
  timeoutPvpTurn,
} from './pvp-quality'
import {
  reattachStatDrivenCombatBridge,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'

const cohort = JSON.parse(
  readFileSync(
    new URL(
      '../../../../docs/superpowers/specs/2026-10-18-modular-correction-cohort.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as {
  records: {
    id: string
    after: {
      contentVersion: number
      sourceDisciplineId: string
      tags: string[]
      ability: AbilityDefinition
    }
  }[]
}
function fixture(
  durationTurns: number | null = 2,
  mode: 'instant' | 'next-round' | 'delayed' = 'instant',
  id = 'dawnshield.aegis',
  additionalShortPool = false,
) {
  const row = cohort.records.find((record) => record.id === id)!
  const definition = structuredClone(row.after.ability)
  for (const behavior of definition.behaviors)
    for (const effect of behavior.effects)
      if (effect.payload.type === 'barrier-change' && durationTurns !== null)
        Object.assign(effect.payload, { durationTurns })
  if (additionalShortPool)
    Object.assign(definition.behaviors[0]!, {
      effects: [
        ...definition.behaviors[0]!.effects,
        {
          id: 'short-shield',
          payload: {
            type: 'barrier-change',
            recipient: 'primary-unit',
            amount: 10,
            basis: 'maximum-hp-percent',
            durationTurns: 1,
          },
        },
      ],
    })
  const source = captureCombatAbilitySource({
    schemaVersion: 1,
    sourceInstanceId: `actor:${id}`,
    ownerCombatantId: 'actor',
    abilityId: id,
    contentVersion: row.after.contentVersion,
    sourceKind: 'discipline-skill',
    sourceDisciplineId: row.after.sourceDisciplineId,
    tags: row.after.tags,
    definition,
  })
  const base = percentageDotEncounter()
  const state = reattachStatDrivenCombatBridge(
    reconcileCombatAbilitySources(
      {
        ...preparePv1fTurnEconomy(base),
        modularSkillPolicyVersion: 1,
        effectTimingPolicy: {
          version: 8,
          tagAuthority: 'global',
          modes: { 'barrier-change': mode },
        },
      },
      [source],
    ),
    base.statBridge,
  )
  return { state, source }
}
function cast(f: ReturnType<typeof fixture>, recipient = 'actor') {
  return commitCombatAbilityCommand({
    state: f.state,
    actorId: 'actor',
    root: { kind: 'canonical', source: f.source },
    selection: recipient === 'actor' ? { kind: 'self' } : { kind: 'unit', combatantId: recipient },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(f.state, f.source),
  }).state as StatDrivenCombatEncounterState
}
function end(state: StatDrivenCombatEncounterState) {
  const id = state.tactical.battle.currentTurn!.combatantId
  return finishPv1fTurn(
    state,
    state.tactical.placements.find((row) => row.combatantId === id)!.facing,
  ).state
}
function round(state: StatDrivenCombatEncounterState, target: number) {
  while (state.tactical.battle.round < target) state = end(state)
  return state
}
function completeRecipientTurn(state: StatDrivenCombatEncounterState, id: string) {
  while (state.tactical.battle.currentTurn!.combatantId !== id) state = end(state)
  return end(state)
}
function withQuality(state: StatDrivenCombatEncounterState, kind: 'ai' | 'pvp') {
  return reattachStatDrivenCombatBridge(
    {
      ...state,
      tactical: {
        ...state.tactical,
        battle: {
          ...state.tactical.battle,
          combatants: state.tactical.battle.combatants.map((unit) => ({
            ...unit,
            temporaryResources: [
              ...unit.temporaryResources,
              ...(kind === 'ai' ? createAiQualityResources() : createPvpQualityResources()),
            ].sort((a, b) => a.key.localeCompare(b.key)),
          })),
        },
      },
    },
    state.statBridge,
  )
}

describe('captured Barrier lifetime', () => {
  it('accepts 99 and rejects 100 through canonical authoring and native action execution', () => {
    for (const durationTurns of [99, 100]) {
      const payload = {
        type: 'barrier-change' as const,
        recipient: 'actor' as const,
        amount: 20,
        durationTurns,
      }
      const native: CombatActionDefinition = {
        id: 'test.long-barrier',
        version: 1,
        sourceType: 'test',
        tags: [],
        requirements: [],
        cost: { spendsAction: false, mp: 0 },
        target: {
          kind: 'self',
          teamPolicy: 'self',
          shape: { kind: 'single' },
          minimumRange: 0,
          maximumRange: 0,
          requiresLineOfSight: false,
          maximumElevationDifference: null,
          friendlyFire: 'allies-only',
        },
        effects: [payload],
      }
      expect(validateCombatTagPayload(payload).length === 0).toBe(durationTurns === 99)
      if (durationTurns === 100) {
        expect(() => validateCombatActionDefinition(native)).toThrow(/duration/)
        expect(() => fixture(durationTurns)).toThrow()
        expect(() =>
          grantBarrier(percentageDotEncounter(), 'actor', 'actor', native.id, 20, {
            durationTurns,
            scope: 'owner-turns',
          }),
        ).toThrow(/duration/)
        continue
      }
      expect(() => validateCombatActionDefinition(native)).not.toThrow()
      const state = executeCombatAction(
        percentageDotEncounter(),
        native,
        { kind: 'self' },
        PV1F_COMBAT_CONTENT,
      ).state
      expect(state.effectState?.barriers?.[0]).toMatchObject({
        amount: 20,
        remainingOwnerTurnEnds: 99,
      })
      expect(validateBarrierState(JSON.parse(JSON.stringify(state)))).toEqual([])
    }
  })

  it.each(['owner-turns', 'rounds'] as const)(
    'rejects a persisted 100-turn %s clock while retaining 99',
    (scope) => {
      const state = grantBarrier(
        percentageDotEncounter(),
        'actor',
        'actor',
        'test.long-barrier',
        20,
        { durationTurns: 99, scope },
      ).state
      expect(validateBarrierState(JSON.parse(JSON.stringify(state)))).toEqual([])
      const clock = scope === 'rounds' ? 'remainingRoundBoundaries' : 'remainingOwnerTurnEnds'
      const corrupt = {
        ...state,
        effectState: {
          ...state.effectState!,
          barriers: state.effectState!.barriers!.map((pool) => ({ ...pool, [clock]: 100 })),
        },
      }
      expect(validateBarrierState(corrupt)).toContainEqual(
        expect.objectContaining({ field: `effectState.barriers[0].${clock}` }),
      )
    },
  )

  it.each(['instant', 'next-round', 'delayed'] as const)(
    'captures and reloads all 99 Barrier turns then expires exactly on the %s boundary',
    (mode) => {
      const reload = (state: StatDrivenCombatEncounterState) => {
        const restored = JSON.parse(JSON.stringify(state)) as StatDrivenCombatEncounterState
        expect(validateBarrierState(restored)).toEqual([])
        return restored
      }
      const captured = fixture(99, mode)
      expect(
        captured.source.definition.behaviors[0]!.effects.some(
          (effect) =>
            effect.payload.type === 'barrier-change' && effect.payload.durationTurns === 99,
        ),
      ).toBe(true)
      let state = reload(cast(captured, 'ally'))
      if (mode === 'instant') {
        expect(currentBarrierAmount(state, 'ally')).toBe(200)
        for (let turn = 1; turn <= 99; turn++) {
          state = reload(completeRecipientTurn(state, 'ally'))
          expect(currentBarrierAmount(state, 'ally')).toBe(turn < 99 ? 200 : 0)
          if (turn < 99)
            expect(state.effectState?.barriers?.[0]?.remainingOwnerTurnEnds).toBe(99 - turn)
        }
      } else {
        const activationRound = mode === 'next-round' ? 2 : 3
        expect(currentBarrierAmount(state, 'ally')).toBe(0)
        expect(
          pendingCombatStatusRows(state).find((row) => row.status.statusId === 'barrier')?.status,
        ).toMatchObject({ remainingRoundBoundaries: 99, activationRound })
        state = reload(round(state, activationRound))
        expect(currentBarrierAmount(state, 'ally')).toBe(200)
        for (let elapsed = 1; elapsed <= 99; elapsed++) {
          state = reload(round(state, activationRound + elapsed))
          expect(currentBarrierAmount(state, 'ally')).toBe(elapsed < 99 ? 200 : 0)
          if (elapsed < 99)
            expect(state.effectState?.barriers?.[0]?.remainingRoundBoundaries).toBe(99 - elapsed)
        }
      }
      expect(state.effectState?.barriers).toEqual([])
    },
  )

  it.each([0, -1, 1.5, 100, NaN, Infinity])(
    'rejects invalid programmed duration %s at authoring and native execution',
    (durationTurns) => {
      const payload = {
        type: 'barrier-change' as const,
        recipient: 'actor' as const,
        amount: 20,
        durationTurns,
      }
      expect(validateCombatTagPayload(payload)).not.toEqual([])
      expect(() => validateBarrierEffect(payload)).toThrow(/duration/)
    },
  )

  it('validates persisted clocks without assigning a lifetime to old pools', () => {
    const state = cast(fixture())
    const pool = state.effectState!.barriers![0]!
    for (const invalid of [
      { ...pool, remainingOwnerTurnEnds: 0 },
      { ...pool, remainingOwnerTurnEnds: 1.5 },
      { ...pool, remainingOwnerTurnEnds: 100 },
      { ...pool, remainingRoundBoundaries: 2 },
      { ...pool, applicationOrder: undefined },
    ])
      expect(
        validateBarrierState({
          ...state,
          effectState: { ...state.effectState!, barriers: [invalid] },
        }),
      ).not.toEqual([])
  })
  it.each(['dawnshield.aegis', 'lifebinder.barrier'])(
    '%s expires after two affected completed turns while preserving full-HP self and ally casts',
    (id) => {
      for (const recipient of ['actor', 'ally']) {
        let state = cast(fixture(2, 'instant', id), recipient)
        expect(currentBarrierAmount(state, recipient)).toBe(200)
        expect(state.tactical.battle.combatants.find((row) => row.id === recipient)!.hp).toBe(1000)
        state = completeRecipientTurn(state, recipient)
        expect(currentBarrierAmount(state, recipient)).toBe(200)
        expect(
          activePersistentCombatStatusRows(state).find(
            (row) => row.combatantId === recipient && row.status.statusId === 'barrier',
          )?.status.remainingOwnerTurnEnds,
        ).toBe(1)
        state = completeRecipientTurn(state, recipient)
        expect(currentBarrierAmount(state, recipient)).toBe(0)
        expect(
          activePersistentCombatStatusRows(state).filter(
            (row) => row.status.statusId === 'barrier',
          ),
        ).toEqual([])
        expect(state.tactical.battle.lifecycle).toBe('active')
      }
    },
  )

  it.each(['next-round', 'delayed'] as const)(
    '%s starts a full-round lifetime at actual activation',
    (mode) => {
      let state = cast(fixture(2, mode), 'ally')
      const activation = mode === 'next-round' ? 2 : 3
      expect(currentBarrierAmount(state, 'ally')).toBe(0)
      expect(
        pendingCombatStatusRows(state).find((row) => row.status.statusId === 'barrier')?.status,
      ).toMatchObject({
        durationScope: 'rounds',
        remainingRoundBoundaries: 2,
        activationRound: activation,
      })
      state = round(state, activation)
      expect(currentBarrierAmount(state, 'ally')).toBe(200)
      expect(
        activePersistentCombatStatusRows(state).find((row) => row.status.statusId === 'barrier')
          ?.status,
      ).toMatchObject({ durationScope: 'rounds', remainingRoundBoundaries: 2 })
      state = round(state, activation + 1)
      expect(currentBarrierAmount(state, 'ally')).toBe(200)
      state = round(state, activation + 2)
      expect(currentBarrierAmount(state, 'ally')).toBe(0)
    },
  )

  it('keeps same-command pools independently timed after partial consumption and reload', () => {
    const f = fixture(2, 'instant', 'dawnshield.aegis', true)
    let state = cast(f, 'ally')
    expect(currentBarrierAmount(state, 'ally')).toBe(300)
    state = absorbDirectDamageWithBarrier(state, 'ally', 50).state as StatDrivenCombatEncounterState
    state = JSON.parse(JSON.stringify(state))
    expect(validateBarrierState(state)).toEqual([])
    state = completeRecipientTurn(state, 'ally')
    expect(currentBarrierAmount(state, 'ally')).toBe(150)
    state = completeRecipientTurn(state, 'ally')
    expect(currentBarrierAmount(state, 'ally')).toBe(0)
  })

  it('keeps separate casts from the same source/action on their original expiry schedules', () => {
    const f = fixture(4)
    let state = round(cast(f, 'ally'), 4)
    expect(currentBarrierAmount(state, 'ally')).toBe(200)
    state = cast({ ...f, state }, 'ally')
    expect(currentBarrierAmount(state, 'ally')).toBe(400)
    state = completeRecipientTurn(state, 'ally')
    expect(currentBarrierAmount(state, 'ally')).toBe(200)
    state = completeRecipientTurn(state, 'ally')
    expect(currentBarrierAmount(state, 'ally')).toBe(200)
    state = completeRecipientTurn(state, 'ally')
    expect(currentBarrierAmount(state, 'ally')).toBe(200)
    state = completeRecipientTurn(state, 'ally')
    expect(currentBarrierAmount(state, 'ally')).toBe(0)
  })

  it('expires old round pools before activating new grants at the same boundary', () => {
    const first = fixture(1, 'next-round')
    const second = fixture(2, 'next-round', 'lifebinder.barrier')
    first.state = reattachStatDrivenCombatBridge(
      reconcileCombatAbilitySources(first.state, [first.source, second.source]),
      first.state.statBridge,
    )
    let state = round(cast(first, 'ally'), 2)
    state = cast({ ...second, state }, 'ally')
    state = round(state, 3)
    expect(currentBarrierAmount(state, 'ally')).toBe(200)
    expect(state.effectState!.barriers).toHaveLength(1)
    expect(state.effectState!.barriers![0]!.remainingRoundBoundaries).toBe(2)
    expect(currentBarrierAmount(round(state, 5), 'ally')).toBe(0)
  })

  it('protects the final scheduled periodic tick before its residual pool expires', () => {
    let state = cast(fixture(1), 'ally')
    state = applyCurrentBleedState(
      state,
      'enemy',
      'ally',
      'test.bleed',
      10,
      1,
    ) as StatDrivenCombatEncounterState
    state = completeRecipientTurn(state, 'ally')
    expect(state.tactical.battle.combatants.find((unit) => unit.id === 'ally')!.hp).toBe(1000)
    expect(currentBarrierAmount(state, 'ally')).toBe(0)
  })

  it('retains untimed protection while independently expiring a timed grant under legacy stacking caps', () => {
    const f = fixture()
    f.state = { ...f.state, effectStackingPolicyVersion: undefined }
    f.state = grantBarrier(f.state, 'actor', 'actor', 'old.shield', 17)
      .state as StatDrivenCombatEncounterState
    const state = round(cast(f), 4)
    expect(currentBarrierAmount(state, 'actor')).toBe(17)
    expect(validateBarrierState(state)).toEqual([])
  })

  it.each(['ai', 'pvp'] as const)(
    '%s no-input timeout expires protection through the native turn boundary',
    (kind) => {
      let state = cast(fixture(1), 'ally')
      state = reattachStatDrivenCombatBridge(
        {
          ...state,
          tactical: {
            ...state.tactical,
            battle: {
              ...state.tactical.battle,
              combatants: state.tactical.battle.combatants.map((unit) => ({
                ...unit,
                temporaryResources: [
                  ...unit.temporaryResources,
                  ...(kind === 'ai' ? createAiQualityResources() : createPvpQualityResources()),
                ].sort((a, b) => a.key.localeCompare(b.key)),
              })),
            },
          },
        },
        state.statBridge,
      )
      while (state.tactical.battle.currentTurn!.combatantId !== 'ally') state = end(state)
      const timeout = kind === 'ai' ? timeoutAiTurn : timeoutPvpTurn
      const out = timeout(state)
      expect(currentBarrierAmount(out.state, 'ally')).toBe(0)
      expect(out.state.tactical.battle.lifecycle).toBe('active')
      expect(
        out.events.some((row) => (row as { event: string }).event === 'battle_completed'),
      ).toBe(false)
      const terminal = {
        ...out.state,
        tactical: {
          ...out.state.tactical,
          battle: {
            ...out.state.tactical.battle,
            lifecycle: 'completed' as const,
            currentTurn: null,
          },
        },
      }
      expect(() => timeout(terminal)).toThrow(/active turn/)
    },
  )

  it.each(['ai', 'pvp'] as const)(
    '%s timeout after a committed cast expires Barrier without the idle penalty',
    (kind) => {
      const f = fixture(1)
      f.state = withQuality(f.state, kind)
      const state = cast(f)
      const out = (kind === 'ai' ? timeoutAiTurn : timeoutPvpTurn)(state)
      expect(currentBarrierAmount(out.state, 'actor')).toBe(0)
      expect(
        out.events.some((event) =>
          (event as { event: string }).event.endsWith('lowered_guard_applied'),
        ),
      ).toBe(false)
      expect(
        out.events.filter(
          (event) => (event as { event: string; reason?: string }).reason === 'expired',
        ),
      ).toHaveLength(1)
    },
  )

  it.each(['ai', 'pvp'] as const)(
    '%s repeated no-input boundaries activate and expire a Normal Barrier exactly once',
    (kind) => {
      let state = withQuality(cast(fixture(2, 'next-round'), 'ally'), kind)
      const timeout = kind === 'ai' ? timeoutAiTurn : timeoutPvpTurn
      let expiries = 0
      while (state.tactical.battle.round < 4) {
        const out = timeout(state)
        state = out.state
        expiries += out.events.filter(
          (event) => (event as { reason?: string }).reason === 'expired',
        ).length
        if (state.tactical.battle.round === 2 || state.tactical.battle.round === 3)
          expect(currentBarrierAmount(state, 'ally')).toBe(200)
      }
      expect(currentBarrierAmount(state, 'ally')).toBe(0)
      expect(expiries).toBe(1)
      expect(state.tactical.battle.lifecycle).toBe('active')
    },
  )

  it('preserves omitted-duration captured pools until spent', () => {
    const f = fixture(null)
    const state = round(cast(f), 6)
    expect(currentBarrierAmount(state, 'actor')).toBe(200)
    expect(
      activePersistentCombatStatusRows(state).find((row) => row.status.statusId === 'barrier')
        ?.status.durationScope,
    ).toBe('until-spent')
  })
})
