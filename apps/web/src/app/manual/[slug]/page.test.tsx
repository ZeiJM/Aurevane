import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
import type { CombatContentVersionRecord } from '@aurevane/db/combat-content'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { parseAbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { defaultCombatEffectTimingPolicy } from '@aurevane/game-core/combat/combat-effect-timing'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'

vi.mock('server-only', () => ({}))
const source = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('@/server/combat/combat-content-resolver', async (original) => ({
  ...(await original<object>()),
  createServerCombatContentResolver: () => ({ resolveCurrentCatalogue: source.read }),
}))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND')
  },
}))
vi.mock('@/components/public-information/public-information-shell', () => ({
  PublicInformationShell: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('@/components/public-information/discipline-atlas-guide', () => ({
  DisciplineAtlasGuide: () => <p>Discipline Atlas</p>,
}))
vi.mock('@/components/media/aurevane-image', () => ({ AurevaneImage: () => null }))

import { resolveCombatContentCatalogueSnapshot } from '@/server/combat/combat-content-resolver'
import ManualArticlePage from './page'

const native = resolveMatureSkillVersion('vanguard.forceful-strike')!
const base = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!
const ability = parseAbilityDefinition({
  schemaVersion: 1,
  behaviors: [
    {
      ...base,
      id: 'leap',
      costs: [
        { resource: 'ap', amount: 11 },
        { resource: 'mp', amount: 2 },
        { resource: 'hp', amount: 1 },
      ],
      requirements: {
        kind: 'resource-state',
        subject: 'owner',
        resource: 'mp',
        comparison: 'at-least',
        amount: 3,
      },
      activationLimits: ['once-per-battle'],
      effects: [
        { id: 'move', payload: { type: 'move', recipient: 'actor', maximumTiles: 2 } },
        {
          id: 'hit',
          timing: 'controlled',
          payload: { type: 'damage', recipient: 'primary-unit', amount: 13 },
        },
      ],
    },
    {
      ...base,
      id: 'maintain',
      activation: 'ongoing',
      mode: 'modifier',
      classification: 'utility',
      attackFamily: undefined,
      costs: [],
      cooldown: null,
      targeting: null,
      effects: [
        {
          id: 'boost',
          payload: { type: 'damage-bonus', recipient: 'actor', multiplierBasisPoints: 11250 },
        },
      ],
    },
  ],
})
function publication<
  Definition extends {
    id: string
    contentVersion: number
  },
>(definition: Definition): CombatContentVersionRecord {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    contentKey: definition.id,
    contentKind: 'skill',
    contentVersion: definition.contentVersion,
    definition: definition as unknown as Readonly<Record<string, unknown>>,
    publishedBy: '22222222-2222-4222-8222-222222222222',
    publishedAt: '2026-10-15T12:00:00Z',
  }
}
const page = async (slug = 'techniques-damage-effects') =>
  renderToStaticMarkup(await ManualArticlePage({ params: Promise.resolve({ slug }) }))

beforeEach(() => {
  source.read.mockReset()
})

it('renders the real current canonical catalogue and every edited Basic from one coherent read', async () => {
  const basics = defaultBasicSkills().map((row, index) => ({
    ...row,
    name: `Edited Basic ${index} <once> &`,
    contentVersion: row.contentVersion + 1,
    ability: parseAbilityDefinition({
      schemaVersion: 1,
      behaviors: [
        {
          ...row.ability.behaviors[0]!,
          costs: [{ resource: 'ap', amount: 21 + index }],
        },
      ],
    }),
  }))
  const catalogue = resolveCombatContentCatalogueSnapshot({
    token: 'private-catalogue-token',
    policy: defaultCombatEffectTimingPolicy(),
    publications: [publication({ ...native, ability, apCost: 71 }), ...basics.map(publication)],
  })
  const before = JSON.stringify(catalogue)
  source.read.mockResolvedValue(catalogue)
  const html = await page()
  const text = html.replace(/<[^>]*>/g, '')
  expect(html).toContain('Edited Basic 0 &lt;once&gt; &amp;')
  for (const value of [
    'Manual Action 1',
    'Ongoing Modifier 2',
    '11 AP / 2 MP / 1 HP',
    'MP [≥ 3] [Self]',
    'Move [2]',
    'Dmg [13] [Controlled]',
    'Once per battle',
    '12.5%',
    'Active while Requirements are met',
  ])
    expect(text).toContain(value)
  expect(html).toContain('data-compact-effect-label="true"')
  expect(html).not.toContain('71 AP')
  expect(html).not.toContain('private-catalogue-token')
  expect(html).not.toContain('accuracyRule')
  expect(html).not.toContain('multiplierBasisPoints')
  for (const [index] of basics.entries()) {
    expect(html).toContain(`Edited Basic ${index}`)
    expect(html).toContain(`${21 + index} AP`)
  }
  expect(JSON.stringify(catalogue)).toBe(before)
})

it('respects a disabled current override instead of resurrecting its builtin Technique', async () => {
  source.read.mockResolvedValue(
    resolveCombatContentCatalogueSnapshot({
      token: 'disabled',
      policy: defaultCombatEffectTimingPolicy(),
      publications: [publication({ ...native, enabled: false })],
    }),
  )
  const html = await page()
  expect(html).not.toContain('Forceful Strike —')
  expect(html).toContain('135 Techniques')
})

it('includes a custom current Technique and an explicitly published older version', async () => {
  source.read.mockResolvedValue(
    resolveCombatContentCatalogueSnapshot({
      token: 'old-and-custom',
      policy: defaultCombatEffectTimingPolicy(),
      publications: [
        publication({ ...native, contentVersion: 1, apCost: 55 }),
        publication({ ...native, id: 'vanguard.manual-fixture', apCost: 60 }),
      ],
    }),
  )
  const html = await page()
  expect(html).toMatch(/Forceful Strike —[^<]*55 AP/)
  expect(html).toMatch(/Manual Fixture —[^<]*60 AP/)
  expect(html).toContain('137 Techniques')
})

it('does not replace an unavailable current catalogue with stale builtin rules', async () => {
  source.read.mockRejectedValue(new Error('CATALOGUE_UNAVAILABLE'))
  await expect(page()).rejects.toThrow('CATALOGUE_UNAVAILABLE')
})

it('uses the timing policy from the same current snapshot for unwrapped modular effects', async () => {
  const policy = defaultCombatEffectTimingPolicy()
  source.read.mockResolvedValue(
    resolveCombatContentCatalogueSnapshot({
      token: 'current-policy',
      policy: { ...policy, modes: { ...policy.modes, damage: 'controlled' } },
      publications: [],
    }),
  )
  expect(await page()).toMatch(/Dmg \[[^<]*?\] \[Controlled\]/)
})

it('keeps unrelated guides, the Atlas and unknown-slug handling independent of the combat catalogue', async () => {
  source.read.mockRejectedValue(new Error('CATALOGUE_UNAVAILABLE'))
  expect(await page('start-here')).toContain('Start Here')
  expect(await page('disciplines-mastery')).toContain('Discipline Atlas')
  await expect(page('missing-guide')).rejects.toThrow('NOT_FOUND')
})
