import { describe, expect, it } from 'vitest'

import { summarizeBattleEffects } from './battle-effect-summary'

describe('battle effect summary', () => {
  it('shows Lowered Guard as 250% incoming damage instead of a +150% delta', () => {
    expect(
      summarizeBattleEffects([{ statusId: 'lowered-guard', statusVersion: 1, stacks: 1 }]),
    ).toEqual([
      { label: 'DMG IN', value: '250%', tone: 'debuff' },
      { label: 'Lowered Guard', value: '−1', tone: 'debuff' },
    ])
  })

  it('keeps Guard presented as a 15% incoming-damage reduction', () => {
    expect(summarizeBattleEffects([{ statusId: 'guarded', statusVersion: 1, stacks: 1 }])).toEqual([
      { label: 'DMG IN', value: '−15%', tone: 'buff' },
      { label: 'Guarded', value: '+1', tone: 'buff' },
    ])
  })

  it('keeps different status identities in separate chips', () => {
    expect(
      summarizeBattleEffects([
        { statusId: 'buff.focus', statusVersion: 1, stacks: 3 },
        { statusId: 'buff.haste', statusVersion: 1, stacks: 2 },
        { statusId: 'debuff.marked', statusVersion: 1, stacks: 1 },
      ]),
    ).toEqual([
      { label: 'Focus', value: '+3', tone: 'buff' },
      { label: 'Haste', value: '+2', tone: 'buff' },
      { label: 'Marked', value: '−1', tone: 'debuff' },
    ])
  })

  it('combines repeated entries for one status identity', () => {
    expect(
      summarizeBattleEffects([
        { statusId: 'buff.focus', statusVersion: 1, stacks: 1 },
        { statusId: 'buff.focus', statusVersion: 1, stacks: 2 },
      ]),
    ).toEqual([{ label: 'Focus', value: '+3', tone: 'buff' }])
  })
})
