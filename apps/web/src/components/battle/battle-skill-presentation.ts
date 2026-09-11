import {
  PV1F_BASIC_ATTACK_ID,
  PV1F_GUARD_ACTION_ID,
  PV1F_MP_RECOVER_ACTION_ID,
  PV1F_RECOVER_ACTION_ID,
} from '@aurevane/game-core/combat/pv1f-skills'

import { darkFantasyCombatArtwork } from './dark-fantasy-art'

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
  'lifebinder.vital-sever',
  'lifebinder.searing-bloom',
  'essence.vanguard.unbroken-strike',
  'essence.lifebinder.verdant-rupture',
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
  'lifebinder.vital-sever': '/media/skills/phase3/lifebinder-fortifying-light.webp',
  'lifebinder.searing-bloom': '/media/skills/phase3/lifebinder-sanctuary.webp',
  'essence.vanguard.unbroken-strike': '/media/skills/phase3/essence-vanguard-unbroken-strike.webp',
  'essence.lifebinder.verdant-rupture': '/media/skills/phase3/lifebinder-barrier.webp',
} as const satisfies Record<(typeof PHASE_3_COMBAT_ACTION_IDS)[number], string>

export const PHASE_3_RESONANCE_ARTWORK = {
  'resonance.lifebinder-vanguard.mercys-edge':
    '/media/skills/phase3/resonance-lifebinder-vanguard-mercys-edge.webp',
} as const satisfies Record<(typeof PHASE_3_RESONANCE_IDS)[number], string>

const GENERATED_COMBAT_ARTWORK_IDS = new Set<string>([
  'ironfist.rising-fist',
  'ironfist.sweep',
  'ironfist.focus-breath',
  'ironfist.counter-palm',
  'ironfist.breakfall',
  'ironfist.hammer-knuckle',
  'ironfist.pressure-palm',
  'ironfist.last-stand',
  'essence.ironfist.hundredfold-rush',
  'lifebinder.vital-sever',
  'lifebinder.searing-bloom',
  'essence.lifebinder.verdant-rupture',
  'aetherist.arc-bolt',
  'aetherist.mana-burst',
  'aetherist.ward-pierce',
  'aetherist.arcane-field',
  'aetherist.channel',
  'aetherist.mana-shield',
  'aetherist.chain-spark',
  'aetherist.overchannel',
  'farstrider.aimed-shot',
  'farstrider.pinning-shot',
  'farstrider.volley',
  'farstrider.scouts-mark',
  'farstrider.longshot',
  'farstrider.piercing-barrage',
  'farstrider.fieldcraft',
  'farstrider.keen-focus',
  'shadehand.backstab',
  'shadehand.feint',
  'shadehand.smoke-vial',
  'shadehand.crippling-cut',
  'shadehand.exploit-opening',
  'shadehand.fan-of-knives',
  'shadehand.quick-hands',
  'shadehand.execution-cut',
  'essence.aetherist.aether-nova',
  'essence.farstrider.deadeye-barrage',
  'essence.shadehand.perfect-opening',
])

const GENERATED_RESONANCE_ARTWORK_IDS = new Set<string>([
  'resonance.aetherist-ironfist.conductive-impact',
  'resonance.farstrider-ironfist.marked-approach',
  'resonance.ironfist-lifebinder.renewed-force',
  'resonance.ironfist-shadehand.broken-rhythm',
  'resonance.ironfist-vanguard.tempered-response',
  'resonance.aetherist-farstrider.arcane-hunt',
  'resonance.aetherist-lifebinder.vital-circuit',
  'resonance.aetherist-shadehand.veiled-conduit',
  'resonance.aetherist-vanguard.spellsteel-rhythm',
  'resonance.farstrider-lifebinder.guided-renewal',
  'resonance.farstrider-shadehand.marked-opening',
  'resonance.farstrider-vanguard.covering-break',
  'resonance.lifebinder-shadehand.mercy-in-shadow',
  'resonance.shadehand-vanguard.broken-line',
])

const GENERATED_PALETTES: Readonly<Record<string, readonly [string, string, string]>> = {
  vanguard: ['#e28759', '#6b2f21', '#ffc38f'],
  lifebinder: ['#62d59b', '#1c6646', '#d8ffb8'],
  aetherist: ['#a57ef4', '#4c318b', '#8feaff'],
  farstrider: ['#76c66b', '#315d2c', '#efd76c'],
  shadehand: ['#cf6cba', '#5c2a55', '#c291ff'],
  ironfist: ['#e5aa4f', '#6d461d', '#ffdfa1'],
}

