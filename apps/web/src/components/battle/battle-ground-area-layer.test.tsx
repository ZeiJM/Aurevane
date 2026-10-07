import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BattleGroundAreaLayer } from './battle-ground-area-layer'
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
