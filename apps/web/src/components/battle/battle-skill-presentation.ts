import {
  PV1F_BASIC_ATTACK_ID,
  PV1F_GUARD_ACTION_ID,
  PV1F_MP_RECOVER_ACTION_ID,
  PV1F_RECOVER_ACTION_ID,
} from '@aurevane/game-core/combat/pv1f-skills'

import {
  darkFantasyResonanceArtwork,
  darkFantasySkillArtwork,
} from '../../media/generated-dark-fantasy-art'

export const BATTLE_COMMAND_ARTWORK = {
  inspect: '/media/skills/inspect.webp',
  move: '/media/skills/move.webp',
  attack: '/media/skills/basic-attack-fist.webp',
  guard: '/media/skills/guard.webp',
  finish: '/media/skills/finish-turn.webp',
} as const

export const BATTLE_MISSING_ARTWORK = '/media/skills/missing-art.svg'

// ART-UI-029 original painted tiles; provenance and dimensions accompany the runtime files.
const CONCEPT_SKILL_ARTWORK: Readonly<Record<string, string>> = {
  'runeblade.aether-cut': '/media/art/concept-ui/skill-runeblade-aether-cut-v01.webp',
  'runeblade.sigil-brand': '/media/art/concept-ui/skill-runeblade-sigil-brand-v01.webp',
  'lifebinder.mend': '/media/art/concept-ui/skill-lifebinder-mend-v01.webp',
  'lifebinder.renew': '/media/art/concept-ui/skill-lifebinder-renew-v01.webp',
}

function disciplineSkillArtwork(actionId: string): string | null {
  return CONCEPT_SKILL_ARTWORK[actionId] ?? darkFantasySkillArtwork(actionId)
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
    darkFantasyResonanceArtwork(id) ?? BATTLE_MISSING_ARTWORK,
  ]),
) as Record<(typeof PHASE_3_RESONANCE_IDS)[number], string>

const ACTION_ARTWORK = new Map<string, string>([
  [PV1F_BASIC_ATTACK_ID, '/media/skills/basic-attack-fist.webp'],
  [PV1F_GUARD_ACTION_ID, '/media/skills/guard.webp'],
  [PV1F_RECOVER_ACTION_ID, '/media/skills/hp-recovery.webp'],
  [PV1F_MP_RECOVER_ACTION_ID, '/media/skills/mp-recovery.svg'],
])

export function battleSkillArtwork(actionId: string): string {
  return disciplineSkillArtwork(actionId) ?? ACTION_ARTWORK.get(actionId) ?? BATTLE_MISSING_ARTWORK
}

export function battleResonanceArtwork(resonanceId: string): string {
  return darkFantasyResonanceArtwork(resonanceId) ?? BATTLE_MISSING_ARTWORK
}
