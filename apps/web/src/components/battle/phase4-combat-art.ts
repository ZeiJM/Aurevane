import { ADVANCED_DISCIPLINES } from '@aurevane/game-core/character/advanced-disciplines'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { resolveEssenceForBuild } from '@aurevane/game-core/combat/essence'
import { imageAssetRegistry } from '../../media/registry'

/** Original, code-native tactical sigils. Geometry communicates tradition, shape and effect;
 * these intentionally remain crisp at 32–64px and do not depend on a generation vendor. */
export const PHASE4_DISCIPLINE_COLORS: Readonly<Record<string, string>> = {
  bastion: '#91afc4',
  ravager: '#db786f',
  edgedancer: '#d9c9a8',
  wildwarden: '#91b780',
  runeblade: '#b8a0d9',
  dawnshield: '#e3ca88',
  cinderweaver: '#eea16e',
  frostweaver: '#a0d2df',
  stormsinger: '#b6b5e9',
  tidecaller: '#7ec9bf',
}
const glyphs: Readonly<Record<string, string>> = {
  bastion:
    '<path d="M40 26 64 18 88 26v28c0 20-12 31-24 39-12-8-24-19-24-39Z"/><path d="M64 28v51M48 44h32"/>',
  ravager:
    '<path d="m38 87 41-57M56 31c12-14 32-10 38 6l-18 15-20-21Z"/><path d="m33 76 20 14M45 27l-13 8 13 17"/>',
  edgedancer:
    '<path d="m38 88 40-59 15-8-2 18-42 53M37 68l27 18M31 92l14 8"/><path d="m69 32 12 9"/>',
  wildwarden: '<path d="M39 23c42 4 48 52 2 70l8-35-10-35ZM27 70l64-40M78 30h13v14"/>',
  runeblade:
    '<path d="m36 89 43-61 14-6-1 17-44 59M33 73l28 18"/><path d="m37 25-9 12 9 12 9-12-9-12ZM68 64l12 8 12-8"/>',
  dawnshield:
    '<path d="M40 31 64 24 88 31v25c0 18-12 28-24 35-12-7-24-17-24-35Z"/><path d="M64 8v10M27 26l8 6M93 32l8-6M54 55h20M64 45v24"/>',
  cinderweaver:
    '<path d="M66 18c6 26 27 29 25 51-2 26-45 32-53 7-7-21 12-32 12-46 3 9 5 16 10 19 8-7 9-18 6-31Z"/><path d="M64 59c-15 12-14 26 0 30 15-4 16-18 0-30Z"/>',
  frostweaver:
    '<path d="M64 19v75M31 38l66 38M31 76l66-38M52 27l12 10 12-10M52 86l12-10 12 10M31 50l15-4 1-16M81 84l1-16 15-4M31 64l15 4 1 16M81 30l1 16 15 4"/>',
  stormsinger: '<path d="M72 18 37 61h24l-8 36 39-53H67l5-26Z"/><path d="M29 31h14M88 80h14"/>',
  tidecaller:
    '<path d="M27 56c11-19 22 17 36-2 15-22 23 13 39-3M27 73c11-19 22 17 36-2 15-22 23 13 39-3M64 18c-6 10-15 18-15 25 0 13 30 13 30 0 0-7-9-15-15-25Z"/>',
}
const effectGlyphs: Readonly<Record<string, string>> = {
  burn: '<path d="m8 2 3 9 4-4c7 10 4 17-4 17S0 17 8 2Z"/>',
  bleed: '<path d="M8 3C5 9 1 12 1 17a7 7 0 0 0 14 0c0-5-4-8-7-14ZM20 9v9"/>',
  poison: '<circle cx="11" cy="10" r="8"/><path d="M6 9h1m8 0h1M8 16v7m6-7v7"/>',
  regeneration: '<path d="M12 2v20M2 12h20"/>',
  root: '<path d="M12 1v12l-8 9M12 13l8 9M12 9 3 5M12 7l9-3M4 22l-2-7M20 22l2-7"/>',
  slow: '<circle cx="12" cy="12" r="10"/><path d="M12 5v8l5 3"/>',
  guarded: '<path d="M3 4 12 1l9 3v8c0 5-5 9-9 11-4-2-9-6-9-11Z"/>',
  fortified: '<path d="M3 3h5v5h8V3h5v19H3Z"/>',
  reckless: '<path d="m2 22 20-20M4 3l17 18M16 4l6-2-2 6M3 15l7 7"/>',
  challenged: '<path d="M12 2v13M12 20v2"/><circle cx="12" cy="12" r="11"/>',
  marked: '<circle cx="12" cy="12" r="8"/><path d="M12 0v7m0 10v7M0 12h7m10 0h7"/>',
  warded: '<path d="M3 4 12 1l9 3v8c0 5-5 9-9 11-4-2-9-6-9-11Z"/><path d="M8 10h8M12 6v9"/>',
  exposed: '<path d="m2 2 20 20M22 2 2 22"/><circle cx="12" cy="12" r="9"/>',
}
function source(svg: string) {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
function frame(color: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><radialGradient id="bg"><stop stop-color="${color}" stop-opacity=".2"/><stop offset="1" stop-color="#0a1017"/></radialGradient></defs><rect x="2" y="2" width="124" height="124" rx="16" fill="#0a1017"/><rect x="5" y="5" width="118" height="118" rx="13" fill="url(#bg)" stroke="${color}" stroke-opacity=".55"/><g fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`
}
export function phase4DisciplineSigil(disciplineId: string): string | null {
  const image = imageAssetRegistry.get(`art.phase4.${disciplineId}.identity.v01`)
  if (image?.status === 'approved' && image.src) return image.src
  const color = PHASE4_DISCIPLINE_COLORS[disciplineId]
  return color ? source(frame(color, glyphs[disciplineId]!)) : null
}
export function phase4SkillArtwork(actionId: string): string | null {
  const discipline = actionId.startsWith('essence.')
    ? actionId.split('.')[1]!
    : actionId.split('.')[0]!
  const color = PHASE4_DISCIPLINE_COLORS[discipline]
  if (!color) return null
  const skill = actionId.startsWith('essence.')
    ? resolveEssenceForBuild(discipline, null)?.skill
    : resolveMatureSkillVersion(actionId)
  if (!skill || skill.id !== actionId) return null
  if (actionId.startsWith('essence.')) {
    const identity = phase4DisciplineSigil(discipline)
    if (identity?.startsWith('/media/')) return identity.replace('-128-', '-256-')
  }
  const status = skill.effects.find((effect) => effect.type === 'apply-status')
  const icon =
    status?.type === 'apply-status'
      ? effectGlyphs[status.statusId]
      : skill.effects.some((effect) => effect.type === 'remove-status')
        ? '<path d="m3 13 6 6L22 3M3 3l3 3M19 20l3 3"/>'
        : skill.effects.some((effect) => effect.type === 'healing')
          ? effectGlyphs.regeneration
          : '<path d="M2 21 21 2M13 2h8v8"/>'
  const shape =
    skill.target.shape.kind === 'circle'
      ? '<circle cx="20" cy="20" r="8"/>'
      : skill.target.shape.kind === 'line'
        ? '<path d="M13 26 26 13M18 13h8v8"/>'
        : '<path d="m20 12 8 8-8 8-8-8Z"/>'
  const initials = actionId
    .split('.')
    .at(-1)!
    .split('-')
    .map((word) => word[0]!.toUpperCase())
    .slice(0, 3)
    .join('')
  return source(
    frame(
      color,
      `${glyphs[discipline]}${shape}<rect x="90" y="89" width="30" height="31" rx="7" fill="#0a1017" stroke-opacity=".6"/><g transform="translate(93 93)" stroke-width="2">${icon}</g><text x="16" y="114" font-family="serif" font-size="15" fill="${color}" stroke="none">${initials}</text>`,
    ),
  )
}
export function phase4ResonanceArtwork(id: string): string | null {
  const pair = id.split('.')[1]?.split('-') ?? []
  if (!pair.some((discipline) => ADVANCED_DISCIPLINES.some((entry) => entry.id === discipline)))
    return null
  const first = PHASE4_DISCIPLINE_COLORS[pair[0]!] ?? '#d0b57b'
  const second = PHASE4_DISCIPLINE_COLORS[pair[1]!] ?? '#9ecaba'
  return source(
    frame(
      first,
      `<circle cx="49" cy="60" r="27"/><circle cx="79" cy="60" r="27" stroke="${second}"/><path d="M28 97h69m-9-8 9 8-9 8"/><path d="m64 38 9 22-9 22-9-22Z" fill="${second}" fill-opacity=".3"/>`,
    ),
  )
}
