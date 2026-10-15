import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

// Mount the portalled reader's children during SSR; its native lifecycle is covered by the browser matrix.
vi.mock('./battle-info-popover', () => ({
  BattleInfoPopover: ({ label, children }: { label: string; children: ReactNode }) => (
    <>
      <button type="button" aria-label={label}>
        i
      </button>
      {children}
    </>
  ),
}))

import { BattleSelectedSkills } from './battle-selected-skills'
import type { BattleRuntime } from './battle-runtime'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { abilityBehaviorInformation } from '../character/ability-detail-presentation'

const technique = {
  id: 'vanguard.forceful-strike',
  contentVersion: 2,
  sourceDisciplineId: 'vanguard',
  name: 'Forceful Strike',
  apCost: 15,
  mpCost: 0,
  cooldownOwnerTurns: 2,
  category: 'attack' as const,
  targetKind: 'unit' as const,
  targetTeamPolicy: 'enemy' as const,
  minimumRange: 1,
  maximumRange: 1,
  tags: ['Enemy', 'Single', 'Dmg [8]'],
  effectDescriptions: ['Deal damage.'],
  requirementDescriptions: [],
}

const runtime: BattleRuntime = {
  kind: 'pve',
  playerName: 'Wayfarer',
  playerLevel: 1,
  playerPortraitAssetId: 'character.portrait.starter.wayfarer-01',
  playerProfileImageUrl: null,
  techniques: [],
  resonance: null,
  essence: null,
}

it('free Controlled preparation bypasses payment/cooldown selection gates while ready light is release-only', () => {
  const render = (primeAvailable: boolean, readyActionId?: string, disabled = false) =>
    renderToStaticMarkup(
      <BattleSelectedSkills
        runtime={{ ...runtime, techniques: [technique] }}
        disabled={disabled}
        actionEconomy={0}
        cooldowns={{ [technique.id]: 2 }}
        primeAvailableIds={primeAvailable ? [technique.id] : []}
        readyActionId={readyActionId}
        onSelect={vi.fn()}
      />,
    )
  const prime = render(true)
  expect(prime).not.toMatch(/data-battle-skill-hotkey="4"[^>]*disabled/)
  expect(prime).not.toContain('data-battle-controlled-ready="true"')
  expect(render(true, undefined, true)).toMatch(/data-battle-skill-hotkey="4"[^>]*disabled/)
  const ready = render(false, technique.id)
  // Disabled commands never advertise readiness even if a stale parent supplied an ID.
  expect(ready).not.toContain('data-battle-controlled-ready="true"')
  const legal = renderToStaticMarkup(
    <BattleSelectedSkills
      runtime={{ ...runtime, techniques: [technique] }}
      disabled={false}
      actionEconomy={100}
      readyActionId={technique.id}
      onSelect={vi.fn()}
    />,
  )
  expect(legal.match(/data-battle-controlled-ready="true"/g)).toHaveLength(1)
  expect(legal).toContain('ready to release')
  expect(legal).not.toMatch(/Primed|>Release</)
})

describe('battle Skill presentation', () => {
  it('places click information before the hotkey below every cockpit name, including empty slots', () => {
    const markup = renderToStaticMarkup(
      <BattleSelectedSkills runtime={runtime} disabled actionEconomy={0} onSelect={vi.fn()} />,
    )
    expect(markup.match(/data-battle-cockpit-controls="true"/g)).toHaveLength(6)
    expect(markup).toMatch(
      /<strong>Empty<\/strong><div[^>]*data-battle-cockpit-controls="true"[^>]*><button[^>]*aria-label="About selected Skill slot 1"[^>]*>i<\/button>[\s\S]*?<span[^>]*>4<\/span>/,
    )
    expect(markup).toMatch(
      /<strong>Severance \/ Ascension<\/strong><div[^>]*data-battle-cockpit-controls="true"[^>]*><button[^>]*>i<\/button>[\s\S]*?<span[^>]*>9<\/span>/,
    )
  })

  it('renders four hotkey slots followed by power and supernatural information, without replacing basic commands', () => {
    const markup = renderToStaticMarkup(
      <BattleSelectedSkills
        runtime={{ ...runtime, techniques: [{ ...technique, cooldownOwnerTurns: 1 }] }}
        disabled={false}
        actionEconomy={100}
        onSelect={vi.fn()}
      />,
    )
    expect(markup).toContain('data-battle-skill-slot="1"')
    expect(markup).toContain('data-battle-skill-slot="4"')
    expect(markup).toContain('data-battle-skill-hotkey="4"')
    expect(markup).toContain('About Forceful Strike')
    expect(markup).toContain('Vanguard')
    expect(markup).toContain('Severance / Ascension')
    expect(markup).not.toContain('Coming soon')
  })
})

