import { createElement, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { WorldPlayer, WorldPosition } from '@/world/types'
import { WorldNearbyPlayer, type WorldNearbyPlayerProps } from './world-nearby-player'

const ownerPosition: WorldPosition = { sectorId: 'atlas:58:28', x: 6, y: 4 }
const player: WorldPlayer = {
  characterId: 'nearby-peer',
  name: 'Sellophina of the Unbroken Dawn',
  level: 3,
  portraitRef: '',
  imageUrl: '/original-clear-portrait.webp',
  online: true,
  attackable: false,
  position: { ...ownerPosition, x: 9 },
}
function props(overrides: Partial<WorldNearbyPlayerProps> = {}): WorldNearbyPlayerProps {
  return {
    player,
    ownerPosition,
    disabled: false,
    approaching: false,
    attacking: false,
    selected: false,
    onApproach: vi.fn(),
    onAttack: vi.fn(),
    ...overrides,
  }
}
function render(overrides: Partial<WorldNearbyPlayerProps> = {}) {
  return renderToStaticMarkup(createElement(WorldNearbyPlayer, props(overrides)))
}
function buttons(markup: string) {
  return [...markup.matchAll(/<button\b([^>]*)>([^<]*)<\/button>/g)].map((match) => ({
    attributes: match[1],
    label: match[2],
  }))
}
function primary(node: ReactNode): { onClick?: () => void } | undefined {
  if (Array.isArray(node)) return node.map(primary).find(Boolean)
  if (
    !isValidElement<{
      children?: ReactNode
      'data-world-primary-action'?: string
      onClick?: () => void
    }>(node)
  )
    return undefined
  if (node.props['data-world-primary-action']) return node.props
  return primary(node.props.children)
}

describe('World Nearby player card', () => {
  it('keeps the original portrait sharp in a 36px slot and the complete identity readable', () => {
    const markup = render()
    expect(markup).toContain('data-world-player="nearby-peer"')
    expect(markup).toContain('width="36"')
    expect(markup).toContain('height="36"')
    expect(markup).toContain('src="/original-clear-portrait.webp"')
    expect(markup).toContain('<strong>Sellophina of the Unbroken Dawn</strong>')
    expect(markup).toContain('Level 3')
    expect(markup).toContain('Online')
  })
  it('places disabled Talk before enabled Approach for a distant player', () => {
    const actions = buttons(render())
    expect(actions.map(({ label }) => label)).toEqual(['Talk', 'Approach'])
    expect(actions[0].attributes).toContain('disabled=""')
    expect(actions[1].attributes).not.toContain('disabled')
  })
  it('changes Approach to disabled Attack immediately while still out of confirmed range', () => {
    const actions = buttons(render({ approaching: true }))
    expect(actions.map(({ label }) => label)).toEqual(['Talk', 'Attack'])
    expect(actions[1].attributes).toContain('disabled=""')
    const callbackProps = props({ approaching: true })
    expect(primary(WorldNearbyPlayer(callbackProps))?.onClick).toBeUndefined()
    expect(callbackProps.onAttack).not.toHaveBeenCalled()
  })
  it('keeps protected Attack visible and disabled on confirmed arrival', () => {
    const actions = buttons(
      render({
        player: {
          ...player,
          position: { ...ownerPosition, x: 7 },
          attackable: true,
          attackEligible: false,
        },
      }),
    )
    expect(actions.map(({ label }) => label)).toEqual(['Talk', 'Attack'])
    expect(actions[1].attributes).toContain('disabled=""')
  })
  it('uses explicit server eligibility for Attack and keeps the primary styling identical', () => {
    const arrived = { ...player, position: { ...ownerPosition, x: 7 }, attackEligible: true }
    const approach = buttons(render())[1]
    const attack = buttons(render({ player: arrived }))[1]
    expect(attack.label).toBe('Attack')
    expect(attack.attributes).not.toContain('disabled')
    expect(attack.attributes.match(/class="[^"]*"/)?.[0]).toBe(
      approach.attributes.match(/class="[^"]*"/)?.[0],
    )
  })
  it('falls back to historical attackable and never enables Attack across sectors or diagonally', () => {
    const eligible = { ...player, attackable: true, position: { ...ownerPosition, x: 7 } }
    expect(buttons(render({ player: eligible }))[1].attributes).not.toContain('disabled')
    for (const position of [
      { ...ownerPosition, sectorId: 'atlas:59:28' },
      { ...ownerPosition, x: 7, y: 5 },
    ]) {
      const actions = buttons(render({ player: { ...eligible, position }, approaching: true }))
      expect(actions[1].label).toBe('Attack')
      expect(actions[1].attributes).toContain('disabled=""')
    }
  })
  it('honors blocked and attacking states without widening the Attack label', () => {
    const arrived = { ...player, position: ownerPosition, attackEligible: true }
    for (const state of [{ disabled: true }, { attacking: true }]) {
      const actions = buttons(render({ player: arrived, ...state }))
      expect(actions[1].label).toBe('Attack')
      expect(actions[1].attributes).toContain('disabled=""')
    }
    expect(buttons(render({ disabled: true }))[1].attributes).toContain('disabled=""')
  })
  it('uses disabled Interact for AI while preserving the same action order', () => {
    const actions = buttons(render({ player: { ...player, entityKind: 'ai' } }))
    expect(actions.map(({ label }) => label)).toEqual(['Interact', 'Approach'])
    expect(actions[0].attributes).toContain('disabled=""')
  })
  it('retains a fallback avatar when the source portrait is absent', () => {
    const markup = render({ player: { ...player, imageUrl: null } })
    expect(markup).not.toContain('<img')
    expect(markup).toMatch(/<span[^>]*aria-hidden="true"[^>]*>S<\/span>/)
    expect(markup).toContain('<strong>Sellophina of the Unbroken Dawn</strong>')
  })
  it('dispatches only the currently enabled primary action', () => {
    const distant = props()
    primary(WorldNearbyPlayer(distant))!.onClick!()
    expect(distant.onApproach).toHaveBeenCalledOnce()
    expect(distant.onAttack).not.toHaveBeenCalled()
    const arrived = props({
      player: { ...player, position: ownerPosition, attackEligible: true },
    })
    primary(WorldNearbyPlayer(arrived))!.onClick!()
    expect(arrived.onAttack).toHaveBeenCalledOnce()
    expect(arrived.onApproach).not.toHaveBeenCalled()
  })
})
