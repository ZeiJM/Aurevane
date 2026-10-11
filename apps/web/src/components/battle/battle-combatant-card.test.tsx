import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { BattleSessionView } from '@/server/battle/battle-session-service'
import { BattleCombatantCard } from './battle-combatant-card'
import type { BattlePresentationParticipant } from './battle-runtime'

const participant: BattlePresentationParticipant = {
  combatantId: 'wayfarer',
  characterId: 'character',
  name: 'Wayfarer',
  level: 1,
  teamIndex: 0,
  seatIndex: 0,
  profileImageUrl: null,
  portraitAssetId: null,
  local: true,
}
const selected = {
  ...participant,
  combatantId: 'recruit',
  name: 'Recruit',
  teamIndex: 1,
  local: false,
}
const battle = {
  snapshot: {
    tactical: {
      battle: {
        combatants: [
          { id: 'wayfarer', hp: 152, maxHp: 152, mp: 58, maxMp: 58 },
          { id: 'recruit', hp: 35, maxHp: 80, mp: 14, maxMp: 25 },
        ],
      },
      placements: [
        { combatantId: 'wayfarer', facing: 'east' },
        { combatantId: 'recruit', facing: 'west' },
      ],
    },
    statusState: [],
  },
} as unknown as BattleSessionView

describe('shared compact combatant card', () => {
  it('renders current snapshot vitals, identity accent and an accessible Inspect trigger', () => {
    const markup = renderToStaticMarkup(
      <BattleCombatantCard participant={participant} battle={battle} teamCount={2} role="local" />,
    )
    for (const label of [
      'HP 152 / 152',
      'MP 58 / 58',
      'Inspect Wayfarer',
      'Wayfarer facing east',
      '--battle-combatant-accent:#d0aa62',
    ])
      expect(markup).toContain(label)
    expect(markup).not.toContain('Recruit')
    expect(markup).not.toContain('Your character')
    expect(markup.indexOf('<header')).toBeLessThan(markup.indexOf('data-av-square-media'))
  })
  it('keeps full unequal-digit resource values accessible in independent meters', () => {
    const snapshot = {
      ...battle,
      snapshot: {
        ...battle.snapshot,
        tactical: {
          ...battle.snapshot.tactical,
          battle: {
            ...battle.snapshot.tactical.battle,
            combatants: [{ id: 'wayfarer', hp: 1234, maxHp: 1234, mp: 9, maxMp: 9 }],
          },
        },
      },
    } as unknown as BattleSessionView
    const markup = renderToStaticMarkup(
      <BattleCombatantCard
        participant={participant}
        battle={snapshot}
        teamCount={2}
        role="local"
      />,
    )
    expect(markup.match(/role="meter"/g)).toHaveLength(2)
    for (const label of ['aria-label="HP 1234 / 1234"', 'aria-label="MP 9 / 9"'])
      expect(markup).toContain(label)
    expect(markup).toContain('aria-valuenow="1234"')
    expect(markup).toContain('aria-valuemax="1234"')
    expect(markup).toContain('aria-valuetext="9 / 9"')
    expect(markup).not.toContain('aria-valuemax="0"')
  })
  it('swaps to the selected combatant without showing an opposing roster or stale local vitals', () => {
    const markup = renderToStaticMarkup(
      <BattleCombatantCard participant={selected} battle={battle} teamCount={2} role="selected" />,
    )
    for (const label of [
      'HP 35 / 80',
      'MP 14 / 25',
      'Inspect Recruit',
      '--battle-combatant-accent:#aa86cf',
    ])
      expect(markup).toContain(label)
    expect(markup).not.toContain('Wayfarer')
    expect(markup).not.toContain('Selected character')
    expect(markup).not.toContain('HP 152')
    const fills = [...markup.matchAll(/style="width:([\d.]+)%"/g)].map((match) => Number(match[1]))
    expect(fills[0]).toBeCloseTo(43.75)
    expect(fills[1]).toBeCloseTo(56)
  })
  it('uses the same card in read-only spectation without combat command controls', () => {
    const markup = renderToStaticMarkup(
      <BattleCombatantCard participant={participant} battle={battle} teamCount={2} role="acting" />,
    )
    expect(markup).not.toContain('Acting character')
    expect(markup).not.toContain('data-battle-command')
  })
})
