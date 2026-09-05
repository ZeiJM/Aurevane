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

export const PHASE_3_COMBAT_ARTWORK = {
  'vanguard.forceful-strike': '/media/skills/phase3/vanguard-forceful-strike.svg',
  'vanguard.cleave': '/media/skills/phase3/vanguard-cleave.webp',
  'vanguard.guard-break': '/media/skills/phase3/vanguard-guard-break.webp',
  'vanguard.brace': '/media/skills/phase3/vanguard-brace.webp',
  'vanguard.rally': '/media/skills/phase3/vanguard-rally.webp',
  'vanguard.shield-bash': '/media/skills/phase3/vanguard-shield-bash.webp',
  'vanguard.second-wind': '/media/skills/phase3/vanguard-second-wind.webp',
  'vanguard.sweeping-strike': '/media/skills/phase3/vanguard-sweeping-strike.webp',
  'lifebinder.mending-light': '/media/skills/phase3/lifebinder-mending-light.webp',
  'lifebinder.mend': '/media/skills/phase3/lifebinder-mend.webp',
  'lifebinder.barrier': '/media/skills/phase3/lifebinder-barrier.webp',
  'lifebinder.renew': '/media/skills/phase3/lifebinder-renew.webp',
  'lifebinder.sanctuary': '/media/skills/phase3/lifebinder-sanctuary.webp',
  'lifebinder.fortifying-light': '/media/skills/phase3/lifebinder-fortifying-light.webp',
  'essence.vanguard.unbroken-strike': '/media/skills/phase3/essence-vanguard-unbroken-strike.webp',
} as const satisfies Record<(typeof PHASE_3_COMBAT_ACTION_IDS)[number], string>

export const PHASE_3_RESONANCE_ARTWORK = {
  'resonance.lifebinder-vanguard.mercys-edge':
    '/media/skills/phase3/resonance-lifebinder-vanguard-mercys-edge.webp',
} as const satisfies Record<(typeof PHASE_3_RESONANCE_IDS)[number], string>

const ACTION_ARTWORK = new Map<string, string>([
  [PV1F_BASIC_ATTACK_ID, '/media/skills/basic-attack-fist.webp'],
  [PV1F_GUARD_ACTION_ID, '/media/skills/guard.webp'],
  [PV1F_RECOVER_ACTION_ID, '/media/skills/hp-recovery.webp'],
  [PV1F_MP_RECOVER_ACTION_ID, '/media/skills/mp-recovery.svg'],
  ...Object.entries(PHASE_3_COMBAT_ARTWORK),
])

const RESONANCE_ARTWORK = new Map<string, string>(Object.entries(PHASE_3_RESONANCE_ARTWORK))

export function battleSkillArtwork(actionId: string): string {
  return ACTION_ARTWORK.get(actionId) ?? BATTLE_MISSING_ARTWORK
}

export function battleResonanceArtwork(resonanceId: string): string {
  return RESONANCE_ARTWORK.get(resonanceId) ?? BATTLE_MISSING_ARTWORK
}
