import {
  PV1F_BASIC_ATTACK_ID,
  PV1F_GUARD_ACTION_ID,
  PV1F_MP_RECOVER_ACTION_ID,
  PV1F_RECOVER_ACTION_ID,
} from '@aurevane/game-core/combat/pv1f-skills'
import { describe, expect, it } from 'vitest'

import { BATTLE_COMMAND_ARTWORK, battleSkillArtwork } from './battle-skill-presentation'

describe('battle skill artwork presentation', () => {
  it('uses the centered high-resolution command-card replacements', () => {
    expect(BATTLE_COMMAND_ARTWORK).toEqual({
      inspect: '/media/skills/inspect.webp',
      move: '/media/skills/move.webp',
      attack: '/media/skills/basic-attack-fist.webp',
      guard: '/media/skills/guard.webp',
      finish: '/media/skills/finish-turn.webp',
    })
  })

  it('keeps Basic Attack unchanged and maps the equipped skill artwork', () => {
    expect(battleSkillArtwork(PV1F_BASIC_ATTACK_ID)).toBe('/media/skills/basic-attack-fist.webp')
    expect(battleSkillArtwork(PV1F_GUARD_ACTION_ID)).toBe('/media/skills/guard.webp')
    expect(battleSkillArtwork(PV1F_RECOVER_ACTION_ID)).toBe('/media/skills/hp-recovery.webp')
    expect(battleSkillArtwork(PV1F_MP_RECOVER_ACTION_ID)).toBe('/media/skills/mp-recovery.svg')
    expect(battleSkillArtwork('future.skill')).toBe('/media/skills/inspect.webp')
  })
})
