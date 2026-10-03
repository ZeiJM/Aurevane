import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { BattleSelectedSkills } from './battle-selected-skills'
import type { BattleRuntime } from './battle-runtime'

const runtime: BattleRuntime = {
  kind: 'pve',
  playerName: 'Wayfarer',
  playerLevel: 1,
  playerPortraitAssetId: 'character.portrait.starter.wayfarer-01',
  playerProfileImageUrl: null,
  techniques: [],
  resonance: null,
  essence: null,
  copiedSkills: [
    {
      id: 'temporary.copy.vanguard.forceful-strike.v2',
      sourceSkillId: 'vanguard.forceful-strike',
      contentVersion: 2,
      sourceDisciplineId: 'vanguard',
      name: 'Forceful Strike',
      apCost: 15,
      mpCost: 0,
      category: 'attack',
      targetKind: 'unit',
      targetTeamPolicy: 'enemy',
      minimumRange: 1,
      maximumRange: 1,
      tags: ['Enemy', 'Single', 'Copied'],
      effectDescriptions: ['Deal damage.'],
      requirementDescriptions: [],
    },
    {
      id: 'temporary.copy.lifebinder.barrier.v1',
      sourceSkillId: 'lifebinder.barrier',
      contentVersion: 1,
      sourceDisciplineId: 'lifebinder',
      name: 'Barrier',
      apCost: 20,
      mpCost: 0,
      category: 'defense',
      targetKind: 'unit',
      targetTeamPolicy: 'ally',
      minimumRange: 1,
      maximumRange: 3,
      tags: ['Ally', 'Single', 'Copied'],
      effectDescriptions: ['Grant Barrier.'],
      requirementDescriptions: [],
    },
  ],
}

describe('battle copied Skill presentation', () => {
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
        runtime={{
          ...runtime,
          techniques: [
            { ...runtime.copiedSkills![0]!, id: 'vanguard.forceful-strike', cooldownOwnerTurns: 1 },
          ],
        }}
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
  it('renders one compact Copied Skills group instead of extra committed Skill slots', () => {
    const markup = renderToStaticMarkup(
      <BattleSelectedSkills
        runtime={runtime}
        activeId="temporary.copy.vanguard.forceful-strike.v2"
        disabled={false}
        actionEconomy={100}
        onSelect={vi.fn()}
      />,
    )

    expect(markup.match(/data-battle-copied-skills="true"/g)).toHaveLength(1)
    expect(markup.match(/data-battle-copied-skill-option=/g)).toHaveLength(2)
    expect(markup).toContain('Copied Skills')
    expect(markup).toContain('2 battle-only')
    expect(markup.match(/aria-label="Empty selected Skill slot"/g)).toHaveLength(4)
  })
})

describe('selected Skill cooldown presentation', () => {
  it('blocks Technique, Essence and copied selection but keeps all information accessible', () => {
    const technique = {
      ...runtime.copiedSkills![0]!,
      id: 'vanguard.forceful-strike',
      cooldownOwnerTurns: 2,
    }
    const essence = {
      ...technique,
      id: 'essence.fixture',
      name: 'Fixture Essence',
      description: '',
    }
    const markup = renderToStaticMarkup(
      <BattleSelectedSkills
        runtime={{ ...runtime, techniques: [technique], essence }}
        disabled={false}
        actionEconomy={100}
        cooldowns={{ [technique.id]: 2, [essence.id]: 1, [runtime.copiedSkills![0]!.id]: 2 }}
        onSelect={vi.fn()}
      />,
    )
    expect(markup.match(/data-battle-cooldown-countdown="true"/g)).toHaveLength(3)
    expect(markup).toMatch(/aria-label="Selected Forceful Strike[^>]*disabled/)
    expect(markup).toMatch(/aria-label="Fixture Essence[^>]*disabled/)
    expect(markup).toMatch(
      /data-battle-copied-skill-option="temporary.copy.vanguard.forceful-strike.v2"[^>]*disabled/,
    )
    expect(markup).not.toMatch(/data-battle-info-trigger="true"[^>]*disabled/)
  })
})
