import { captureCombatAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import {
  reconcileCombatAbilitySources,
  primeCombatControlledAbility,
} from '@aurevane/game-core/combat/combat-behavior-runtime'
import {
  preparePv1fTurnEconomy,
  finishPv1fTurn,
  PV1F_COMBAT_CONTENT,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import { reattachStatDrivenCombatBridge } from '@aurevane/game-core/combat/stat-driven-combat'
import { grantBarrier } from '@aurevane/game-core/combat/combat-barrier'
import { percentageDotEncounter } from '../../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { source } from '../../../../../packages/game-core/src/combat/combat-behavior.test-utils'
import { interceptCombatReversal } from '../../../../../packages/game-core/src/combat/combat-reversal-interception'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { buildBattleLogView } from './battle-log-service'
import { BattleLogFeed } from '../../components/battle/battle-log-feed'
import { formatBattleLogForClipboard } from '../../components/battle/battle-log-clipboard'

const options = {
  combatantNames: { 'character:zei': 'Zei', 'recruit:weon': 'Weon' },
}

it.each([
  { name: 'finishing direct hit', resolvedDamage: 999, amount: 48, hpAfter: 0, expected: 999 },
  {
    name: 'finishing Reflect',
    actionId: 'status.reflect.current.v1',
    resolvedDamage: 999,
    amount: 48,
    hpAfter: 0,
    expected: 999,
  },
  {
    name: 'finishing Poison tick',
    statusId: 'poison',
    actionId: 'status.poison.current.v1',
    resolvedDamage: 999,
    amount: 48,
    hpAfter: 0,
    expected: 999,
  },
  { name: 'ordinary nonlethal hit', resolvedDamage: 77, amount: 77, hpAfter: 23, expected: 77 },
  { name: 'historical finishing hit', amount: 48, hpAfter: 0, expected: 48 },
  {
    name: 'nonfinite optional damage',
    resolvedDamage: Infinity,
    amount: 48,
    hpAfter: 0,
    expected: 48,
  },
  {
    name: 'decimal-string finishing hit',
    resolvedDamage: '999',
    amount: 48,
    hpAfter: 0,
    expected: 999,
  },
  {
    name: 'exact oversized finishing hit',
    resolvedDamage: '9007199254740993123456789',
    amount: 48,
    hpAfter: 0,
    expected: '9007199254740993123456789',
  },
  { name: 'negative optional damage', resolvedDamage: -1, amount: 48, hpAfter: 0, expected: 48 },
  {
    name: 'fractional optional damage',
    resolvedDamage: 999.5,
    amount: 48,
    hpAfter: 0,
    expected: 48,
  },
  {
    name: 'unsafe optional number',
    resolvedDamage: Number.MAX_SAFE_INTEGER + 1,
    amount: 48,
    hpAfter: 0,
    expected: 48,
  },
  {
    name: 'malformed decimal string',
    resolvedDamage: '999.5',
    amount: 48,
    hpAfter: 0,
    expected: 48,
  },
  { name: 'negative decimal string', resolvedDamage: '-999', amount: 48, hpAfter: 0, expected: 48 },
  {
    name: 'non-numeric decimal string',
    resolvedDamage: 'extra damage',
    amount: 48,
    hpAfter: 0,
    expected: 48,
  },
  { name: 'zero damage', resolvedDamage: 0, amount: 0, hpAfter: 48, expected: 0 },
])('shows recorded full damage for $name in the shared reader and copied log', (fixture) => {
  const records = [
    {
      battleVersion: 2,
      eventIndex: 0,
      createdAt: '2026-11-01T00:00:00Z',
      event: {
        event: 'damage_applied',
        actionId: 'basic.attack.unarmed.basic',
        sourceCombatantId: 'character:zei',
        targetCombatantId: 'recruit:weon',
        hpBefore: fixture.amount + fixture.hpAfter,
        ...fixture,
      },
    },
  ]
  const original = structuredClone(records)
  const view = buildBattleLogView('battle-finishing-hit', records)
  expect(view.entries[0]).toMatchObject({ templateValues: { amount: String(fixture.expected) } })
  expect(view.entries[0]!.facts).toContainEqual({
    label: `${fixture.hpAfter} HP remaining`,
    tone: 'neutral',
  })
  const html = renderToStaticMarkup(<BattleLogFeed entries={view.entries} {...options} />)
  const copied = formatBattleLogForClipboard(view.entries, options)
  for (const text of [html, copied]) expect(text).toContain(`${fixture.expected} damage`)
  if (fixture.expected !== fixture.amount)
    for (const text of [html, copied]) expect(text).not.toContain(`${fixture.amount} damage`)
  expect(records).toEqual(original)
})

it.each([
  { resolvedReturnedHpDamage: 999, expected: '999' },
  { resolvedReturnedHpDamage: '90071992547409910', expected: '90071992547409910' },
  { resolvedReturnedHpDamage: undefined, expected: '48' },
  { resolvedReturnedHpDamage: -1, expected: '48' },
  { resolvedReturnedHpDamage: '999.5', expected: '48' },
])(
  'uses full Reversal returned-damage metadata in the shared reader and export: $expected',
  ({ resolvedReturnedHpDamage, expected }) => {
    const records = [
      {
        battleVersion: 2,
        eventIndex: 0,
        createdAt: '2026-11-01T00:00:00Z',
        event: {
          event: 'reversal_triggered',
          actionId: 'test.reversal',
          combatantId: 'character:zei',
          attackerCombatantId: 'recruit:weon',
          incomingActionId: 'basic.attack.unarmed.basic',
          preventedDamage: 999,
          returnedDamage: 48,
          ...(resolvedReturnedHpDamage === undefined ? {} : { resolvedReturnedHpDamage }),
        },
      },
    ]
    const original = structuredClone(records)
    const view = buildBattleLogView('battle-finishing-return', records)
    const html = renderToStaticMarkup(<BattleLogFeed entries={view.entries} {...options} />)
    const copied = formatBattleLogForClipboard(view.entries, options)
    for (const text of [html, copied])
      expect(text).toContain(`returns ${expected} HP damage to Weon`)
    expect(view.entries[0]!.facts).toContainEqual({
      label: `${expected} HP damage returned`,
      tone: 'damage',
    })
    expect(records).toEqual(original)
  },
)

it.each([
  { barrier: 0, expected: 999 },
  { barrier: 25, expected: 974 },
])(
  'shows a real finishing Reversal return after $barrier Barrier without increasing actual HP loss',
  ({ barrier, expected }) => {
    const captured = captureCombatAbilitySource(
      source({
        id: 'prepare',
        classification: 'utility',
        attackFamily: undefined,
        targeting: {
          kind: 'self',
          teamPolicy: 'self',
          friendlyFire: 'allies-only',
          shape: { kind: 'single' },
          minimumRange: 0,
          maximumRange: 0,
          requiresLineOfSight: false,
          maximumElevationDifference: null,
          maximumSelections: 1,
        },
        cooldown: null,
        effects: [
          {
            id: 'reversal',
            timing: 'controlled',
            payload: {
              type: 'reversal',
              recipient: 'actor',
              version: 1,
              family: 'physical',
              reflectionBasisPoints: 10000,
              attackerMaxHpCapBasisPoints: 10000,
              defenderMaxHpCapBasisPoints: 10000,
            },
          },
        ],
      }),
    )
    const base = preparePv1fTurnEconomy(percentageDotEncounter())
    const state = reattachStatDrivenCombatBridge(
      reconcileCombatAbilitySources(
        { ...base, effectTimingPolicy: { version: 1, modes: {}, tagAuthority: 'global' } },
        [captured],
      ),
      base.statBridge,
    )
    const prepared = primeCombatControlledAbility({
      state,
      actorId: 'actor',
      sourceInstanceId: captured.sourceInstanceId,
      behaviorId: 'prepare',
      content: PV1F_COMBAT_CONTENT,
    })
    const armed = finishPv1fTurn(prepared.state as typeof state, 'east').state
    const wounded = {
      ...armed,
      modularSkillPolicyVersion: 1 as const,
      tactical: {
        ...armed.tactical,
        battle: {
          ...armed.tactical.battle,
          combatants: armed.tactical.battle.combatants.map((unit) =>
            unit.id === 'enemy' ? { ...unit, hp: 48 } : unit,
          ),
        },
      },
    }
    const ready = barrier
      ? grantBarrier(wounded, 'enemy', 'enemy', 'return-shield', barrier).state
      : wounded
    const result = interceptCombatReversal(ready, {
      actorId: 'enemy',
      recipientId: 'actor',
      actionId: 'test.incoming',
      family: 'physical',
      wouldHpDamage: 999,
      content: PV1F_COMBAT_CONTENT,
    })!
    expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.hp).toBe(0)
    expect(result.events.find((event) => event.event === 'reversal_triggered')).toMatchObject({
      returnedDamage: 48,
      resolvedReturnedHpDamage: expected,
    })
    const records = result.events.map((event, eventIndex) => ({
      battleVersion: 2,
      eventIndex,
      createdAt: '2026-11-01T00:00:00Z',
      event: { ...event },
    }))
    const view = buildBattleLogView('actual-finishing-reversal', records)
    const names = { combatantNames: { actor: 'Zei', enemy: 'Weon' } }
    const html = renderToStaticMarkup(<BattleLogFeed entries={view.entries} {...names} />)
    const copied = formatBattleLogForClipboard(view.entries, names)
    for (const text of [html, copied])
      expect(text).toContain(`returns ${expected} HP damage to Weon`)
  },
)
