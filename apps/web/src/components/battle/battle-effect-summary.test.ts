import { describe, expect, it } from 'vitest'

import {
  aggregateBattleStatusStacks,
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

  it('uses neutral multiplication notation for every status counter', () => {
    expect(formatStatusStackCount('guarded', 3)).toBe('×3')
    expect(formatStatusStackCount('lowered-guard', 3)).toBe('×3')
  })
})
