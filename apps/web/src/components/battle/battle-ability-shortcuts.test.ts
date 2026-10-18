import { readFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import { routeBattleAbilityShortcut } from './battle-ability-shortcuts'
import type { BattleRuntime } from './battle-runtime'

const techniques: BattleRuntime['techniques'] = [
  {
    id: 'ongoing-skill',
    name: 'Ongoing Skill',
    category: 'defense',
    definition: { ability: { schemaVersion: 1, behaviors: [{ activation: 'ongoing' }] } },
  },
] as unknown as BattleRuntime['techniques']

it.each(['opponent turn', 'completed battle', 'execution in flight'])(
  'opens noncast Skill and special information during %s without previewing or committing',
  () => {
    const openInfo = vi.fn()
    const activate = vi.fn()
    const context = { techniques, special: undefined, commandsDisabled: true }
    expect(routeBattleAbilityShortcut('skill1', context, { openInfo, activate })).toBe(true)
    expect(routeBattleAbilityShortcut('essence', context, { openInfo, activate })).toBe(true)
    expect(openInfo.mock.calls).toEqual([
      ['[data-battle-skill-slot="1"] [data-battle-info-trigger]'],
      ['[data-battle-special] [data-battle-info-trigger]'],
    ])
    expect(activate).not.toHaveBeenCalled()
  },
)

it('keeps active ability commands blocked while allowing supernatural information', () => {
  const openInfo = vi.fn()
  const activate = vi.fn()
  const context = {
    techniques: [{ ...techniques![0]!, definition: undefined }],
    special: { kind: 'resonance' as const, category: 'heal' as const, skill: { id: 'active' } },
    commandsDisabled: true,
  }
  routeBattleAbilityShortcut('skill1', context, { openInfo, activate })
  routeBattleAbilityShortcut('essence', context, { openInfo, activate })
  routeBattleAbilityShortcut('supernatural', context, { openInfo, activate })
  expect(activate).not.toHaveBeenCalled()
  expect(openInfo).toHaveBeenCalledExactlyOnceWith(
    '[data-battle-special="supernatural"] [data-battle-info-trigger]',
  )
})

it('routes enabled casts through the existing command callback with their actual category', () => {
  const openInfo = vi.fn()
  const activate = vi.fn()
  const context = {
    techniques: [{ ...techniques![0]!, definition: undefined }],
    special: { kind: 'resonance' as const, category: 'heal' as const, skill: { id: 'active' } },
    commandsDisabled: false,
  }
  routeBattleAbilityShortcut('skill1', context, { openInfo, activate })
  routeBattleAbilityShortcut('essence', context, { openInfo, activate })
  expect(activate.mock.calls).toEqual([
    ['ongoing-skill', 'defense'],
    ['active', 'heal'],
  ])
  expect(openInfo).not.toHaveBeenCalled()
  expect(routeBattleAbilityShortcut('endTurn', context, { openInfo, activate })).toBe(false)
})

it('keeps read-only routing after input guards and before the controller command gate', () => {
  const source = readFileSync(new URL('./battle-experience.tsx', import.meta.url), 'utf8')
  const handler = source.slice(source.indexOf('function handleKeyDown(event: KeyboardEvent)'))
  expect(handler.indexOf('isTextEntryTarget(event.target, event.code)')).toBeLessThan(
    handler.indexOf('routeBattleAbilityShortcut('),
  )
  expect(handler.indexOf('routeBattleAbilityShortcut(')).toBeGreaterThan(0)
  expect(handler.indexOf('routeBattleAbilityShortcut(')).toBeLessThan(
    handler.indexOf('if (planningDisabled || executionLock.current) return'),
  )
})