function artworkDisciplineId(actionId: string): string {
  const segments = actionId.split('.')
  return segments[0] === 'essence' ? (segments[1] ?? 'vanguard') : (segments[0] ?? 'vanguard')
}

function stableArtworkHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function generatedArtworkDataUrl(
  artworkId: string,
  colors: readonly [string, string, string],
  resonance = false,
): string {
  const hash = stableArtworkHash(artworkId)
  const [accent, deep, spark] = colors
  const ring = 23 + (hash % 19)
  const angle = hash % 180
  const offsetA = 18 + ((hash >>> 5) % 34)
  const offsetB = 76 + ((hash >>> 11) % 31)
  const sweep = 24 + ((hash >>> 17) % 49)
  const resonanceRing = resonance
    ? `<circle cx="64" cy="64" r="46" fill="none" stroke="${spark}" stroke-width="2" stroke-dasharray="6 7" opacity=".58"/>`
    : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><radialGradient id="b" cx="28%" cy="22%" r="92%"><stop offset="0" stop-color="${accent}" stop-opacity=".48"/><stop offset=".58" stop-color="${deep}" stop-opacity=".32"/><stop offset="1" stop-color="#03070a"/></radialGradient><linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${spark}"/><stop offset="1" stop-color="${accent}"/></linearGradient></defs><rect width="128" height="128" rx="18" fill="#05090d"/><rect x="4" y="4" width="120" height="120" rx="15" fill="url(#b)" stroke="${accent}" stroke-opacity=".42"/><g transform="rotate(${angle} 64 64)" fill="none" stroke="url(#s)" stroke-linecap="round" stroke-linejoin="round"><circle cx="64" cy="64" r="${ring}" stroke-width="3" opacity=".82"/><path d="M${offsetA} 22 L${offsetB} 64 L${offsetA + 9} 106" stroke-width="5"/><path d="M22 ${sweep} L64 ${128 - sweep} L106 ${sweep + 6}" stroke-width="3" opacity=".72"/><path d="M32 64 H96 M64 32 V96" stroke-width="2" opacity=".46"/></g>${resonanceRing}<circle cx="64" cy="64" r="8" fill="${spark}" opacity=".9"/><circle cx="64" cy="64" r="3" fill="#f7fff9"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function generatedSkillArtwork(actionId: string): string {
  const disciplineId = artworkDisciplineId(actionId)
  return generatedArtworkDataUrl(
    actionId,
    GENERATED_PALETTES[disciplineId] ?? GENERATED_PALETTES.vanguard!,
  )
}

function generatedResonanceArtwork(resonanceId: string): string {
  const pairSegment = resonanceId.split('.')[1] ?? 'vanguard-lifebinder'
  const [first = 'vanguard', second = 'lifebinder'] = pairSegment.split('-')
  const firstPalette = GENERATED_PALETTES[first] ?? GENERATED_PALETTES.vanguard!
  const secondPalette = GENERATED_PALETTES[second] ?? GENERATED_PALETTES.lifebinder!
  return generatedArtworkDataUrl(
    resonanceId,
    [firstPalette[0], secondPalette[1], secondPalette[2]],
    true,
  )
}

const ACTION_ARTWORK = new Map<string, string>([
  [PV1F_BASIC_ATTACK_ID, '/media/skills/basic-attack-fist.webp'],
  [PV1F_GUARD_ACTION_ID, '/media/skills/guard.webp'],
  [PV1F_RECOVER_ACTION_ID, '/media/skills/hp-recovery.webp'],
  [PV1F_MP_RECOVER_ACTION_ID, '/media/skills/mp-recovery.svg'],
  ...Object.entries(PHASE_3_COMBAT_ARTWORK),
])

const RESONANCE_ARTWORK = new Map<string, string>(Object.entries(PHASE_3_RESONANCE_ARTWORK))

export function battleSkillArtwork(actionId: string): string {
  const curatedArtwork = darkFantasyCombatArtwork(actionId)
  if (curatedArtwork) return curatedArtwork
  if (GENERATED_COMBAT_ARTWORK_IDS.has(actionId)) return generatedSkillArtwork(actionId)
  return ACTION_ARTWORK.get(actionId) ?? BATTLE_MISSING_ARTWORK
}

export function battleResonanceArtwork(resonanceId: string): string {
  const curatedArtwork = darkFantasyCombatArtwork(resonanceId)
  if (curatedArtwork) return curatedArtwork
  if (GENERATED_RESONANCE_ARTWORK_IDS.has(resonanceId)) {
    return generatedResonanceArtwork(resonanceId)
  }
  return RESONANCE_ARTWORK.get(resonanceId) ?? BATTLE_MISSING_ARTWORK
}
