import { expect, it, vi } from 'vitest'
import {
  captureBasicSkillSources,
  defaultBasicSkills,
} from '@aurevane/game-core/combat/combat-basic-actions'
import { buildBattleChronicle } from '@/components/battle/battle-log-chronicle-model'
import { formatBattleLogForClipboard } from '@/components/battle/battle-log-clipboard'
import { buildBattleLogView } from './battle-log-service'
import { attachRecordedBattleLogSkillContext } from './battle-log-skill-context'

vi.mock('server-only', () => ({}))

it.each([
  ['basic.pilfer', 'Pilfer'],
  ['basic.fleetstep', 'Fleetstep'],
  ['basic.invocation', 'Invocation'],
] as const)(
  'uses the %s label in Chronicle and clipboard with and without pinned context',
  async (id, name) => {
    const records = [
      {
        battleVersion: 1,
        eventIndex: 0,
        createdAt: '2026-11-02T00:00:00Z',
        event: { event: 'combat_action_used', actorId: 'actor', actionId: id },
      },
    ]
    const raw = buildBattleLogView('support', records)
    for (const captured of [false, true]) {
      const captures = captured
        ? captureBasicSkillSources({
            ownerCombatantId: 'actor',
            supportActionId: id,
            definitions: defaultBasicSkills(),
          })
        : []
      const view = await attachRecordedBattleLogSkillContext(
        raw,
        records,
        undefined,
        undefined,
        captures,
      )
      expect(buildBattleChronicle(view.entries)[0]!.actors[0]!.actions[0]!.title).toBe(name)
      const clipboard = formatBattleLogForClipboard(view.entries)
      expect(clipboard).toContain(name)
      expect(clipboard).not.toContain(`Basic ${name}`)
      expect(clipboard).not.toContain(id)
    }
    const definitions = defaultBasicSkills().map((row) =>
      row.id === id ? { ...row, name: `Authored ${name}` } : row,
    )
    const renamed = await attachRecordedBattleLogSkillContext(
      raw,
      records,
      undefined,
      undefined,
      captureBasicSkillSources({ ownerCombatantId: 'actor', supportActionId: id, definitions }),
    )
    expect(buildBattleChronicle(renamed.entries)[0]!.actors[0]!.actions[0]!.title).toBe(
      `Authored ${name}`,
    )
  },
)
