import { imageAssetRegistry } from '@/media/registry'
import { publishedContentArtwork } from '@/media/published-content-art'
import {
  PV1F_BASIC_ATTACK_ID,
  PV1F_GUARD_ACTION_ID,
  PV1F_MP_RECOVER_ACTION_ID,
  PV1F_RECOVER_ACTION_ID,
} from '@aurevane/game-core/combat/pv1f-skills'

import { darkFantasyResonanceArtwork } from '../../media/generated-dark-fantasy-art'
import { resonanceArtwork } from '../../media/resonance-art'
import { registeredSkillArtworkSource, resolveSkillIconHook } from '../../media/skill-media-hooks'

export const BATTLE_COMMAND_ARTWORK = {
  inspect: '/media/skills/inspect-anime-v01.webp',
  move: '/media/skills/move-anime-v01.webp',
  attack: '/media/skills/basic-attack-fist-anime-v01.webp',
  guard: '/media/skills/guard-anime-v01.webp',
  finish: '/media/skills/finish-turn-anime-v01.webp',
} as const

export const BATTLE_MISSING_ARTWORK = '/media/skills/missing-art.svg'

function disciplineSkillArtwork(actionId: string): string | null {
  return registeredSkillArtworkSource(actionId)
}

// Retained as compatibility exports for the Phase 3 artwork contract tests and tooling.
export const PHASE_3_COMBAT_ACTION_IDS = [
  'vanguard.forceful-strike',
  'vanguard.cleave',
  'vanguard.guard-break',
  'vanguard.brace',
  'vanguard.rally',
  'vanguard.shield-bash',
  'vanguard.second-wind',
  'vanguard.sweeping-strike',
  'lifebinder.mending-light',
  'lifebinder.mend',
  'lifebinder.barrier',
  'lifebinder.renew',
  'lifebinder.sanctuary',
  'lifebinder.fortifying-light',
  'lifebinder.vital-sever',
  'lifebinder.searing-bloom',
  'essence.vanguard.unbroken-strike',
  'essence.lifebinder.verdant-rupture',
] as const

export const PHASE_3_RESONANCE_IDS = ['resonance.lifebinder-vanguard.mercys-edge'] as const

export const PHASE_3_COMBAT_ARTWORK = Object.fromEntries(
  PHASE_3_COMBAT_ACTION_IDS.map((id) => [id, disciplineSkillArtwork(id) ?? BATTLE_MISSING_ARTWORK]),
) as Record<(typeof PHASE_3_COMBAT_ACTION_IDS)[number], string>

export const PHASE_3_RESONANCE_ARTWORK = Object.fromEntries(
  PHASE_3_RESONANCE_IDS.map((id) => [
    id,
    resonanceArtwork(id) ?? darkFantasyResonanceArtwork(id) ?? BATTLE_MISSING_ARTWORK,
  ]),
) as Record<(typeof PHASE_3_RESONANCE_IDS)[number], string>

const ACTION_ARTWORK = new Map<string, string>([
  [PV1F_BASIC_ATTACK_ID, '/media/skills/basic-attack-fist-anime-v01.webp'],
  [PV1F_GUARD_ACTION_ID, '/media/skills/guard-anime-v01.webp'],
  [PV1F_RECOVER_ACTION_ID, '/media/skills/hp-recovery-anime-v01.webp'],
  [PV1F_MP_RECOVER_ACTION_ID, '/media/skills/mp-recovery-dark-fantasy-anime-v01.webp'],
])

export function battleSkillArtwork(actionId: string, iconKey?: string | null): string {
  const hooked = resolveSkillIconHook(iconKey)
  return (
    publishedContentArtwork(iconKey) ??
    imageAssetRegistry.get(iconKey ?? '')?.src ??
    (hooked ? disciplineSkillArtwork(hooked.skillId) : null) ??
    disciplineSkillArtwork(actionId) ??
    ACTION_ARTWORK.get(actionId) ??
    BATTLE_MISSING_ARTWORK
  )
}

export function battleResonanceArtwork(resonanceId: string, iconKey?: string | null): string {
  return (
    publishedContentArtwork(iconKey) ??
    resonanceArtwork(resonanceId) ??
    darkFantasyResonanceArtwork(resonanceId) ??
    BATTLE_MISSING_ARTWORK
  )
}
