import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./foundation-discipline-sigil', () => ({ FoundationDisciplineSigil: () => null }))
vi.mock('./discipline-mastery-panel', () => ({ DisciplineMasteryPanel: () => null }))

import { DisciplineLibrary } from './character-discipline-build-panel'

type ButtonProps = { children?: ReactNode; disabled?: boolean; onClick?: () => void }

function buttons(node: ReactNode): ReactElement<ButtonProps>[] {
  const result: ReactElement<ButtonProps>[] = []
  Children.forEach(node, (child) => {
    if (!isValidElement<ButtonProps>(child)) return
    if (child.type === 'button') result.push(child)
    else result.push(...buttons(child.props.children))
  })
  return result
}

const options = [
  { definition: { id: 'vanguard', name: 'Vanguard' } },
  { definition: { id: 'runeblade', name: 'Runeblade' } },
]

function props() {
  return {
    options,
    selectedPrimaryId: 'vanguard',
    selectedSecondaryId: 'lifebinder',
    pendingPreview: false,
    pendingCommit: false,
    refreshingProfile: false,
    primaryRemainingSeconds: 0,
    onSelect: vi.fn(),
  }
}

describe('Primary Discipline library interaction', () => {
  it.each(['lifebinder', ''])('previews the activated Primary with Secondary %j', (secondary) => {
    const input = { ...props(), selectedSecondaryId: secondary }
    const cards = buttons(DisciplineLibrary(input))
    expect(cards).toHaveLength(2)
    expect(cards[1].props.disabled).toBe(false)
    cards[1].props.onClick?.()
    expect(input.onSelect).toHaveBeenCalledExactlyOnceWith('runeblade', secondary)
  })

  it.each([
    ['preview pending', { pendingPreview: true }],
    ['commit pending', { pendingCommit: true }],
    ['profile refreshing', { refreshingProfile: true }],
    ['Primary attunement cooldown', { primaryRemainingSeconds: 1 }],
  ])('disables every library card while %s', (_name, restriction) => {
    const input = { ...props(), ...restriction }
    const cards = buttons(DisciplineLibrary(input))
    expect(cards.every((card) => card.props.disabled)).toBe(true)
    const markup = renderToStaticMarkup(createElement(DisciplineLibrary, input))
    expect(markup.match(/disabled=""/g)).toHaveLength(options.length)
    expect(input.onSelect).not.toHaveBeenCalled()
  })

  it('leaves every card available when all restrictions are clear', () => {
    const input = props()
    const markup = renderToStaticMarkup(createElement(DisciplineLibrary, input))
    expect(markup).not.toContain('disabled=""')
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('aria-pressed="false"')
  })
})
