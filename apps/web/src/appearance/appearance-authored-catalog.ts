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
  { key: 'human-m-0002', race: 'human', gender: 'masculine', label: 'Canal Bellkeeper' },
  { key: 'human-f-0002', race: 'human', gender: 'feminine', label: 'Salt Road Courier' },
  { key: 'elf-m-0002', race: 'elf', gender: 'masculine', label: 'Sunken Orchard Keeper' },
  { key: 'elf-f-0002', race: 'elf', gender: 'feminine', label: 'Glassbridge Lamplighter' },
  { key: 'fae-m-0002', race: 'fae', gender: 'masculine', label: 'Wisteria Archivist' },
  { key: 'fae-f-0002', race: 'fae', gender: 'feminine', label: 'Mistfen Piper' },
  {
    key: 'mountain-orc-m-0002',
    race: 'mountain-orc',
    gender: 'masculine',
    label: 'Ember Kiln Smith',
  },
  {
    key: 'mountain-orc-f-0002',
    race: 'mountain-orc',
    gender: 'feminine',
    label: 'Glacier Relay Warden',
  },
  { key: 'elf-f-0003', race: 'elf', gender: 'feminine', label: 'Bluefall Harpist' },
  { key: 'elf-f-0004', race: 'elf', gender: 'feminine', label: 'Copperwood Bowyer' },
  { key: 'elf-m-0003', race: 'elf', gender: 'masculine', label: 'Ivory Fen Physician' },
  { key: 'elf-m-0004', race: 'elf', gender: 'masculine', label: 'Winter Pear Astronomer' },
  { key: 'fae-f-0003', race: 'fae', gender: 'feminine', label: 'Pollen Court Scribe' },
  { key: 'fae-m-0003', race: 'fae', gender: 'masculine', label: 'Hawthorn Wind Reader' },
  { key: 'fae-m-0004', race: 'fae', gender: 'masculine', label: 'Moonpool Apiarist' },
  { key: 'human-f-0003', race: 'human', gender: 'feminine', label: 'Ashbank Surveyor' },
  { key: 'human-m-0003', race: 'human', gender: 'masculine', label: 'Rainmarket Cook' },
  { key: 'human-m-0004', race: 'human', gender: 'masculine', label: 'Juniper Road Peddler' },
  {
    key: 'mountain-orc-f-0004',
    race: 'mountain-orc',
    gender: 'feminine',
    label: 'Basalt Stair Warden',
  },
  {
    key: 'mountain-orc-m-0003',
    race: 'mountain-orc',
    gender: 'masculine',
    label: 'Garnet Quarry Foreman',
  },
  {
    key: 'mountain-orc-m-0004',
    race: 'mountain-orc',
    gender: 'masculine',
    label: 'Thunder Gate Mason',
  },
  { key: 'fae-f-0004', race: 'fae', gender: 'feminine', label: 'Cairnlight Shepherd' },
  { key: 'human-f-0004', race: 'human', gender: 'feminine', label: 'Tideglass Diver' },
  {
    key: 'mountain-orc-f-0003',
    race: 'mountain-orc',
    gender: 'feminine',
    label: 'Iron Pass Scout',
  },
  { key: 'elf-f-0005', race: 'elf', gender: 'feminine', label: 'Sunsill Roof Gardener' },
  { key: 'elf-f-0006', race: 'elf', gender: 'feminine', label: 'Glass Dune Reclaimer' },
  { key: 'elf-m-0005', race: 'elf', gender: 'masculine', label: 'Riverstone Map Binder' },
  { key: 'elf-m-0006', race: 'elf', gender: 'masculine', label: 'Black Creek Apiarist' },
  { key: 'fae-f-0005', race: 'fae', gender: 'feminine', label: 'Honeyglass Weaver' },
  { key: 'fae-f-0006', race: 'fae', gender: 'feminine', label: 'Seaflower Lantern Dancer' },
  { key: 'fae-m-0005', race: 'fae', gender: 'masculine', label: 'Rainlily Ferry Clerk' },
  { key: 'fae-m-0006', race: 'fae', gender: 'masculine', label: 'Cedar Stair Bellkeeper' },
  { key: 'human-f-0005', race: 'human', gender: 'feminine', label: 'Copper Quay Mechanic' },
  { key: 'human-f-0006', race: 'human', gender: 'feminine', label: 'Lanternwake Search Pilot' },
  { key: 'human-m-0005', race: 'human', gender: 'masculine', label: 'Brinewatch Signalman' },
  { key: 'human-m-0006', race: 'human', gender: 'masculine', label: 'Plum Orchard Gatekeeper' },
  {
    key: 'mountain-orc-f-0005',
    race: 'mountain-orc',
    gender: 'feminine',
    label: 'Red Basin Cartwright',
  },
  {
    key: 'mountain-orc-f-0006',
    race: 'mountain-orc',
    gender: 'feminine',
    label: 'Sleetwood Caravaner',
  },
  {
    key: 'mountain-orc-m-0005',
    race: 'mountain-orc',
    gender: 'masculine',
    label: 'Slategrove Trail Warden',
  },
  {
    key: 'mountain-orc-m-0006',
    race: 'mountain-orc',
    gender: 'masculine',
    label: 'Copper Hollow Diver',
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

export function defaultAuthoredAppearance(gender: AppearanceGender = 'feminine') {
  const presentation = gender === 'masculine' ? 'm' : 'f'
  return authoredAppearance(`human-${presentation}-0001`, 1)!
}
