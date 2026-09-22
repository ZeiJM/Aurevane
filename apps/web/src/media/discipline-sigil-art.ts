export const DISCIPLINE_SIGIL_ART = {
  vanguard: '/media/art/discipline-sigils/vanguard-sigil-v01.webp',
  farstrider: '/media/art/discipline-sigils/farstrider-sigil-v01.webp',
  shadehand: '/media/art/discipline-sigils/shadehand-sigil-v01.webp',
  ironfist: '/media/art/discipline-sigils/ironfist-sigil-v01.webp',
  aetherist: '/media/art/discipline-sigils/aetherist-sigil-v01.webp',
  lifebinder: '/media/art/discipline-sigils/lifebinder-sigil-v01.webp',
  bastion: '/media/art/discipline-sigils/bastion-sigil-v01.webp',
  chronist: '/media/art/discipline-sigils/chronist-sigil-v01.webp',
  cinderweaver: '/media/art/discipline-sigils/cinderweaver-sigil-v01.webp',
  dawnshield: '/media/art/discipline-sigils/dawnshield-sigil-v01.webp',
  edgedancer: '/media/art/discipline-sigils/edgedancer-sigil-v01.webp',
  frostweaver: '/media/art/discipline-sigils/frostweaver-sigil-v01.webp',
  ravager: '/media/art/discipline-sigils/ravager-sigil-v01.webp',
  runeblade: '/media/art/discipline-sigils/runeblade-sigil-v01.webp',
  stormsinger: '/media/art/discipline-sigils/stormsinger-sigil-v01.webp',
  tidecaller: '/media/art/discipline-sigils/tidecaller-sigil-v01.webp',
  wildwarden: '/media/art/discipline-sigils/wildwarden-sigil-v01.webp',
} as const

export type DisciplineSigilArtId = keyof typeof DISCIPLINE_SIGIL_ART

export function disciplineSigilArtwork(disciplineId: string): string | null {
  return DISCIPLINE_SIGIL_ART[disciplineId as DisciplineSigilArtId] ?? null
}
