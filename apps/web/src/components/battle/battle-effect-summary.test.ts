import { describe, expect, it } from 'vitest'

import { summarizeBattleEffects } from './battle-effect-summary'

describe('battle effect summary', () => {
  it('shows Lowered Guard as 250% incoming damage instead of a +150% delta', () => {
    expect(
      summarizeBattleEffects([{ statusId: 'lowered-guard', statusVersion: 1, stacks: 1 }]),
    ).toEqual([
      { label: 'DMG IN', value: '250%', tone: 'debuff' },
      { label: 'DEBUFF', value: '−1', tone: 'debuff' },
    ])
  })

  it('keeps Guard presented as a 15% incoming-damage reduction', () => {
    expect(summarizeBattleEffects([{ statusId: 'guarded', statusVersion: 1, stacks: 1 }])).toEqual([
      { label: 'DMG IN', value: '−15%', tone: 'buff' },
      { label: 'BUFF', value: '+1', tone: 'buff' },
    ])
  })
})
