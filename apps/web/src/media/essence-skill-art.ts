export const ESSENCE_SKILL_ART = {
  'essence.vanguard.unbroken-strike':
    '/media/art/essence-skills/vanguard-unbroken-strike-anime-v01.webp',
  'essence.farstrider.deadeye-barrage':
    '/media/art/essence-skills/farstrider-deadeye-barrage-anime-v01.webp',
  'essence.shadehand.perfect-opening':
    '/media/art/essence-skills/shadehand-perfect-opening-anime-v01.webp',
  'essence.lifebinder.verdant-rupture':
    '/media/art/essence-skills/lifebinder-verdant-rupture-anime-v01.webp',
  'essence.ironfist.hundredfold-rush':
    '/media/art/essence-skills/ironfist-hundredfold-rush-anime-v01.webp',
  'essence.bastion.last-bastion': '/media/art/essence-skills/bastion-last-bastion-anime-v01.webp',
  'essence.dawnshield.dawns-oath': '/media/art/essence-skills/dawnshield-dawns-oath-anime-v01.webp',
  'essence.ravager.red-tempest': '/media/art/essence-skills/ravager-red-tempest-anime-v01.webp',
  'essence.edgedancer.sevenfold-cut':
    '/media/art/essence-skills/edgedancer-sevenfold-cut-anime-v01.webp',
  'essence.wildwarden.apex-hunt': '/media/art/essence-skills/wildwarden-apex-hunt-anime-v01.webp',
  'essence.aetherist.aether-nova': '/media/art/essence-skills/aetherist-aether-nova-anime-v01.webp',
  'essence.runeblade.runic-overdrive':
    '/media/art/essence-skills/runeblade-runic-overdrive-anime-v01.webp',
  'essence.chronist.borrowed-hour':
    '/media/art/essence-skills/chronist-borrowed-hour-anime-v01.webp',
  'essence.cinderweaver.phoenix-wake':
    '/media/art/essence-skills/cinderweaver-phoenix-wake-anime-v01.webp',
  'essence.frostweaver.absolute-winter':
    '/media/art/essence-skills/frostweaver-absolute-winter-anime-v01.webp',
  'essence.stormsinger.skybreak': '/media/art/essence-skills/stormsinger-skybreak-anime-v01.webp',
  'essence.tidecaller.tidal-crown':
    '/media/art/essence-skills/tidecaller-tidal-crown-anime-v01.webp',
} as const

export type EssenceSkillArtId = keyof typeof ESSENCE_SKILL_ART

export function essenceSkillArtwork(essenceId: string): string | null {
  return ESSENCE_SKILL_ART[essenceId as EssenceSkillArtId] ?? null
}
