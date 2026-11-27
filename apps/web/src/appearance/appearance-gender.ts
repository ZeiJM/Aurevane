import type { PaintedPlayerLook } from './appearance-painted-wardrobe'

export const APPEARANCE_GENDERS = { feminine: 'Female', masculine: 'Male' } as const
export type AppearanceGender = keyof typeof APPEARANCE_GENDERS
type Identity = PaintedPlayerLook['identity']
type Hairstyle = PaintedPlayerLook['hairstyle']

const identitiesByGender = {
  feminine: ['pinescout', 'ranger'],
  masculine: ['scout', 'guard', 'elder'],
} as const satisfies Record<AppearanceGender, readonly Identity[]>

export function paintedIdentitiesForGender(gender: AppearanceGender): readonly Identity[] {
  return identitiesByGender[gender]
}

export function appearanceGenderForIdentity(identity: Identity): AppearanceGender {
  return paintedIdentitiesForGender('feminine').includes(identity) ? 'feminine' : 'masculine'
}

const masculineCuts = new Set<Hairstyle>(['spiked', 'frosted', 'warrior', 'brushed'])
const feminineCuts = new Set<Hairstyle>(['twinloops', 'twinribbons', 'sidebun', 'mermaid'])

export function hairstyleAvailableForGender(style: Hairstyle, gender: AppearanceGender) {
  return !(gender === 'feminine' ? masculineCuts : feminineCuts).has(style)
}
