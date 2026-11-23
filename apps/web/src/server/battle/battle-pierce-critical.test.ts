import { captureCombatAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import { reconcileCombatAbilitySources } from '@aurevane/game-core/combat/combat-behavior-runtime'
import { source } from '../../../../../packages/game-core/src/combat/combat-behavior.test-utils'
import { projectBattleManualActionTargets } from './battle-live-viewer-projection'
import { deriveParticipantBattleViewerEntitlement } from './battle-viewer-entitlement'
import { expect, it, vi } from 'vitest'
import {
  executeCombatAction,
  type CombatActionDefinition,
} from '@aurevane/game-core/combat/actions'
import {
  createCurrentStatDrivenCombatEncounterState,
  reattachStatDrivenCombatBridge,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-combat-content'
import { percentageDotEncounter } from '../../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { buildBattleLogView } from './battle-log-service'
import { buildBattleChronicle } from '@/components/battle/battle-log-chronicle-model'
import { formatBattleLogForClipboard } from '@/components/battle/battle-log-clipboard'
import { buildBattleLogPresentation } from '@/components/battle/battle-log-presentation'
vi.mock('server-only', () => ({}))
it('keeps actual ordinary critical and Pierce noncritical receipts distinct in Chronicle and copied log', () => {
  const base = percentageDotEncounter()
  const state = {
    ...createCurrentStatDrivenCombatEncounterState(
      base,
      base.statBridge.combatants.map((row) => ({
        ...row,
        criticalChance: 10000,
        physicalPower: 0,
        mysticPower: 0,
        armor: 0,
        ward: 0,
        level: 1,
      })),
    ),
    pierceCriticalPolicyVersion: 1 as const,
  }
  const definition: CombatActionDefinition = {
    id: 'test.pierce-log',
    version: 1,
    sourceType: 'test',
    tags: ['attack', 'physical'],
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    accuracyMode: 'automatic',
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
    effects: [
      { type: 'damage', recipient: 'primary-unit', amount: 20 },
      { type: 'damage', recipient: 'primary-unit', amount: 20, shattersBarrier: true },
      { type: 'spike', recipient: 'actor' },
    ],
  }
  const out = executeCombatAction(
    state,
    definition,
    { kind: 'unit', combatantId: 'enemy' },
    PV1F_COMBAT_CONTENT,
  )
  const receipts = out.events.filter((event) => event.event === 'damage_applied')
  expect(receipts).toMatchObject([
    { amount: 60, critical: true },
    { amount: 20, damageKind: 'piercing', critical: false },
  ])
  const view = buildBattleLogView(
    'test.session',
    out.events.map((event, eventIndex) => ({
      battleVersion: 1,
      eventIndex,
      createdAt: '2026-11-01T00:00:00Z',
      event,
    })),
  )
  expect(
    view.entries
      .filter((entry) => entry.eventType === 'damage_applied')
      .map((entry) => entry.templateValues.critical),
  ).toEqual(['true', 'false'])
  const names = { combatantNames: { actor: 'Caster', enemy: 'Enemy' } }
  const outcomes = buildBattleChronicle(view.entries, names).flatMap((round) =>
    round.actors.flatMap((actor) => actor.actions.flatMap((action) => action.outcomes)),
  )
  expect(outcomes.find((row) => row.text.includes('60 damage'))?.text).toContain('Critical')
  expect(outcomes.find((row) => row.text.includes('20 piercing damage'))?.text).not.toContain(
    'Critical',
  )
  expect(outcomes.filter((row) => row.text.startsWith('Critical hit on'))).toEqual([])
  const copied = formatBattleLogForClipboard(view.entries, names)
  expect(copied).toContain('Critical 60 damage')
  expect(copied).toContain('20 piercing damage')
  expect(copied).not.toContain('Critical 20 piercing')
  expect(copied.match(/Critical/g)).toHaveLength(1)
  const compact = JSON.stringify(buildBattleLogPresentation(view.entries, names))
  expect(compact).toContain('Critical 60 damage')
  expect(compact).not.toContain('Critical 20 piercing')
})

it.each([false, true])(
  'projects current versus historical Pierce rules from immutable manual captures (current: %s)',
  (current) => {
    const captured = captureCombatAbilitySource(
      source({
        effects: [
          {
            id: 'pierce',
            payload: {
              type: 'pierce',
              recipient: 'primary-unit',
              amount: 20,
              armorIgnoredBasisPoints: 10000,
            },
          },
          { id: 'weak', payload: { type: 'weak-point', recipient: 'actor', debuffThreshold: 1 } },
        ],
      }),
    )
    const base = percentageDotEncounter()
    const state = reconcileCombatAbilitySources(
      { ...base, ...(current ? { pierceCriticalPolicyVersion: 1 as const } : {}) },
      [captured],
    )
    const before = JSON.stringify(captured)
    const viewer = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
      'actor',
    ])
    const report = projectBattleManualActionTargets(
      reattachStatDrivenCombatBridge(state, base.statBridge),
      viewer,
    )[0]!.report!
    for (const text of report.effectDescriptions)
      expect(text.includes('Pierce cannot critically hit.')).toBe(current)
    expect(JSON.stringify(state.capturedAbilitySources![0])).toBe(before)
  },
)
