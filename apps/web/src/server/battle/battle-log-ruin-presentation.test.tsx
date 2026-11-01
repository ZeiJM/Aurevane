import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import {
  executeCombatAction,
  type CombatActionDefinition,
} from '@aurevane/game-core/combat/actions'
import { percentageDotEncounter } from '../../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-combat-content'
import { grantBarrier } from '@aurevane/game-core/combat/combat-barrier'
import { BattleLogFeed } from '../../components/battle/battle-log-feed'
import { formatBattleLogForClipboard } from '../../components/battle/battle-log-clipboard'
import { buildBattleChronicle } from '../../components/battle/battle-log-chronicle-model'

vi.mock('server-only', () => ({}))
import { buildBattleLogView } from './battle-log-service'
import { projectBattleHistoryForViewer } from './battle-history-privacy'
import {
  deriveParticipantBattleViewerEntitlement,
  createSpectatorBattleViewerEntitlement,
} from './battle-viewer-entitlement'

const names = { combatantNames: { actor: 'Zei', enemy: 'Recruit' } }
function records(events: readonly object[]) {
  return events.map((event, eventIndex) => ({
    battleVersion: 2,
    eventIndex,
    createdAt: '2026-11-01T00:00:00Z',
    event,
  }))
}
const damage = {
  event: 'damage_applied',
  actionId: 'test.ruin',
  sourceCombatantId: 'actor',
  targetCombatantId: 'enemy',
  amount: 57,
  hpBefore: 100,
  hpAfter: 43,
}
function text(events: readonly object[]) {
  const view = buildBattleLogView('ruin-presentation', records(events))
  return {
    view,
    html: renderToStaticMarkup(<BattleLogFeed entries={view.entries} {...names} />),
    copied: formatBattleLogForClipboard(view.entries, names),
    outcomes: buildBattleChronicle(view.entries, names).flatMap((round) =>
      round.actors.flatMap((actor) => actor.actions.flatMap((action) => action.outcomes)),
    ),
  }
}

it.each([
  { bonus: 6000, expected: '60%' },
  { bonus: 125, expected: '1.25%' },
  { bonus: '900719925474099100', expected: '9007199254740991%' },
])(
  'keeps the recorded total Ruin bonus $expected on the same damage outcome',
  ({ bonus, expected }) => {
    const result = text([{ ...damage, ruinBonusBasisPoints: bonus }])
    expect(result.view.entries[0]?.templateValues).toMatchObject({ ruinBonus: expected })
    expect(result.outcomes).toHaveLength(1)
    expect(result.outcomes[0]).toMatchObject({
      text: '57 damage',
      recipient: ' to Recruit',
      annotation: `Ruin +${expected}`,
    })
    expect(result.html).toContain(`Ruin +${expected}`)
    expect(result.copied).toContain(`57 damage to Recruit · Ruin +${expected}`)
  },
)

it.each([undefined, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '1.5', 'bad'])(
  'keeps old or invalid Ruin metadata plain: %s',
  (bonus) => {
    const result = text([{ ...damage, ruinBonusBasisPoints: bonus }])
    expect(result.view.entries[0]?.templateValues).not.toHaveProperty('ruinBonus')
    expect(result.html).not.toContain('Ruin +')
    expect(result.copied).not.toContain('Ruin +')
  },
)

it('does not attach Ruin to independent periodic damage even if a malformed receipt carries it', () => {
  const result = text([{ ...damage, statusId: 'poison', ruinBonusBasisPoints: 6000 }])
  expect(result.html).not.toContain('Ruin +')
  expect(result.copied).not.toContain('Ruin +')
})

it('keeps full finishing-hit damage and actual HP facts alongside Ruin', () => {
  const result = text([
    {
      ...damage,
      amount: 48,
      resolvedDamage: 999,
      hpBefore: 48,
      hpAfter: 0,
      ruinBonusBasisPoints: 6000,
    },
  ])
  expect(result.view.entries[0]).toMatchObject({
    templateValues: { amount: '999', ruinBonus: '60%' },
  })
  expect(result.view.entries[0]?.facts).toContainEqual({ label: '0 HP remaining', tone: 'neutral' })
  expect(result.copied).toContain('999 damage to Recruit · Ruin +60%')
})

it('keeps Ruin alongside the pinned custom damage narration in both readers', () => {
  const { view } = text([{ ...damage, ruinBonusBasisPoints: 6000 }])
  const entries = view.entries.map((entry) => ({
    ...entry,
    actionContext: {
      skillId: 'test.ruin',
      contentVersion: 1,
      name: 'Finisher',
      description: 'Saved attack',
      flavor: null,
      presentation: { result: '{ability} deals {outcome.damage} damage to {targets}.', values: {} },
    },
  }))
  const html = renderToStaticMarkup(<BattleLogFeed entries={entries} {...names} />)
  const copied = formatBattleLogForClipboard(entries, names)
  for (const value of [html, copied]) {
    expect(value).toContain('Finisher deals 57 damage to Recruit.')
    expect(value).toContain('Ruin +60%')
  }
})

it('keeps consumption diagnostics without adding separate removal outcomes or hiding authored Cleanse', () => {
  const removal = {
    event: 'status_removed',
    actionId: 'test.ruin',
    sourceCombatantId: 'actor',
    targetCombatantId: 'enemy',
  }
  const result = text([
    { ...damage, ruinBonusBasisPoints: 6000 },
    { ...removal, statusId: 'slow', removalReason: 'ruin' },
    { ...removal, statusId: 'root' },
  ])
  expect(result.view.entries).toHaveLength(3)
  expect(result.outcomes).toHaveLength(2)
  expect(result.copied).toContain('Ruin +60%')
  expect(result.copied).not.toContain('Slow was removed')
  expect(result.copied).toContain('Rooted was removed')
})

