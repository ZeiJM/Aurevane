import { describe, expect, it } from 'vitest'

import { defaultPronounPresetForPresentation, STARTER_CHARACTER_PORTRAITS } from './starter-options'

describe('starter character identity options', () => {
  it('offers the approved gallery alongside the historical 40-portrait catalog deterministically', () => {
    expect(STARTER_CHARACTER_PORTRAITS).toHaveLength(64)

    const refs = STARTER_CHARACTER_PORTRAITS.map((option) => option.ref)
    expect(new Set(refs).size).toBe(refs.length)
    expect(refs[0]).toBe('portrait.starter.wayfarer-01')
    expect(refs[39]).toBe('portrait.starter.wayfarer-40')
    expect(refs.at(-1)).toBe('portrait.adventure.female-12')
  })

  it('keeps the legacy pronoun contract deterministic when the UI does not ask for pronouns', () => {
    expect(defaultPronounPresetForPresentation('masculine')).toBe('he_him')
    expect(defaultPronounPresetForPresentation('feminine')).toBe('she_her')
    expect(defaultPronounPresetForPresentation('androgynous')).toBe('they_them')
  })
})
