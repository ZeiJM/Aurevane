import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BattleGroundAreaLayer, battleGroundAreaDescriptions } from './battle-ground-area-layer'
const area = {
  id: 'ground.area.1',
  tiles: [{ x: 1, y: 1 }],
  activationRound: 2,
  expiresAtRound: 5,
  visualPresetId: 'embers' as const,
}
function render(round: number, position = { x: 1, y: 1 }) {
  return renderToStaticMarkup(
    createElement(BattleGroundAreaLayer, { areas: [area], round, position }),
  )
}
describe('shared persistent Ground layer', () => {
  it('uses a static pending marker and switches directly to its active animation', () => {
    expect(render(1)).toContain('data-ground-area-phase="pending"')
    expect(render(2)).toContain('data-ground-area-phase="active"')
    expect(render(2)).toContain('data-ground-area-preset="embers"')
    expect(render(4)).toContain('1 round')
  })
  it('disappears at expiry and never fills an unlisted tile', () => {
    expect(render(5)).toBe('')
    expect(render(2, { x: 0, y: 1 })).toBe('')
  })
})

it.each([
  ['all', 'Affects all characters'],
  ['all-except-self', 'Affects all except caster'],
  ['enemies', 'Affects caster’s enemies'],
  ['allies', 'Affects caster’s allies'],
  ['self', 'Affects caster'],
  ['allies-except-self', 'Affects caster’s allies except caster'],
] as const)(
  'shows captured %s membership in tile and Inspect descriptions',
  (targetTeams, label) => {
    const current = { ...area, targetTeams, effectVisualIds: ['damage'] as const }
    const descriptions = battleGroundAreaDescriptions([current], 2, { x: 1, y: 1 })
    expect(descriptions).toEqual([`Damage Ground · 3 rounds remaining · ${label}`])
    expect(
      renderToStaticMarkup(
        createElement(BattleGroundAreaLayer, {
          areas: [current],
          round: 2,
          position: { x: 1, y: 1 },
        }),
      ),
    ).toContain(label)
    expect(battleGroundAreaDescriptions([area], 2, { x: 1, y: 1 })).toEqual([
      'Embers · 3 rounds remaining',
    ])
  },
)

it('renders gentle shared Steam mist and suppresses frost on converted tiles', () => {
  const html = renderToStaticMarkup(
    createElement(BattleGroundAreaLayer, {
      areas: [{ ...area, visualPresetId: 'frost', steamTiles: [{ x: 1, y: 1 }] }],
      round: 2,
      position: { x: 1, y: 1 },
      steam: true,
    }),
  )
  expect(html).toContain('data-ground-steam-mist="true"')
  expect(html).not.toContain('data-ground-area-preset="frost"')
})

it('distinguishes current Damage, Pierce, Chilled and defense fields and exposes the real pending round', () => {
  const current = {
    ...area,
    effectVisualIds: ['damage', 'pierce', 'status:frozen', 'status:guarded'] as const,
  }
  const html = renderToStaticMarkup(
    createElement(BattleGroundAreaLayer, { areas: [current], round: 1, position: { x: 1, y: 1 } }),
  )
  for (const id of current.effectVisualIds) expect(html).toContain(`data-ground-effect-id="${id}"`)
  expect(html).toContain('data-ground-area-preset="embers"')
  expect(html).toContain('Starts round 2')
  expect(html).toContain('data-ground-area-clock="true"')
  expect(html).toContain('◷2')
  expect(html).toContain('Chilled Ground')
  expect(html).not.toContain('Frozen Ground')
  const glyphs = [...html.matchAll(/<svg[^>]*>([^]*?)<\/svg>/gu)].map((match) => match[1])
  expect(glyphs).toHaveLength(4)
  expect(new Set(glyphs).size).toBe(4)
})
it('renders the authored preset independently of current Damage and Burn markers', () => {
  const current = {
    ...area,
    visualPresetId: 'frost' as const,
    effectVisualIds: ['damage', 'status:burn'] as const,
  }
  const before = structuredClone(current)
  const html = renderToStaticMarkup(
    createElement(BattleGroundAreaLayer, { areas: [current], round: 1, position: { x: 1, y: 1 } }),
  )
  expect(html).toContain(`data-ground-area-id="${current.id}"`)
  expect(html).toContain('data-ground-area-preset="frost"')
  expect(html).not.toContain('data-ground-area-preset="arcane-pulse"')
  expect(html).toContain('data-ground-effect-id="damage"')
  expect(html).toContain('data-ground-effect-id="status:burn"')
  expect(current).toEqual(before)
})

