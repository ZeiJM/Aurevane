import { describe, expect, it } from 'vitest'
import { STARTER_CHARACTER_PORTRAITS, isStarterCharacterPortraitRef } from './starter-options'

describe('approved starting portrait choices', () => {
  it.each(['male', 'female'])(
    'registers twelve unique square portrait identities for %s',
    (gender) => {
      const choices = STARTER_CHARACTER_PORTRAITS.filter((option) =>
        option.ref.startsWith(`portrait.adventure.${gender}-`),
      )
      expect(choices).toHaveLength(12)
      expect(new Set(choices.map((option) => option.ref)).size).toBe(12)
      for (const choice of choices) expect(isStarterCharacterPortraitRef(choice.ref)).toBe(true)
    },
  )
  it('keeps historical character portraits readable', () => {
    expect(isStarterCharacterPortraitRef('portrait.starter.wayfarer-01')).toBe(true)
    expect(isStarterCharacterPortraitRef('portrait.starter.wayfarer-40')).toBe(true)
    expect(isStarterCharacterPortraitRef('portrait.adventure.male-99')).toBe(false)
  })
})
