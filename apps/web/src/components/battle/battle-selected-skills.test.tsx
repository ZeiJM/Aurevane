import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { BattleSelectedSkills } from './battle-selected-skills'
import type { BattleRuntime } from './battle-runtime'

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
      /<strong>Empty<\/strong><div[^>]*data-battle-cockpit-controls="true"[^>]*><button[^>]*aria-label="About selected Skill slot 1"[^>]*>i<\/button><span[^>]*>4<\/span>/,
    )
    expect(markup).toMatch(
      /<strong>Severance \/ Ascension<\/strong><div[^>]*data-battle-cockpit-controls="true"[^>]*><button[^>]*>i<\/button><span[^>]*>9<\/span>/,
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
