export const REGULAR_SKILL_ART = {
  'vanguard.forceful-strike':
    '/media/art/discipline-skills/vanguard-forceful-strike-v01.webp',
  'vanguard.cleave': '/media/art/discipline-skills/vanguard-cleave-v01.webp',
  'vanguard.guard-break': '/media/art/discipline-skills/vanguard-guard-break-v01.webp',
  'vanguard.brace': '/media/art/discipline-skills/vanguard-brace-v01.webp',
  'vanguard.rally': '/media/art/discipline-skills/vanguard-rally-v01.webp',
  'vanguard.shield-bash': '/media/art/discipline-skills/vanguard-shield-bash-v01.webp',
  'vanguard.second-wind': '/media/art/discipline-skills/vanguard-second-wind-v01.webp',
  'vanguard.sweeping-strike':
    '/media/art/discipline-skills/vanguard-sweeping-strike-v01.webp',

  'farstrider.aimed-shot': '/media/art/discipline-skills/farstrider-aimed-shot-v01.webp',
  'farstrider.pinning-shot':
    '/media/art/discipline-skills/farstrider-pinning-shot-v01.webp',
  'farstrider.volley': '/media/art/discipline-skills/farstrider-volley-v01.webp',
  'farstrider.scouts-mark':
    '/media/art/discipline-skills/farstrider-scouts-mark-v01.webp',
  'farstrider.longshot': '/media/art/discipline-skills/farstrider-longshot-v01.webp',
  'farstrider.piercing-barrage':
    '/media/art/discipline-skills/farstrider-piercing-barrage-v01.webp',
  'farstrider.keen-focus': '/media/art/discipline-skills/farstrider-keen-focus-v01.webp',
  'farstrider.fieldcraft': '/media/art/discipline-skills/farstrider-fieldcraft-v01.webp',

  'shadehand.backstab': '/media/art/discipline-skills/shadehand-backstab-v01.webp',
  'shadehand.smoke-vial': '/media/art/discipline-skills/shadehand-smoke-vial-v01.webp',
  'shadehand.crippling-cut':
    '/media/art/discipline-skills/shadehand-crippling-cut-v01.webp',
  'shadehand.feint': '/media/art/discipline-skills/shadehand-feint-v01.webp',
  'shadehand.exploit-opening':
    '/media/art/discipline-skills/shadehand-exploit-opening-v01.webp',
  'shadehand.fan-of-knives':
    '/media/art/discipline-skills/shadehand-fan-of-knives-v01.webp',
  'shadehand.quick-hands': '/media/art/discipline-skills/shadehand-quick-hands-v01.webp',
  'shadehand.execution-cut':
    '/media/art/discipline-skills/shadehand-execution-cut-v01.webp',

  'lifebinder.mending-light':
    '/media/art/discipline-skills/lifebinder-mending-light-v01.webp',
  'lifebinder.mend': '/media/art/discipline-skills/lifebinder-mend-v01.webp',
  'lifebinder.barrier': '/media/art/discipline-skills/lifebinder-barrier-v01.webp',
  'lifebinder.renew': '/media/art/discipline-skills/lifebinder-renew-v01.webp',
  'lifebinder.sanctuary': '/media/art/discipline-skills/lifebinder-sanctuary-v01.webp',
  'lifebinder.fortifying-light':
    '/media/art/discipline-skills/lifebinder-fortifying-light-v01.webp',
} as const

export type RegularSkillArtId = keyof typeof REGULAR_SKILL_ART

export function regularSkillArtwork(skillId: string): string | null {
  return REGULAR_SKILL_ART[skillId as RegularSkillArtId] ?? null
}