it('preserves source-command privacy for Ruin damage and consumption receipts', () => {
  const history = records([
    { event: 'combat_action_used', actorId: 'actor', actionId: 'secret.ruin' },
    { ...damage, actionId: 'secret.ruin', ruinBonusBasisPoints: 6000 },
    {
      event: 'status_removed',
      actionId: 'secret.ruin',
      sourceCombatantId: 'actor',
      targetCombatantId: 'enemy',
      statusId: 'slow',
      removalReason: 'ruin',
    },
  ])
  const journals = [
    {
      schemaVersion: 1 as const,
      battleVersion: 2,
      actorCombatantId: 'actor',
      actorTeamId: 'a',
      eventCount: 3,
      commandVisibility: { kind: 'team-only' as const, teamId: 'a' },
      eventVisibilityOverrides: [],
    },
  ]
  const units = [
    { id: 'actor', teamId: 'a' },
    { id: 'enemy', teamId: 'b' },
  ]
  const owner = deriveParticipantBattleViewerEntitlement(units, ['actor'])
  const friendly = buildBattleLogView(
    'ruin-history',
    projectBattleHistoryForViewer(history, journals, owner),
  )
  expect(formatBattleLogForClipboard(friendly.entries, names)).toContain('Ruin +60%')
  for (const viewer of [
    deriveParticipantBattleViewerEntitlement(units, ['enemy']),
    createSpectatorBattleViewerEntitlement(),
  ]) {
    const projected = projectBattleHistoryForViewer(history, journals, viewer)
    const view = buildBattleLogView('ruin-history', projected)
    expect(JSON.stringify(view)).not.toMatch(/secret\.ruin|ruinBonus|removalReason/)
    expect(formatBattleLogForClipboard(view.entries, names)).not.toContain('Ruin +')
  }
})

it.each([
  { name: 'ordinary hit', hp: 1000, barrier: 0, hits: 1, amounts: [160] },
  { name: 'finishing hit', hp: 48, barrier: 0, hits: 1, amounts: [48] },
  { name: 'fully absorbed hit', hp: 1000, barrier: 1000, hits: 1, amounts: [0] },
  { name: 'two-hit Skill', hp: 1000, barrier: 0, hits: 2, amounts: [160, 100] },
  { name: 'Pierce hit', hp: 1000, barrier: 0, hits: 1, amounts: [160], pierce: true },
])('shows committed Ruin only on the actual boosted damage receipt: $name', (fixture) => {
  const base = percentageDotEncounter()
  const initial = {
    ...base,
    ruinPolicyVersion: 1 as const,
    pierceCriticalPolicyVersion: 1 as const,
    tactical: {
      ...base.tactical,
      battle: {
        ...base.tactical.battle,
        combatants: base.tactical.battle.combatants.map((unit) =>
          unit.id === 'enemy' ? { ...unit, hp: fixture.hp } : unit,
        ),
      },
    },
    statusState: base.statusState.map((row) =>
      row.combatantId === 'enemy'
        ? {
            ...row,
            statuses: ['root', 'slow'].map((statusId) => ({
              statusId,
              statusVersion: 1,
              stacks: 1,
              sourceCombatantId: 'actor',
              remainingOwnerTurnStarts: 3,
            })),
          }
        : row,
    ),
  }
  const action: CombatActionDefinition = {
    id: 'test.ruin',
    version: 1,
    sourceType: 'test',
    tags: [],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      friendlyFire: 'enemies-only',
      shape: { kind: 'single' },
      minimumRange: 0,
      maximumRange: 4,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
    },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    effects: [
      { type: 'ruin', recipient: 'actor', bonusPerDebuffBasisPoints: 3000 },
      ...Array.from({ length: fixture.hits }, () => ({
        type: 'damage' as const,
        recipient: 'primary-unit' as const,
        amount: 100,
        ...('pierce' in fixture && fixture.pierce ? { piercing: true } : {}),
      })),
    ],
  }
  const before = JSON.stringify(initial)
  const resolved = executeCombatAction(
    fixture.barrier
      ? grantBarrier(initial, 'enemy', 'enemy', 'test.shield', fixture.barrier).state
      : initial,
    action,
    { kind: 'unit', combatantId: 'enemy' },
    PV1F_COMBAT_CONTENT,
  )
  const result = text(resolved.events)
  const receipts = resolved.events.filter((event) => event.event === 'damage_applied')
  expect(receipts.map((receipt) => receipt.amount)).toEqual(fixture.amounts)
  expect(receipts[0]).toMatchObject({ ruinBonusBasisPoints: 6000 })
  for (const receipt of receipts.slice(1))
    expect(receipt).not.toHaveProperty('ruinBonusBasisPoints')
  const displayedDamage = fixture.hp === 48 ? 160 : fixture.amounts[0]
  expect(result.copied).toContain(
    `${displayedDamage} ${'pierce' in fixture && fixture.pierce ? 'piercing damage' : 'damage'} to Recruit · Ruin +60%`,
  )
  expect(result.copied.match(/Ruin \+60%/gu)).toHaveLength(1)
  expect(result.copied).not.toContain('was removed')
  expect(resolved.state.statusState.find((row) => row.combatantId === 'enemy')?.statuses).toEqual(
    [],
  )
  expect(JSON.stringify(initial)).toBe(before)
})
