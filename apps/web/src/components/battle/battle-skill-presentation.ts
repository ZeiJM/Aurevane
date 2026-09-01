import {
  PV1F_BASIC_ATTACK_ID,
  PV1F_GUARD_ACTION_ID,
  PV1F_MP_RECOVER_ACTION_ID,
  PV1F_RECOVER_ACTION_ID,
} from '@aurevane/game-core/combat/pv1f-skills'

export const BATTLE_COMMAND_ARTWORK = {
  inspect: '/media/skills/inspect.png',
  move: '/media/skills/move.png',
  attack: '/media/skills/basic-attack.png',
  guard: '/media/skills/guard.png',
  finish: '/media/skills/finish-turn.png',
} as const

const ACTION_ARTWORK = new Map<string, string>([
  [PV1F_BASIC_ATTACK_ID, '/media/skills/basic-attack.png'],
  [PV1F_GUARD_ACTION_ID, '/media/skills/guard.png'],
  [PV1F_RECOVER_ACTION_ID, '/media/skills/hp-recovery.png'],
  [PV1F_MP_RECOVER_ACTION_ID, '/media/skills/mp-recovery.png'],
])

export function battleSkillArtwork(actionId: string): string {
  return ACTION_ARTWORK.get(actionId) ?? '/media/skills/inspect.png'
}
