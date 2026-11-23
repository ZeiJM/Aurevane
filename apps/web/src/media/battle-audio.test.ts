import assignments from './skill-fx-assignments.json'
import { describe, expect, it } from 'vitest'
import { sharedSkillFxGroups, audioAssetRegistry } from '@aurevane/audio'
import type { BattleEventRecord } from '@aurevane/db/battle-session'
import { BattleAudioCursor, selectBattleAudioCues } from './battle-audio'
import { resolveSkillAudioCueHook } from './skill-media-hooks'
import { phase4DisciplineSigil, phase4SkillArtwork } from '../components/battle/phase4-combat-art'

const now = Date.parse('2026-09-11T22:00:00Z')
function record(event: unknown, version = 8, age = 100): BattleEventRecord {
  return {
    event,
    battleVersion: version,
    eventIndex: 0,
    createdAt: new Date(now - age).toISOString(),
  }
}

describe('committed battle audio', () => {
  it('selects the Essence and conversion over repeated low-priority consequences', () => {
    const cues = selectBattleAudioCues(
      [
        record({ event: 'combat_action_used', actionId: 'essence.bastion.last-bastion' }),
        record({ event: 'resonance_activated' }),
        ...Array.from({ length: 20 }, () => record({ event: 'healing_applied', amount: 4 })),
        record({ event: 'status_removed' }),
      ],
      8,
      now,
    )
    expect(cues.map((cue) => cue.assetId)).toEqual([
      'audio.skill-fx.v01.050-3',
      `${sharedSkillFxGroups.resonance}-3`,
    ])
  })
  it('ignores old versions, stale/future data, missing effects and previews', () => {
    const action = { event: 'combat_action_used', actionId: 'ravager.frenzy' }
    expect(
      selectBattleAudioCues(
        [
          record(action, 7),
          record(action, 8, 5001),
          record(action, 8, -1),
          record({ event: 'skill_preview', actionId: 'ravager.frenzy' }),
          record({ event: 'healing_applied', amount: 0 }),
          record(null),
          record({ event: 'combat_action_used', actionId: '../../anything' }),
        ],
        8,
        now,
      ),
    ).toEqual([])
  })
  it('uses the committed Skill audio hook before action-id fallback', () => {
    expect(
      selectBattleAudioCues(
        [
          record({
            event: 'combat_action_used',
            actionId: 'vanguard.forceful-strike',
            audioCueKey: 'skill.ironfist.breakfall.audio',
          }),
        ],
        8,
        now,
      ),
    ).toEqual([{ assetId: 'audio.skill-fx.v01.082-3', priority: 70 }])
  })

  it('routes every supplied cast assignment through the new pool and leaves unknown hooks silent', () => {
    for (const [hook, group] of Object.entries(assignments)) {
      const actionId = hook.startsWith('skill.') ? hook.slice(6, -6) : hook.slice(0, -6)
      expect(
        selectBattleAudioCues([record({ event: 'combat_action_used', actionId })], 8, now),
      ).toEqual([{ assetId: `${group}-3`, priority: hook.startsWith('essence.') ? 90 : 70 }])
    }
    expect(
      selectBattleAudioCues(
        [record({ event: 'combat_action_used', actionId: 'vanguard.unknown' })],
        8,
        now,
      ),
    ).toEqual([])
  })

  it('does not route retired temporary copied-Skill commands to current Skill audio', () => {
    expect(
      selectBattleAudioCues(
        [
          record({
            event: 'combat_action_used',
            actionId: 'temporary.copy.ironfist.breakfall.v1',
          }),
        ],
        8,
        now,
      ),
    ).toEqual([])
  })

  it('coalesces periodic area consequences and varies subsequent renders', () => {
    const tick = { event: 'damage_applied', actionId: 'status.burn', amount: 3 }
    expect(selectBattleAudioCues([record(tick), record(tick)], 8, now)).toHaveLength(1)
    expect(selectBattleAudioCues([record(tick, 9)], 9, now)[0]?.assetId).toBe(
      `${sharedSkillFxGroups.attrition}-1`,
    )
  })
  it('does not replay initial snapshots, duplicate responses, reconnect gaps or command retries', () => {
    const cursor = new BattleAudioCursor(7)
    expect(cursor.advance(7)).toBe(false)
    expect(cursor.advance(8)).toBe(true)
    expect(cursor.advance(8)).toBe(false)
    expect(cursor.advance(7)).toBe(false)
    expect(cursor.advance(11)).toBe(false)
    expect(cursor.advance(12, true)).toBe(false)
    expect(cursor.advance(13)).toBe(true)
    expect(cursor.advance(NaN)).toBe(false)
  })
  it('keeps only new sound cues while preserving the established artwork', () => {
    expect([...audioAssetRegistry.values()].filter((asset) => asset.kind === 'sfx')).toHaveLength(
      459,
    )
    expect([...audioAssetRegistry.keys()].some((key) => key.startsWith('audio.phase4.'))).toBe(
      false,
    )
    expect(phase4DisciplineSigil('bastion')).toBe(
      '/media/art/discipline-sigils/bastion-sigil-v01.webp',
    )
    expect(phase4SkillArtwork('essence.bastion.last-bastion')).toBe(
      '/media/art/essence-skills/bastion-last-bastion-v01.webp',
    )
    expect(phase4SkillArtwork('bastion.fortress')).toBe(
      '/media/art/discipline-skills/bastion-fortress-v02.webp',
    )
  })
  it('routes Ironfist regular and three-hit Essence actions to their own media family', () => {
    for (const [actionId, , priority] of [
      ['ironfist.breakfall', 'action', 70],
      ['essence.ironfist.hundredfold-rush', 'essence', 90],
    ] as const) {
      expect(
        selectBattleAudioCues([record({ event: 'combat_action_used', actionId })], 8, now),
      ).toEqual([
        {
          assetId: `${resolveSkillAudioCueHook(actionId.startsWith('essence.') ? `${actionId}.audio` : `skill.${actionId}.audio`)!.audioGroup}-3`,
          priority,
        },
      ])
    }
    expect(phase4SkillArtwork('essence.ironfist.hundredfold-rush')).toBe(
      '/media/art/essence-skills/ironfist-hundredfold-rush-v01.webp',
    )
    expect(phase4SkillArtwork('ironfist.breakfall')).toBe(
      '/media/art/discipline-skills/ironfist-breakfall-v01.webp',
    )
    expect(phase4SkillArtwork('essence.ironfist.unknown')).toBeNull()
    expect(
      selectBattleAudioCues(
        [
          record({ event: 'skill_preview', actionId: 'ironfist.breakfall' }),
          record({ event: 'combat_action_used', actionId: 'ironfist.breakfall' }, 8, 5001),
        ],
        8,
        now,
      ),
    ).toEqual([])
  })
})
it('uses exact finalized sound identity from committed events and keeps replay/stale behavior', () => {
  const audioMedia = {
    id: '00000000-0000-4000-8000-000000000012',
    kind: 'audio',
    contentType: 'audio/wav',
    checksum: 'a'.repeat(64),
    byteLength: 100,
    durationMs: 1000,
    channels: 1,
    sampleRate: 44100,
  }
  const event = { event: 'combat_action_used', actionId: 'basic.recover.mp', audioMedia }
  expect(selectBattleAudioCues([record(event)], 8, now)).toEqual([
    { assetId: `content-media.${audioMedia.id}`, priority: 70 },
  ])
  expect(selectBattleAudioCues([record(event, 7)], 8, now)).toEqual([])
  expect(selectBattleAudioCues([record({ ...event, event: 'skill_preview' })], 8, now)).toEqual([])
})

