export const DISCIPLINE_SIGIL_ART = {
  vanguard: {
    src: '/media/art/discipline-sigils/vanguard-sigil-v01.webp',
    width: 1024,
    height: 1024,
  },
  farstrider: {
    src: '/media/art/discipline-sigils/farstrider-sigil-v01.webp',
    width: 1024,
    height: 1024,
  },
  shadehand: {
    src: '/media/art/discipline-sigils/shadehand-sigil-v01.webp',
    width: 1024,
    height: 1024,
  },
  ironfist: {
    src: '/media/art/discipline-sigils/ironfist-sigil-v01.webp',
    width: 1024,
    height: 1024,
  },
  aetherist: {
    src: '/media/art/discipline-sigils/aetherist-sigil-v01.webp',
    width: 1024,
    height: 1024,
  },
  lifebinder: {
    src: '/media/art/discipline-sigils/lifebinder-sigil-v01.webp',
    width: 1024,
    height: 1024,
  },
  bastion: {
    src: '/media/art/discipline-sigils/bastion-sigil-v01.webp',
    width: 1024,
    height: 1024,
  },
  chronist: {
    src: '/media/art/discipline-sigils/chronist-sigil-v01.webp',
    width: 1024,
    height: 1024,
  },
  cinderweaver: {
    src: '/media/art/discipline-sigils/cinderweaver-sigil-v01.webp',
    width: 1024,
    height: 1024,
  },
  dawnshield: {
    src: '/media/art/discipline-sigils/dawnshield-sigil-v01.webp',
    width: 1024,
    height: 1024,
  },
  edgedancer: {
    src: '/media/art/discipline-sigils/edgedancer-sigil-v01.webp',
    width: 1024,
    height: 1024,
  },
  frostweaver: {
    src: '/media/art/discipline-sigils/frostweaver-sigil-v01.webp',
    width: 1024,
    height: 1024,
  },
  ravager: {
    src: '/media/art/discipline-sigils/ravager-sigil-v01.webp',
    width: 1024,
    height: 1024,
  },
  runeblade: {
    src: '/media/art/discipline-sigils/runeblade-sigil-v01.webp',
    width: 1024,
    height: 1024,
  },
  stormsinger: {
    src: '/media/art/discipline-sigils/stormsinger-sigil-v01.webp',
    width: 1024,
    height: 1024,
  },
  tidecaller: {
    src: '/media/art/discipline-sigils/tidecaller-sigil-v01.webp',
    width: 1024,
    height: 1024,
  },
  wildwarden: {
    src: '/media/art/discipline-sigils/wildwarden-sigil-v01.webp',
    width: 1024,
    height: 1024,
  },
} as const

export type DisciplineSigilArtId = keyof typeof DISCIPLINE_SIGIL_ART

export function disciplineSigilArtwork(disciplineId: string): string | null {
  return DISCIPLINE_SIGIL_ART[disciplineId as DisciplineSigilArtId]?.src ?? null
}
