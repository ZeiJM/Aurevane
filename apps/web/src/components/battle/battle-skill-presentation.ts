import {
  PV1F_BASIC_ATTACK_ID,
  PV1F_GUARD_ACTION_ID,
  PV1F_MP_RECOVER_ACTION_ID,
  PV1F_RECOVER_ACTION_ID,
} from '@aurevane/game-core/combat/pv1f-skills'

export const BATTLE_COMMAND_ARTWORK = {
  inspect: '/media/skills/inspect-centered.svg',
  move: '/media/skills/move-centered.svg',
  attack: '/media/skills/basic-attack-fist.webp',
  guard: '/media/skills/guard-centered.svg',
  finish: '/media/skills/finish-turn-centered.svg',
} as const

const ACTION_ARTWORK = new Map<string, string>([
  [PV1F_BASIC_ATTACK_ID, '/media/skills/basic-attack-fist.webp'],
  [PV1F_GUARD_ACTION_ID, '/media/skills/guard-centered.svg'],
  [PV1F_RECOVER_ACTION_ID, '/media/skills/hp-recovery-centered.svg'],
  [PV1F_MP_RECOVER_ACTION_ID, '/media/skills/mp-recovery.svg'],
])

export function battleSkillArtwork(actionId: string): string {
  return ACTION_ARTWORK.get(actionId) ?? '/media/skills/inspect-centered.svg'
}
