import {
  PV1F_BASIC_ATTACK_ID,
  PV1F_GUARD_ACTION_ID,
  PV1F_MP_RECOVER_ACTION_ID,
  PV1F_RECOVER_ACTION_ID,
} from '@aurevane/game-core/combat/pv1f-skills'

export const BATTLE_COMMAND_ARTWORK = {
  inspect: '/media/skills/inspect.webp',
  move: '/media/skills/move.webp',
  attack: '/media/skills/basic-attack-fist.webp',
  guard: '/media/skills/guard.webp',
  finish: '/media/skills/finish-turn.webp',
} as const

export const BATTLE_MISSING_ARTWORK = '/media/skills/missing-art.svg'

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
  'essence.vanguard.unbroken-strike',
] as const

export const PHASE_3_RESONANCE_IDS = ['resonance.lifebinder-vanguard.mercys-edge'] as const

const ACTION_ARTWORK = new Map<string, string>([
  [PV1F_BASIC_ATTACK_ID, '/media/skills/basic-attack-fist.webp'],
  [PV1F_GUARD_ACTION_ID, '/media/skills/guard.webp'],
  [PV1F_RECOVER_ACTION_ID, '/media/skills/hp-recovery.webp'],
  [PV1F_MP_RECOVER_ACTION_ID, '/media/skills/mp-recovery.svg'],
  ...PHASE_3_COMBAT_ACTION_IDS.map((actionId) => [actionId, BATTLE_MISSING_ARTWORK] as const),
])

const RESONANCE_ARTWORK = new Map<string, string>(
  PHASE_3_RESONANCE_IDS.map((resonanceId) => [resonanceId, BATTLE_MISSING_ARTWORK] as const),
)

export function battleSkillArtwork(actionId: string): string {
  return ACTION_ARTWORK.get(actionId) ?? BATTLE_MISSING_ARTWORK
}

export function battleResonanceArtwork(resonanceId: string): string {
  return RESONANCE_ARTWORK.get(resonanceId) ?? BATTLE_MISSING_ARTWORK
}