it('honors explicit silence and resolves a selected neutral group with bounded variant rotation', () => {
  expect(
    selectBattleAudioCues(
      [record({ event: 'combat_action_used', actionId: 'ironfist.breakfall', audioCueKey: null })],
      8,
      now,
    ),
  ).toEqual([])
  expect(
    selectBattleAudioCues(
      [
        record({
          event: 'combat_action_used',
          actionId: 'custom.strike',
          audioCueKey: 'audio.skill-fx.v01.001',
        }),
      ],
      8,
      now,
    ),
  ).toEqual([{ assetId: 'audio.skill-fx.v01.001-3', priority: 70 }])
})

it('carries a selected sound group through real immutable canonical capture and activation', async () => {
  const { source } =
    await import('../../../../packages/game-core/src/combat/combat-behavior.test-utils')
  const { percentageDotEncounter } =
    await import('../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils')
  const { captureCombatAbilitySource } =
    await import('@aurevane/game-core/combat/combat-behavior-capture')
  const { activateCombatAbility, reconcileCombatAbilitySources, combatAbilityCommandContext } =
    await import('@aurevane/game-core/combat/combat-behavior-runtime')
  const { preparePv1fTurnEconomy, PV1F_COMBAT_CONTENT } =
    await import('@aurevane/game-core/combat/pv1f-action-economy')
  for (const cue of ['skill.ironfist.breakfall.audio', null] as const) {
    const original = { ...source(), abilityId: 'custom.sound-test', audioCueKey: cue }
    const captured = captureCombatAbilitySource(original)
    const restored = captureCombatAbilitySource(JSON.parse(JSON.stringify(captured)))
    const state = reconcileCombatAbilitySources(preparePv1fTurnEconomy(percentageDotEncounter()), [
      restored,
    ])
    const result = activateCombatAbility({
      state,
      actorId: 'actor',
      source: restored,
      selection: { kind: 'unit', combatantId: 'enemy' },
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(state, restored),
    })
    const event = result.events.find((event) => event.event === 'combat_action_used')!
    expect(event).toMatchObject({ audioCueKey: cue })
    expect(selectBattleAudioCues([record(event)], 8, now)).toEqual(
      cue ? [{ assetId: 'audio.skill-fx.v01.082-3', priority: 70 }] : [],
    )
    original.audioCueKey = null
    expect(captured.audioCueKey).toBe(cue)
  }
})