describe('selected Skill cooldown presentation', () => {
  it('blocks Technique and Essence selection but keeps all information accessible', () => {
    const essence = {
      ...technique,
      id: 'essence.fixture',
      name: 'Fixture Essence',
      description: '',
      cooldownOwnerTurns: 1,
    }
    const markup = renderToStaticMarkup(
      <BattleSelectedSkills
        runtime={{ ...runtime, techniques: [technique], essence }}
        disabled={false}
        actionEconomy={100}
        cooldowns={{ [technique.id]: 2, [essence.id]: 1 }}
        onSelect={vi.fn()}
      />,
    )
    expect(markup.match(/data-battle-cooldown-countdown="true"/g)).toHaveLength(2)
    expect(markup).toMatch(/aria-label="Selected Forceful Strike[^>]*disabled/)
    expect(markup).toMatch(/aria-label="Fixture Essence[^>]*disabled/)
    expect(markup).not.toMatch(/data-battle-info-trigger="true"[^>]*disabled/)
  })
})

describe('captured Manual payment presentation', () => {
  const costs = [
    { resource: 'ap' as const, amount: 11 },
    { resource: 'mp' as const, amount: 2 },
    { resource: 'hp' as const, amount: 1 },
  ]
  const captures = [
    {
      ownerCombatantId: 'actor',
      actionId: technique.id,
      behaviorId: 'use',
      costs,
      cooldown: null,
      report: abilityBehaviorInformation({
        ...defaultBasicSkills().find((row) => row.id === 'basic.guard')!.ability.behaviors[0]!,
        costs,
        cooldown: null,
        effects: [
          { id: 'barrier', payload: { type: 'barrier-change', recipient: 'actor', amount: 17 } },
        ],
      }),
      target: {
        kind: 'self' as const,
        teamPolicy: 'self' as const,
        friendlyFire: 'allies-only' as const,
        shape: { kind: 'single' as const },
        minimumRange: 0,
        maximumRange: 0,
        maximumElevationDifference: null,
        requiresLineOfSight: false,
      },
    },
  ]
  const render = (ap: number, mp: number, hp: number, prime = false) =>
    renderToStaticMarkup(
      <BattleSelectedSkills
        runtime={{
          ...runtime,
          techniques: [technique],
          essence: { ...technique, description: '' },
        }}
        actorId="actor"
        manualActionTargets={captures}
        resources={{ mp, hp }}
        disabled={false}
        actionEconomy={ap}
        primeAvailableIds={prime ? [technique.id] : []}
        readyActionId={technique.id}
        onSelect={vi.fn()}
      />,
    )
  it('enables an edited 11 AP Skill and Essence at 12 AP and labels all three captured costs', () => {
    const markup = render(12, 2, 2)
    expect(markup).not.toMatch(/data-battle-skill-hotkey="4"[^>]*disabled/)
    expect(markup).not.toMatch(/Essence,[^>]*disabled/)
    expect(markup).toContain('11 AP / 2 MP / 1 HP')
    expect(markup).not.toContain('15 AP')
    expect(markup.match(/data-battle-controlled-ready="true"/g)).toHaveLength(2)
  })
  it('uses the captured complete group report for both Skill and Essence information readers', () => {
    const markup = render(12, 2, 2)
    expect(markup.match(/data-compact-effect-magnitude="true">\[17\]<\/span>/g)).toHaveLength(2)
    expect(markup).not.toContain('Deal damage.')
    expect(markup.match(/<dt>Skill Type<\/dt><dd>Utility<\/dd>/g)).toHaveLength(2)
  })
  it.each([
    [10, 2, 2],
    [100, 1, 2],
    [100, 2, 1],
  ])(
    'blocks unaffordable captured payment at AP%s/MP%s/HP%s without a ready light',
    (ap, mp, hp) => {
      const markup = render(ap, mp, hp)
      expect(markup).toMatch(/data-battle-skill-hotkey="4"[^>]*disabled/)
      expect(markup).not.toContain('data-battle-controlled-ready="true"')
    },
  )
  it('still allows a free prime when captured release costs cannot be paid', () => {
    expect(render(0, 0, 1, true)).not.toMatch(/data-battle-skill-hotkey="4"[^>]*disabled/)
  })
})

it('keeps separate owners and explicit Manual group prices out of the old flat cost gate', () => {
  const target = {
    kind: 'self' as const,
    teamPolicy: 'self' as const,
    friendlyFire: 'allies-only' as const,
    shape: { kind: 'single' as const },
    minimumRange: 0,
    maximumRange: 0,
    maximumElevationDifference: null,
    requiresLineOfSight: false,
  }
  const captures = [
    {
      ownerCombatantId: 'other',
      actionId: technique.id,
      behaviorId: 'free',
      target,
      costs: [],
      cooldown: null,
    },
    {
      ownerCombatantId: 'actor',
      actionId: technique.id,
      behaviorId: 'expensive',
      target,
      costs: [{ resource: 'ap' as const, amount: 27 }],
      cooldown: null,
    },
    {
      ownerCombatantId: 'actor',
      actionId: technique.id,
      behaviorId: 'cheap',
      target,
      costs: [{ resource: 'ap' as const, amount: 11 }],
      cooldown: null,
    },
  ]
  const render = (behaviorId?: string) =>
    renderToStaticMarkup(
      <BattleSelectedSkills
        runtime={{ ...runtime, techniques: [technique] }}
        actorId="actor"
        manualActionTargets={captures}
        selectedBehavior={behaviorId ? { actionId: technique.id, behaviorId } : null}
        resources={{ mp: 0, hp: 100 }}
        disabled={false}
        actionEconomy={20}
        onSelect={vi.fn()}
      />,
    )
  expect(render()).toContain('Choose action')
  expect(render()).not.toMatch(/data-battle-skill-hotkey="4"[^>]*disabled/)
  expect(render('expensive')).toContain('27 AP')
  expect(render('expensive')).toMatch(/data-battle-skill-hotkey="4"[^>]*disabled/)
  expect(render('cheap')).toContain('11 AP')
  expect(render('cheap')).not.toMatch(/data-battle-skill-hotkey="4"[^>]*disabled/)
  expect(render('free')).toContain('Unavailable')
  expect(render('free')).toMatch(/data-battle-skill-hotkey="4"[^>]*disabled/)
})
it('retains pinned historical costs when an older geometry-only row omitted payment metadata', () => {
  const markup = renderToStaticMarkup(
    <BattleSelectedSkills
      runtime={{ ...runtime, techniques: [technique] }}
      disabled={false}
      actionEconomy={20}
      onSelect={vi.fn()}
      manualActionTargets={[
        {
          actionId: technique.id,
          behaviorId: 'use',
          target: {
            kind: 'self',
            teamPolicy: 'self',
            friendlyFire: 'allies-only',
            shape: { kind: 'single' },
            minimumRange: 0,
            maximumRange: 0,
            maximumElevationDifference: null,
            requiresLineOfSight: false,
          },
        },
      ]}
    />,
  )
  expect(markup).toContain('15 AP')
  expect(markup).not.toMatch(/data-battle-skill-hotkey="4"[^>]*disabled/)
})
