import { describe, expect, it } from 'vitest'

import {
  aggregateBattleStatusStacks,
  statusLabel,
  statusIsBeneficial,
  statusDurationLabel,
  formatStatusStackCount,
  summarizeBattleEffects,
} from './battle-effect-summary'

describe('battle effect summary', () => {
  it('keeps positional lifetime separate and provides legacy adapter labels without a turn count', () => {
    const terrain = {
      statusId: 'terrain-evasion',
      statusVersion: 1,
      stacks: 1,
      potencyBasisPoints: 1500,
      remainingOwnerTurnStarts: 1,
      presentationDuration: 'while-elevated' as const,
    }
    const unknown = { ...terrain, presentationDuration: undefined }
    expect(aggregateBattleStatusStacks([terrain, unknown])).toEqual([terrain, unknown])
    expect(statusLabel(terrain.statusId, terrain)).toBe('Elevation Evasion')
    expect(statusIsBeneficial(terrain.statusId, terrain)).toBe(true)
    expect(statusDurationLabel(terrain)).toBe('While on elevated terrain')
    expect(statusDurationLabel(unknown)).toBe('1 turn remaining')
    expect(
      summarizeBattleEffects([
        terrain,
        { ...terrain, statusId: 'terrain-defense', potencyBasisPoints: 2000 },
      ]),
    ).toEqual([])
  })
  it('uses every recorded magnitude in a grouped current effect', () => {
    expect(
      summarizeBattleEffects([
        {
          statusId: 'guarded',
          statusVersion: 1,
          stacks: 2,
          potencyBasisPoints: 4000,
          applicationModifiers: [
            { stacks: 1, sourceCombatantId: 'actor', potencyBasisPoints: 1500 },
            { stacks: 1, sourceCombatantId: 'actor', potencyBasisPoints: 4000 },
          ],
        },
      ]),
    ).toEqual([{ label: 'DMG IN', value: '−49%', tone: 'buff' }])
  })
  it('finishes huge counts once the rounded reduction stabilizes or the display exceeds safe precision', () => {
    const status = { statusId: 'guarded', statusVersion: 1, stacks: Number.MAX_SAFE_INTEGER }
    expect(summarizeBattleEffects([status])[0]!.value).toBe('−100.0%')
    expect(summarizeBattleEffects([{ ...status, statusId: 'exposed' }])).toEqual([
      { label: 'DMG IN', value: 'Very high', tone: 'debuff' },
    ])
  })

  it('compounds recorded Guard/Expose potency instead of the catalog defaults', () => {
    expect(
      summarizeBattleEffects([
        { statusId: 'guarded', statusVersion: 1, stacks: 2, potencyBasisPoints: 1000 },
      ]),
    ).toEqual([{ label: 'DMG IN', value: '−19%', tone: 'buff' }])
    expect(
      summarizeBattleEffects([
        { statusId: 'exposed', statusVersion: 1, stacks: 1, potencyBasisPoints: 1100 },
      ]),
    ).toEqual([{ label: 'DMG IN', value: '111%', tone: 'debuff' }])
  })

  it('keeps same-identity effects with different recorded potency independently inspectable', () => {
    const first = { statusId: 'guarded', statusVersion: 1, stacks: 1, potencyBasisPoints: 1000 }
    const second = { ...first, potencyBasisPoints: 2000 }
    expect(aggregateBattleStatusStacks([first, second])).toEqual([first, second])
    expect(summarizeBattleEffects([first, second])).toEqual([
      { label: 'DMG IN', value: '−28%', tone: 'buff' },
    ])
    expect(summarizeBattleEffects([{ ...second, timingState: 'pending' }])).toEqual([])
  })
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
