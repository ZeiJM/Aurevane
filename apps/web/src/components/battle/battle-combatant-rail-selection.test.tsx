import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { BattleSessionView } from '@/server/battle/battle-session-service'
import { BattleCombatantCard } from './battle-combatant-card'
import { selectBattleSkillPreviewIntent } from './battle-preview-selection'
import type { BattleViewModel } from './battle-runtime'
import { selectBattleCombatantRails } from './battle-combatant-rail-selection'

const participants = [
  { combatantId: 'local', name: 'Zei', teamIndex: 0, seatIndex: 0, local: true },
  { combatantId: 'ally', name: 'Ally', teamIndex: 0, seatIndex: 1, local: false },
  { combatantId: 'enemy-one', name: 'Recruit 1', teamIndex: 1, seatIndex: 0, local: false },
  { combatantId: 'enemy-two', name: 'Recruit 2', teamIndex: 1, seatIndex: 1, local: false },
].map((participant) => ({
  ...participant,
  characterId: null,
  level: 1,
  profileImageUrl: null,
  portraitAssetId: null,
}))
const viewModel: BattleViewModel = {
  participants,
  participantByCombatant: new Map(
    participants.map((participant) => [participant.combatantId, participant]),
  ),
  localParticipant: participants[0],
  localCombatantId: 'local',
  localTeamIndex: 0,
  teamCount: 2,
  battleKey: null,
  modeLabel: '2V2',
  objectiveEyebrow: 'Battle Hall',
  objective: 'Defeat opponents',
}
const input = {
  viewModel,
  battleVersion: 3,
  allyInspection: { combatantId: 'ally', battleVersion: 3 },
  selectedUnitId: 'enemy-one',
  inspectedEnemyUnitId: 'enemy-two',
}
const battle = {
  snapshot: {
    tactical: {
      battle: {
        combatants: participants.map((participant, index) => ({
          id: participant.combatantId,
          hp: 100 - index * 10,
          maxHp: 100,
          mp: 50 - index * 10,
          maxMp: 50,
        })),
      },
      placements: participants.map((participant) => ({
        combatantId: participant.combatantId,
        facing: 'east',
      })),
    },
    statusState: [],
  },
} as unknown as BattleSessionView

describe('temporary allied combatant rail inspection', () => {
  it('uses actual allied HP/MP and facing in the upper rail while preserving latest enemy below', () => {
    const rails = selectBattleCombatantRails(input)
    expect(rails.local?.combatantId).toBe('ally')
    expect(rails.enemy?.combatantId).toBe('enemy-two')
    const markup = renderToStaticMarkup(
      <BattleCombatantCard participant={rails.local} battle={battle} teamCount={2} role="local" />,
    )
    expect(markup).toContain('aria-label="Ally battle summary"')
    expect(markup).toContain('aria-label="HP 90 / 100"')
    expect(markup).toContain('aria-label="MP 40 / 50"')
    expect(markup).toContain('data-desktop-inspect-combatant="ally"')
    expect(markup).toContain('aria-label="Ally facing east"')
  })
  it('restores local rail when a chosen action clears inspection or any authoritative version advances', () => {
    expect(selectBattleCombatantRails({ ...input, allyInspection: null }).local?.combatantId).toBe(
      'local',
    )
    expect(selectBattleCombatantRails({ ...input, battleVersion: 4 }).local?.combatantId).toBe(
      'local',
    )
    expect(
      selectBattleCombatantRails({
        ...input,
        allyInspection: { combatantId: 'enemy-two', battleVersion: 3 },
      }).local?.combatantId,
    ).toBe('local')
    expect(
      selectBattleCombatantRails({
        ...input,
        allyInspection: { combatantId: 'removed', battleVersion: 3 },
      }).local?.combatantId,
    ).toBe('local')
  })
  it('never changes the command actor or makes an ally eligible for an enemy-only attack', () => {
    const rails = selectBattleCombatantRails(input)
    const descriptor = {
      id: 'attack',
      targetKind: 'unit' as const,
      targetTeamPolicy: 'enemy' as const,
      minimumRange: 1,
      maximumRange: 1,
    }
    const selection = {
      actorId: viewModel.localCombatantId,
      selectedCombatantId: rails.local?.combatantId ?? null,
      selectedTile: null,
      combatants: [
        { combatantId: 'local', teamIndex: 0, hp: 100, position: { x: 1, y: 1 } },
        { combatantId: 'ally', teamIndex: 0, hp: 90, position: { x: 1, y: 2 } },
        { combatantId: 'enemy-two', teamIndex: 1, hp: 70, position: { x: 2, y: 1 } },
      ],
    }
    expect(viewModel.localCombatantId).toBe('local')
    expect(selectBattleSkillPreviewIntent(descriptor, selection)).toBeNull()
    expect(
      selectBattleSkillPreviewIntent(descriptor, {
        ...selection,
        selectedCombatantId: 'enemy-two',
      }),
    ).toEqual({
      kind: 'action',
      actionId: 'attack',
      target: { kind: 'unit', combatantId: 'enemy-two' },
    })
  })
  it('does not invent a local actor when none is available', () => {
    const noLocal = {
      ...viewModel,
      localParticipant: null,
      localCombatantId: null,
      localTeamIndex: null,
    }
    expect(selectBattleCombatantRails({ ...input, viewModel: noLocal }).local).toBeNull()
    expect(noLocal.localCombatantId).toBeNull()
  })
  it('keeps selected opponents in the lower rail with an empty or unavailable ally selection', () => {
    expect(
      selectBattleCombatantRails({ ...input, allyInspection: null, selectedUnitId: 'ally' }).enemy
        ?.combatantId,
    ).toBe('enemy-two')
    expect(
      selectBattleCombatantRails({ ...input, inspectedEnemyUnitId: null }).enemy?.combatantId,
    ).toBe('enemy-one')
    expect(
      selectBattleCombatantRails({ ...input, inspectedEnemyUnitId: null, selectedUnitId: null })
        .enemy?.combatantId,
    ).toBe('enemy-one')
  })
})
