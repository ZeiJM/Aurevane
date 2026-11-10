import { describe, expect, it } from 'vitest'
import { CREATION_CHARACTER_PORTRAITS, isStarterCharacterPortraitRef } from './starter-options'

describe('approved starting portrait choices', () => {
  it('offers 24 valid, distinct portraits for each presentation', () => {
    const choices = CREATION_CHARACTER_PORTRAITS
    expect(choices.filter((option) => option.presentationId === 'masculine')).toHaveLength(24)
    expect(choices.filter((option) => option.presentationId === 'feminine')).toHaveLength(24)
    expect(new Set(choices.map((option) => option.ref)).size).toBe(48)
    for (const choice of choices) expect(isStarterCharacterPortraitRef(choice.ref)).toBe(true)
  })
  it('keeps historical character portraits readable', () => {
    expect(isStarterCharacterPortraitRef('portrait.starter.wayfarer-01')).toBe(true)
    expect(isStarterCharacterPortraitRef('portrait.starter.wayfarer-40')).toBe(true)
    expect(isStarterCharacterPortraitRef('portrait.adventure.male-99')).toBe(false)
  })
})
