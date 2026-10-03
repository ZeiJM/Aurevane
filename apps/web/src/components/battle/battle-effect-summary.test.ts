import { describe, expect, it } from 'vitest'

import {
  aggregateBattleStatusStacks,
  statusLabel,
  formatStatusStackCount,
  summarizeBattleEffects,
} from './battle-effect-summary'

describe('battle effect summary', () => {
  it('shows Lowered Guard as 250% incoming damage instead of a +150% delta', () => {
    expect(
      summarizeBattleEffects([{ statusId: 'lowered-guard', statusVersion: 1, stacks: 1 }]),
    ).toEqual([{ label: 'DMG IN', value: '250%', tone: 'debuff' }])
  })

  it('keeps Guard presented as a 15% incoming-damage reduction', () => {
    expect(summarizeBattleEffects([{ statusId: 'guarded', statusVersion: 1, stacks: 1 }])).toEqual([
      { label: 'DMG IN', value: '−15%', tone: 'buff' },
    ])
  })

  it('does not include status chips in the damage summary', () => {
    expect(
      summarizeBattleEffects([
        { statusId: 'buff.focus', statusVersion: 1, stacks: 3 },
        { statusId: 'buff.haste', statusVersion: 1, stacks: 2 },
        { statusId: 'debuff.marked', statusVersion: 1, stacks: 1 },
      ]),
    ).toEqual([])
  })

  it('combines repeated entries for one status identity for active-effect boxes', () => {
    expect(
      aggregateBattleStatusStacks([
        { statusId: 'buff.focus', statusVersion: 1, stacks: 1 },
        { statusId: 'buff.focus', statusVersion: 1, stacks: 2 },
      ]),
    ).toEqual([{ statusId: 'buff.focus', statusVersion: 1, stacks: 3 }])
  })

  it('keeps pending and active instances separate and excludes pending damage modifiers', () => {
    const active = {
      statusId: 'guarded',
      statusVersion: 1,
      stacks: 1,
      timingState: 'active' as const,
    }
    const pending = { ...active, timingState: 'pending' as const, activationRound: 4 }
    expect(aggregateBattleStatusStacks([active, pending])).toEqual([active, pending])
    expect(summarizeBattleEffects([pending])).toEqual([])
    expect(summarizeBattleEffects([active, pending])).toEqual([
      { label: 'DMG IN', value: '−15%', tone: 'buff' },
    ])
  })

  it('keeps independently sourced Marks and different remaining lifetimes inspectable', () => {
    const first = {
      statusId: 'mark',
      statusVersion: 1,
      stacks: 1,
      sourceScopedMark: true as const,
      sourceCombatantId: 'first',
      remainingOwnerTurnEnds: 1,
    }
    const second = { ...first, sourceCombatantId: 'second' }
    const shorter = { statusId: 'root', statusVersion: 1, stacks: 1, remainingOwnerTurnEnds: 1 }
    const longer = { ...shorter, remainingOwnerTurnEnds: 2 }
    expect(aggregateBattleStatusStacks([first, second, shorter, longer])).toEqual([
      first,
      second,
      shorter,
      longer,
    ])
  })

  it('keeps different lifetime scopes distinct even when required legacy sentinels match', () => {
    const battle = {
      statusId: 'copy',
      statusVersion: 1,
      stacks: 1,
      remainingOwnerTurnStarts: 1,
      durationScope: 'battle' as const,
    }
    const instant = { ...battle, durationScope: 'instant' as const }
    expect(aggregateBattleStatusStacks([battle, instant])).toEqual([battle, instant])
  })

  it('uses neutral multiplication notation for every status counter', () => {
    expect(formatStatusStackCount('guarded', 3)).toBe('×3')
    expect(formatStatusStackCount('lowered-guard', 3)).toBe('×3')
  })
})

it.each([
  ['guarded', 'Guard'],
  ['lowered-guard', 'Off-guard'],
  ['exposed', 'Expose'],
  ['hexed', 'Hex'],
  ['inspired', 'Inspire'],
  ['invisible', 'Ghost'],
  ['summoned', 'Summon'],
])('shows compact active-status label for %s', (id, label) => {
  expect(statusLabel(id)).toBe(label)
})
