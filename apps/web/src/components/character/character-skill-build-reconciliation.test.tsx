import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { CharacterSkillBuildPanel } from './character-skill-build-panel'

const hooks = vi.hoisted(() => ({ state: 0, touch: false }))
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    useSyncExternalStore: () => true,
    useState: (initial: unknown) => actual.useState(hooks.state++ === 10 ? hooks.touch : initial),
  }
})
vi.mock('react-dom', async () => ({
  ...(await vi.importActual('react-dom')),
  createPortal: (children: unknown) => children,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/game/character',
  useSearchParams: () => new URLSearchParams('profilePanel=techniques'),
}))
vi.mock('next/image', () => ({
  default: (props: { src?: string }) => <span data-test-image={props.src} />,
}))

it.each([false, true])(
  'preserves canonical captured reports and current-main %s touch equip controls together',
  (touch) => {
    hooks.state = 0
    hooks.touch = touch
    vi.stubGlobal('document', { body: {} })
    const legacy = resolveMatureSkillVersion('vanguard.forceful-strike')!
    const definition = {
      ...legacy,
      ability: {
        schemaVersion: 1 as const,
        behaviors: defaultBasicSkills()
          .find((row) => row.id === 'unarmed.basic')!
          .ability.behaviors.map((row) => ({
            ...row,
            costs: [{ resource: 'ap' as const, amount: 17 }],
            effects: [
              {
                id: 'authored-hit',
                timing: 'controlled' as const,
                payload: {
                  type: 'damage' as const,
                  recipient: 'primary-unit' as const,
                  amount: 13,
                },
              },
            ],
          })),
      },
    }
    try {
      const html = renderToStaticMarkup(
        <CharacterSkillBuildPanel
          characterId="character-1"
          initialBuildVersion={2}
          primaryDiscipline={{ id: 'vanguard', name: 'Vanguard' }}
          secondaryDiscipline={null}
          initialCapacity={4}
          initialLearnedSkills={[
            { definition, learnedAt: '2026-10-18T02:00:00Z', activeSource: true },
          ]}
          initialEquippedSkills={[]}
          initialResonance={null}
          initialEssence={null}
        />,
      )
      expect(html).toContain('17 AP')
      expect(html).toContain('data-ability-behavior="use"')
      expect(html).toContain('Controlled')
      expect(html).toContain('Dmg')
      expect(html.includes('Equip technique')).toBe(touch)
      expect(html).toContain('data-testid="technique-preview"')
    } finally {
      vi.unstubAllGlobals()
    }
  },
)

it('shows one shared Skill with explicit active eligibility choices and truthful testing access', () => {
  hooks.state = 0
  hooks.touch = false
  vi.stubGlobal('document', { body: {} })
  const definition = resolveMatureSkillVersion('lifebinder.mending-light')!
  try {
    const html = renderToStaticMarkup(
      <CharacterSkillBuildPanel
        characterId="character-1"
        initialBuildVersion={2}
        primaryDiscipline={{ id: 'vanguard', name: 'Vanguard' }}
        secondaryDiscipline={{ id: 'aetherist', name: 'Aetherist' }}
        initialCapacity={4}
        initialLearnedSkills={[
          {
            definition,
            learnedAt: '2026-10-20T00:00:00Z',
            activeSource: true,
            eligibilityGrants: [
              { eligibilityDisciplineId: 'vanguard', activeSource: true, earnedAt: null },
              {
                eligibilityDisciplineId: 'aetherist',
                activeSource: true,
                earnedAt: '2026-10-21T00:00:00Z',
              },
            ],
          },
        ]}
        initialEquippedSkills={[
          {
            definition,
            slotIndex: 1,
            equippedAt: '2026-10-21T00:00:00Z',
            eligibilityDisciplineId: 'aetherist',
          },
        ]}
        initialResonance={null}
        initialEssence={null}
      />,
    )
    expect(html).toContain('aria-label="Eligible Discipline for Mending Light"')
    expect(html).toContain('value="aetherist" selected=""')
    expect(html).toContain('Vanguard — Available (unearned)')
    expect(html).toContain('Aetherist — Earned')
    expect(html.match(/data-selected="true"/g) ?? []).toHaveLength(2) // one Skill plus Guard
  } finally {
    vi.unstubAllGlobals()
  }
})
