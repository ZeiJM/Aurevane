import type { AppearanceGender } from './appearance-gender'

export const APPEARANCE_RACES = {
  human: 'Human',
  elf: 'Elf',
  fae: 'Fae',
  'mountain-orc': 'Mountain Orc',
} as const

export type AppearanceRace = keyof typeof APPEARANCE_RACES
export type AuthoredAppearanceVariant = 1 | 2

export type AuthoredAppearanceBlueprint = Readonly<{
  v: 7
  character: string
  variant: AuthoredAppearanceVariant
}>

type AuthoredCharacter = Readonly<{
  key: string
  race: AppearanceRace
  gender: AppearanceGender
  label: string
}>

// Only characters with both complete portrait and motion sets belong in the playable catalogue.
export const AUTHORED_CHARACTERS = [
  { key: 'human-m-0001', race: 'human', gender: 'masculine', label: 'Northern Pass Highlander' },
  { key: 'human-f-0001', race: 'human', gender: 'feminine', label: 'Citadel Knight' },
  { key: 'elf-m-0001', race: 'elf', gender: 'masculine', label: 'Aqueduct Scout' },
  { key: 'elf-f-0001', race: 'elf', gender: 'feminine', label: 'Cedarwood Archer' },
  { key: 'fae-m-0001', race: 'fae', gender: 'masculine', label: 'Harbor Cartographer' },
  { key: 'fae-f-0001', race: 'fae', gender: 'feminine', label: 'Garden Lanternkeeper' },
  {
    key: 'mountain-orc-m-0001',
    race: 'mountain-orc',
    gender: 'masculine',
    label: 'Basalt Ridge Pathfinder',
  },
  {
    key: 'mountain-orc-f-0001',
    race: 'mountain-orc',
    gender: 'feminine',
    label: 'Basalt Citadel Vanguard',
  },
] as const satisfies readonly AuthoredCharacter[]

const byKey = new Map<string, AuthoredCharacter>(
  AUTHORED_CHARACTERS.map((character) => [character.key, character]),
)

export function authoredCharacter(key: string): AuthoredCharacter | undefined {
  return byKey.get(key)
}

export function authoredAppearance(
  character: unknown,
  variant: unknown,
): AuthoredAppearanceBlueprint | null {
  if (typeof character !== 'string' || !byKey.has(character) || (variant !== 1 && variant !== 2))
    return null
  return Object.freeze({ v: 7, character, variant })
}

export function authoredAppearanceSource(blueprint: AuthoredAppearanceBlueprint) {
  return `/media/art/character-catalogue/${blueprint.character}/variant-${blueprint.variant}`
}
