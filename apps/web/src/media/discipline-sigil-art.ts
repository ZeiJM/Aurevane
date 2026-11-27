export const DISCIPLINE_SIGIL_ART = {
  vanguard: '/media/art/discipline-sigils/vanguard-sigil-anime-v01.webp',
  farstrider: '/media/art/discipline-sigils/farstrider-sigil-anime-v01.webp',
  shadehand: '/media/art/discipline-sigils/shadehand-sigil-anime-v01.webp',
  ironfist: '/media/art/discipline-sigils/ironfist-sigil-anime-v01.webp',
  aetherist: '/media/art/discipline-sigils/aetherist-sigil-anime-v01.webp',
  lifebinder: '/media/art/discipline-sigils/lifebinder-sigil-anime-v01.webp',
  bastion: '/media/art/discipline-sigils/bastion-sigil-anime-v01.webp',
  chronist: '/media/art/discipline-sigils/chronist-sigil-anime-v01.webp',
  cinderweaver: '/media/art/discipline-sigils/cinderweaver-sigil-anime-v01.webp',
  dawnshield: '/media/art/discipline-sigils/dawnshield-sigil-anime-v01.webp',
  edgedancer: '/media/art/discipline-sigils/edgedancer-sigil-anime-v01.webp',
  frostweaver: '/media/art/discipline-sigils/frostweaver-sigil-anime-v01.webp',
  ravager: '/media/art/discipline-sigils/ravager-sigil-anime-v01.webp',
  runeblade: '/media/art/discipline-sigils/runeblade-sigil-anime-v01.webp',
  stormsinger: '/media/art/discipline-sigils/stormsinger-sigil-anime-v01.webp',
  tidecaller: '/media/art/discipline-sigils/tidecaller-sigil-anime-v01.webp',
  wildwarden: '/media/art/discipline-sigils/wildwarden-sigil-anime-v01.webp',
} as const

export type DisciplineSigilArtId = keyof typeof DISCIPLINE_SIGIL_ART

export function disciplineSigilArtwork(disciplineId: string): string | null {
  return DISCIPLINE_SIGIL_ART[disciplineId as DisciplineSigilArtId] ?? null
}
