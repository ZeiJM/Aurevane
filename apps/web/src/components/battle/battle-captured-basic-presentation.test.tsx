import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('./battle-info-popover', () => ({
  BattleInfoPopover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))
import { capturedBasicBattle } from './battle-basic-actions.test-utils'
import { BattleSkillCommand } from './battle-skill-command'
import { BattleExperience } from './battle-experience'
import { battleActionCooldownTurns } from './battle-action-cooldown'
import { applySkillCooldown } from '@aurevane/game-core/combat/skill-cooldowns'
import type { BattleRuntime } from './battle-runtime'
import { canAffordBattleBasicAction, battleBasicCostLabel } from '@/lib/battle/battle-basic-actions'

const runtime: BattleRuntime = {
  kind: 'pve',
  playerName: 'Wayfarer',
  playerLevel: 1,
  playerPortraitAssetId: 'character.creation.square-portrait-01',
  playerProfileImageUrl: null,
  supportActionId: 'basic.recover',
}

it('the existing cockpit renders captured names and all three typed costs', () => {
  const { view } = capturedBasicBattle()
  const markup = renderToStaticMarkup(<BattleExperience initialBattle={view} runtime={runtime} />)
  expect(markup).toContain('aria-label="Open Palm, 47 AP / 3 MP / 2 HP"')
  expect(markup).toContain('aria-label="Second Wind, 47 AP / 3 MP / 2 HP"')
  expect(markup).toContain('aria-label="Move, 35 AP"')
  expect(markup.match(/data-command-card="guard"/g)).toHaveLength(1)
})

it('renamed disabled captured Basics keep their complete canonical information reader', () => {
  const { view } = capturedBasicBattle('basic.recover', true)
  const basic = view.snapshot.basicActions!.find((action) => action.actionId === 'basic.recover')!
  const markup = renderToStaticMarkup(
    <BattleSkillCommand
      slot="guard"
      hotkey="3"
      label={basic.name}
      cost="47 AP / 3 MP / 2 HP"
      artworkSrc="/media/skills/hp-recovery.webp"
      active={false}
      disabled={false}
      basicAction={basic}
      onActivate={() => {}}
    />,
  )
  expect(markup).toContain('22%')
  expect(markup).toContain('data-compact-effect-label="true"')
  expect(markup).not.toContain('<dd>Unavailable</dd>')
  expect(markup).toMatch(/data-command-slot="guard"[^>]*disabled=""/)
  expect(markup.match(/<dt>Cost<\/dt>/g)).toHaveLength(1)
  expect(markup).toContain('Uses the nearest whole resource amount.')
})

it('a captured Basic cooldown key and duration outrank the built-in cooldown', () => {
  const { view } = capturedBasicBattle()
  const actor = view.snapshot.tactical.battle.combatants.find((unit) => unit.id === 'actor')!
  const next = {
    ...view,
    snapshot: {
      ...view.snapshot,
      tactical: {
        ...view.snapshot.tactical,
        battle: {
          ...view.snapshot.tactical.battle,
          combatants: view.snapshot.tactical.battle.combatants.map((unit) =>
            unit.id === actor.id
              ? applySkillCooldown(
                  unit,
                  { key: 'open-palm', ownerTurns: 4 },
                  { actionId: 'basic.attack.unarmed.basic', definitionVersion: 2 },
                ).combatant
              : unit,
          ),
        },
      },
    },
  }
  expect(battleActionCooldownTurns(next, runtime, 'actor', 'basic.attack.unarmed.basic')).toBe(4)
})

it('a Guard capture does not offer either unequipped Recovery through the existing selectors', () => {
  const { view } = capturedBasicBattle('basic.guard')
  const markup = renderToStaticMarkup(
    <BattleExperience
      initialBattle={view}
      runtime={{ ...runtime, supportActionId: 'basic.guard' }}
    />,
  )
  expect(markup).toContain('aria-label="Second Wind, 47 AP / 3 MP / 2 HP"')
  expect(markup).not.toContain('HP Recovery')
  expect(markup).not.toContain('MP Recovery')
  expect(markup.match(/data-command-card="guard"/g)).toHaveLength(1)
})

it('presentation affordability honors MP and nonlethal HP payment and rejects stale behavior choices', () => {
  const { view } = capturedBasicBattle()
  const action = view.snapshot.basicActions!.find((row) => row.actionId === 'basic.recover')!
  expect(canAffordBattleBasicAction(action, { ap: 47, mp: 3, hp: 3 })).toBe(true)
  for (const resources of [
    { ap: 46, mp: 3, hp: 3 },
    { ap: 47, mp: 2, hp: 3 },
    { ap: 47, mp: 3, hp: 2 },
  ])
    expect(canAffordBattleBasicAction(action, resources)).toBe(false)
  expect(canAffordBattleBasicAction(action, { ap: 100, mp: 100, hp: 100 }, 'removed')).toBe(false)
  expect(battleBasicCostLabel(action, '50 AP', 'removed')).toBe('Unavailable')
})