it('keeps identical logical effects and lifetimes when choosing each distinct Ground preset', async () => {
  const { COMBAT_GROUND_VISUAL_PRESETS } =
    await import('@aurevane/game-core/combat/combat-ground-visuals')
  for (const preset of COMBAT_GROUND_VISUAL_PRESETS) {
    const current = { ...area, visualPresetId: preset.id, effectVisualIds: ['damage'] as const }
    const html = renderToStaticMarkup(
      createElement(BattleGroundAreaLayer, {
        areas: [current],
        round: 2,
        position: { x: 1, y: 1 },
      }),
    )
    expect(html, preset.id).toContain(`data-ground-area-preset="${preset.id}"`)
    expect(html, preset.id).toContain('data-ground-effect-id="damage"')
    expect(html, preset.id).toContain('Damage Ground · 3 rounds remaining')
  }
})
it('keeps overlapping field lifetimes separate and removes clocks immediately upon activation', () => {
  const fields = [
    { ...area, effectVisualIds: ['damage'] as const },
    {
      ...area,
      id: 'ground.area.2',
      expiresAtRound: 7,
      effectVisualIds: ['status:guarded'] as const,
    },
  ]
  const html = renderToStaticMarkup(
    createElement(BattleGroundAreaLayer, { areas: fields, round: 2, position: { x: 1, y: 1 } }),
  )
  expect(html).toContain('Damage Ground · 3 rounds remaining')
  expect(html).toContain('Guard Ground · 5 rounds remaining')
  expect(html).not.toContain('data-ground-area-clock')
})

it('gives every registered current Ground identity a distinct SVG rather than a fallback code', async () => {
  const { COMBAT_GROUND_EFFECT_VISUALS } =
    await import('@aurevane/game-core/combat/combat-ground-visuals')
  const { GroundEffectIcon } = await import('./battle-ground-effect-visuals')
  const glyphs = COMBAT_GROUND_EFFECT_VISUALS.map(({ id }) => {
    const html = renderToStaticMarkup(createElement(GroundEffectIcon, { id }))
    expect(html, id).toContain('<svg')
    return html.match(/<path d="([^"]+)"/u)![1]
  })
  expect(new Set(glyphs).size).toBe(glyphs.length)
})

it('groups repeated logical identifiers across overlapping casts while retaining each lifetime in inspection', () => {
  const fields = [
    { ...area, effectVisualIds: ['status:guarded'] as const },
    {
      ...area,
      id: 'ground.area.2',
      expiresAtRound: 7,
      effectVisualIds: ['status:guarded'] as const,
    },
    { ...area, id: 'ground.area.3', effectVisualIds: ['damage'] as const },
  ]
  const html = renderToStaticMarkup(
    createElement(BattleGroundAreaLayer, { areas: fields, round: 2, position: { x: 1, y: 1 } }),
  )
  expect(html.match(/data-ground-effect-id="status:guarded"/gu)).toHaveLength(1)
  expect(html).toContain('Guard Ground · 3 rounds remaining')
  expect(html).toContain('Guard Ground · 5 rounds remaining')
  expect(html).toContain('<small>5</small>')
  expect(html).toContain('data-ground-effect-id="damage"')
})
