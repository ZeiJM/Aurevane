import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { audioAssetRegistry } from '@aurevane/audio'
import type { BattleEventRecord } from '@aurevane/db/battle-session'
import { BattleAudioCursor, selectBattleAudioCues } from './battle-audio'
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
      'audio.phase4.bastion-essence-v01-3',
      'audio.phase4.resonance-action-v01-3',
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
  it('coalesces periodic area consequences and varies subsequent renders', () => {
    const tick = { event: 'damage_applied', actionId: 'status.burn', amount: 3 }
    expect(selectBattleAudioCues([record(tick), record(tick)], 8, now)).toHaveLength(1)
    expect(selectBattleAudioCues([record(tick, 9)], 9, now)[0]?.assetId).toBe(
      'audio.phase4.attrition-action-v01-1',
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
  it('ships every registered cue and painted identity with the recorded hashes', () => {
    const runtime = ['phase4-v01', 'phase4-ironfist-v01', 'phase4-chronist-v01'].flatMap((id) => {
      const release = JSON.parse(
        readFileSync(resolve(`../../content/media-releases/${id}.json`), 'utf8'),
      ) as { runtime: { path: string; sha256: string }[] }
      return release.runtime
    })
    for (const file of runtime) {
      expect(
        createHash('sha256')
          .update(readFileSync(resolve('../..', file.path)))
          .digest('hex'),
      ).toBe(file.sha256)
    }
    const sounds = [...audioAssetRegistry.values()].filter((asset) =>
      asset.id.startsWith('audio.phase4.'),
    )
    expect(sounds).toHaveLength(84)
    for (const asset of sounds)
      expect(runtime.some((file) => file.path === `apps/web/public${asset.src}`)).toBe(true)
    expect(phase4DisciplineSigil('bastion')).toBe(
      '/media/art/disciplines/phase4/bastion-128-v01.webp',
    )
    expect(phase4SkillArtwork('essence.bastion.last-bastion')).toBe(
      '/media/art/disciplines/phase4/bastion-256-v01.webp',
    )
    expect(phase4SkillArtwork('bastion.fortress')).toMatch(/^data:image\/svg/)
  })
  it('routes Ironfist regular and three-hit Essence actions to their own media family', () => {
    for (const [actionId, role, priority] of [
      ['ironfist.breakfall', 'action', 70],
      ['essence.ironfist.hundredfold-rush', 'essence', 90],
    ] as const) {
      expect(
        selectBattleAudioCues([record({ event: 'combat_action_used', actionId })], 8, now),
      ).toEqual([{ assetId: `audio.phase4.ironfist-${role}-v01-3`, priority }])
    }
    expect(phase4SkillArtwork('essence.ironfist.hundredfold-rush')).toBe(
      '/media/art/disciplines/phase4/ironfist-256-v01.webp',
    )
    expect(phase4SkillArtwork('ironfist.breakfall')).toBeNull()
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
