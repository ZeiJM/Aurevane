import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { CharacterSelectShell } from './character-select-shell'
import type { CharacterSlotCharacter } from '@/server/character/character-slot-service'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => '/game',
}))
vi.mock('@/components/media/aurevane-image', () => ({ AurevaneImage: () => null }))

const character: CharacterSlotCharacter = {
  id: 'fixture',
  userId: 'owner',
  slotIndex: 0,
  rulesVersion: 1,
  name: 'Aurelia BHJGBCBJFGHGCAEE',
  nameKey: 'aurelia',
  presentationId: 'androgynous',
  pronounPresetId: 'they_them',
  portraitRef: 'portrait.starter.wayfarer-01',
  starterAppearanceRef: 'appearance.starter.roadworn',
  foundationDisciplineId: 'vanguard',
  attributes: { might: 6, finesse: 6, vitality: 6, agility: 6, intellect: 6, resolve: 6 },
  level: 2,
  xp: 0,
  progressionCycle: { number: 1 },
  createdAt: '',
  cycleStartedAt: '',
  lastActiveAt: '',
  deletionRequestedAt: null,
  deletionExecuteAfter: null,
  reselectAvailableAt: null,
  disciplines: {
    primary: { id: 'chronoweaver', name: 'Chronoweaver' },
    secondary: { id: 'shadebinder', name: 'Shadebinder' },
  },
}

function render(candidate = character) {
  return renderToStaticMarkup(
    createElement(CharacterSelectShell, {
      characters: [candidate],
      selectedCharacter: candidate,
      profileImageUrls: {},
      accountDeletion: null,
    }),
  )
}

describe('Character Select equipped identity', () => {
  it('renders the server primary and secondary without displaying its creation discipline', () => {
    const markup = render()
    expect(markup).toContain('aria-label="Primary Discipline">Chronoweaver')
    expect(markup).toContain('aria-label="Secondary Discipline">Shadebinder')
    expect(markup).not.toContain('Vanguard')
    expect(markup).toContain('Aurelia BHJGBCBJFGHGCAEE')
    expect(markup).toContain('Level 2')
  })

  it('omits the secondary label after returning to a pure build', () => {
    const markup = render({
      ...character,
      disciplines: { ...character.disciplines, secondary: null },
    })
    expect(markup).toContain('aria-label="Primary Discipline">Chronoweaver')
    expect(markup).not.toContain('Secondary Discipline')
    expect(markup).not.toContain('Shadebinder')
  })

  it('keeps deletion management available without the removed footer sentence', () => {
    const markup = render()
    expect(markup).not.toContain('Account removal has a cancellable 24-hour grace period.')
    expect(markup).toContain('data-testid="delete-account-button"')
    expect(markup).toContain('Delete Character')
  })

  it('keeps the pending character grace-period warning and cancellation', () => {
    const markup = render({ ...character, deletionExecuteAfter: '2026-10-03T00:00:00.000Z' })
    expect(markup).toContain('This character cannot be played during the grace period.')
    expect(markup).toContain('Cancel deletion')
    expect(markup).not.toContain('Enter AUREVANE')
  })
})
