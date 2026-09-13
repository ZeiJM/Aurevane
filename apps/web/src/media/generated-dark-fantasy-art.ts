const DISCIPLINE_ORDER = [
  'vanguard', 'farstrider', 'shadehand', 'ironfist', 'aetherist', 'lifebinder',
  'bastion', 'chronist', 'cinderweaver', 'dawnshield', 'edgedancer', 'frostweaver',
  'ravager', 'runeblade', 'stormsinger', 'tidecaller', 'wildwarden',
] as const

export type ArtDisciplineId = (typeof DISCIPLINE_ORDER)[number]

const THEMES: Readonly<Record<ArtDisciplineId, readonly [string, string, string]>> = {
  vanguard: ['#d4493f', '#5b1517', '#ffd59a'],
  farstrider: ['#6bc58b', '#163c32', '#d9ef9b'],
  shadehand: ['#9b59e7', '#24133f', '#ecb5ff'],
  ironfist: ['#e6a94e', '#523217', '#ffe4a3'],
  aetherist: ['#7f74ff', '#171852', '#8deaff'],
  lifebinder: ['#58d995', '#123b2d', '#d0ffc1'],
  bastion: ['#d29d62', '#3c2c24', '#fff0c7'],
  chronist: ['#d2ae72', '#30253a', '#a9d8ff'],
  cinderweaver: ['#ff5a36', '#4b1010', '#ffc36c'],
  dawnshield: ['#f7d47d', '#493713', '#fff8d5'],
  edgedancer: ['#d7d9ef', '#24223b', '#b69cff'],
  frostweaver: ['#7fcaff', '#16365e', '#e7fbff'],
  ravager: ['#d92f42', '#3f1018', '#ff9d6f'],
  runeblade: ['#956cff', '#24174c', '#9ff4ff'],
  stormsinger: ['#5ba5ff', '#142a55', '#e1f3ff'],
  tidecaller: ['#45c7df', '#113e51', '#baf8ff'],
  wildwarden: ['#65bd6d', '#173b22', '#d8e99a'],
}

const SYMBOLS: Readonly<Record<ArtDisciplineId, string>> = {
  vanguard: '<path d="M64 22 90 33v23c0 22-11 37-26 49-15-12-26-27-26-49V33Z"/><path d="M64 31v61M47 51h34"/>',
  farstrider: '<path d="M37 91Q83 64 37 37Q67 64 37 91Z"/><path d="M45 84 91 38M70 42l21-4-4 21"/>',
  shadehand: '<path d="M38 89 84 35M44 35l45 54M36 96l14-7-7-7ZM92 96l-14-7 7-7Z"/>',
  ironfist: '<path d="M44 80V48q0-9 7-9 6 0 6 8V34q0-8 7-8t7 8v13q0-8 7-8t7 8v31q0 25-22 25-19 0-25-23Z"/>',
  aetherist: '<path d="m64 24 18 28-18 50-18-50Z"/><ellipse cx="64" cy="64" rx="42" ry="16"/><ellipse cx="64" cy="64" rx="16" ry="42"/>',
  lifebinder: '<path d="M64 101V54M64 71Q35 69 32 43q27-3 32 22M64 65q6-25 32-22-3 26-32 28"/><circle cx="64" cy="34" r="10"/>',
  bastion: '<path d="M34 36h60v54l-15 13H49L34 90Z"/><path d="M46 36V25h10v11M72 36V25h10v11M47 58h34M64 58v37"/>',
  chronist: '<path d="M44 27h40M44 101h40M48 31q0 23 16 33-16 10-16 33M80 31q0 23-16 33 16 10 16 33"/><circle cx="64" cy="64" r="43"/>',
  cinderweaver: '<path d="M67 21q4 21-12 34 9-2 15 9 8-8 13-22 14 18 8 38-6 24-29 24-26 0-27-25-1-18 17-35-2 17 8 24 1-18 7-47Z"/>',
  dawnshield: '<path d="M64 21v84M39 46h50"/><path d="M33 68q-14-13-18-1 13 4 22 15M95 68q14-13 18-1-13 4-22 15"/><circle cx="64" cy="39" r="22"/>',
  edgedancer: '<path d="M35 94 88 29M40 29l53 65"/><path d="m33 91 15-5-10-10ZM95 91l-15-5 10-10Z"/>',
  frostweaver: '<path d="M64 23v82M28 44l72 40M100 44 28 84M64 23l-8 13M64 23l8 13M28 44l16 1M28 44l7 14M100 44l-16 1M100 44l-7 14"/>',
  ravager: '<path d="M40 31q22 17 24 40 2-23 24-40l8 11q-8 35-32 61Q40 77 32 42Z"/><path d="M45 57 26 38M83 57l19-19"/>',
  runeblade: '<path d="M64 20 75 35 69 83 64 106 59 83 53 35Z"/><circle cx="64" cy="64" r="39"/><path d="M38 64h52M64 38v52"/>',
  stormsinger: '<path d="m70 19-28 48h22l-9 42 32-54H66Z"/><circle cx="64" cy="64" r="43"/>',
  tidecaller: '<path d="M64 25v74M45 38q19-20 38 0M45 38v18M83 38v18"/><path d="M24 82q13-14 26 0t27 0 27 0"/>',
  wildwarden: '<path d="M64 102V62M64 72Q42 69 35 49q23-4 29 15M64 64q8-20 29-15-7 20-29 23"/><path d="M48 54 34 32M80 54l14-22M38 38l-12-5M90 38l12-5"/>',
}

function hash(value: string): number {
  let result = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    result ^= value.charCodeAt(i)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

function encode(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function disciplineFromAction(actionId: string): ArtDisciplineId | null {
  const parts = actionId.split('.')
  const candidate = parts[0] === 'essence' ? parts[1] : parts[0]
  return DISCIPLINE_ORDER.includes(candidate as ArtDisciplineId) ? (candidate as ArtDisciplineId) : null
}

function particles(seed: number, spark: string): string {
  let nodes = ''
  for (let i = 0; i < 9; i += 1) {
    const x = 14 + ((seed >>> (i % 24)) + i * 23) % 100
    const y = 14 + ((seed >>> ((i + 7) % 24)) + i * 31) % 100
    const r = 1 + ((seed >>> ((i + 13) % 24)) % 3)
    nodes += `<circle cx="${x}" cy="${y}" r="${r}" fill="${spark}" opacity=".${4 + (i % 5)}"/>`
  }
  return nodes
}

function skillSvg(id: string, discipline: ArtDisciplineId, essence: boolean): string {
  const seed = hash(id)
  const [accent, deep, spark] = THEMES[discipline]
  const angle = seed % 360
  const ring = 38 + (seed % 8)
  const shard = 15 + ((seed >>> 5) % 16)
  const symbol = SYMBOLS[discipline]
  const essenceHalo = essence
    ? `<circle cx="64" cy="64" r="51" fill="none" stroke="${spark}" stroke-width="2.4" stroke-dasharray="3 4" opacity=".9"/><path d="M64 7 69 17 64 27 59 17Z" fill="${spark}"/>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><radialGradient id="bg" cx="32%" cy="24%" r="95%"><stop stop-color="${accent}" stop-opacity=".55"/><stop offset=".47" stop-color="${deep}" stop-opacity=".8"/><stop offset="1" stop-color="#04050a"/></radialGradient><linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff1c2"/><stop offset=".35" stop-color="#a98147"/><stop offset=".68" stop-color="#efe1bf"/><stop offset="1" stop-color="#624a2e"/></linearGradient><filter id="g"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect width="128" height="128" rx="15" fill="url(#bg)"/><path d="M8 25V8h17M103 8h17v17M120 103v17h-17M25 120H8v-17" fill="none" stroke="url(#metal)" stroke-width="3"/><circle cx="64" cy="64" r="55" fill="none" stroke="${accent}" stroke-opacity=".28"/><g transform="rotate(${angle} 64 64)" opacity=".42" stroke="${spark}" fill="none"><circle cx="64" cy="64" r="${ring}" stroke-dasharray="${shard} 8"/><path d="M18 64h92M64 18v92" stroke-width=".8"/></g>${particles(seed, spark)}${essenceHalo}<g fill="none" stroke="${spark}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" filter="url(#g)">${symbol}</g><circle cx="64" cy="64" r="4" fill="#fff9e9" opacity=".9"/></svg>`
}

export function darkFantasySkillArtwork(actionId: string): string | null {
  const discipline = disciplineFromAction(actionId)
  if (!discipline) return null
  return encode(skillSvg(actionId, discipline, actionId.startsWith('essence.')))
}

export function darkFantasyResonanceArtwork(resonanceId: string): string | null {
  const pair = resonanceId.split('.')[1]?.split('-') ?? []
  const first = pair[0] as ArtDisciplineId
  const second = pair[1] as ArtDisciplineId
  if (!DISCIPLINE_ORDER.includes(first) || !DISCIPLINE_ORDER.includes(second)) return null
  const seed = hash(resonanceId)
  const a = THEMES[first]
  const b = THEMES[second]
  const angle = seed % 180
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><radialGradient id="bg"><stop stop-color="${a[1]}"/><stop offset=".55" stop-color="#090711"/><stop offset="1" stop-color="${b[1]}"/></radialGradient><linearGradient id="r"><stop stop-color="${a[2]}"/><stop offset=".5" stop-color="#fff5d7"/><stop offset="1" stop-color="${b[2]}"/></linearGradient><filter id="g"><feGaussianBlur stdDeviation="1.7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect width="128" height="128" rx="15" fill="url(#bg)"/><circle cx="64" cy="64" r="54" fill="none" stroke="url(#r)" stroke-width="3"/><circle cx="64" cy="64" r="45" fill="none" stroke="url(#r)" stroke-dasharray="6 5" opacity=".75" transform="rotate(${angle} 64 64)"/>${particles(seed,a[2])}<g transform="translate(-13 4) scale(.72)" fill="none" stroke="${a[2]}" stroke-width="3.7" stroke-linecap="round" stroke-linejoin="round" filter="url(#g)">${SYMBOLS[first]}</g><g transform="translate(49 4) scale(.72)" fill="none" stroke="${b[2]}" stroke-width="3.7" stroke-linecap="round" stroke-linejoin="round" filter="url(#g)">${SYMBOLS[second]}</g><path d="M42 86Q64 105 86 86M42 42Q64 23 86 42" fill="none" stroke="url(#r)" stroke-width="2.5"/><circle cx="64" cy="64" r="7" fill="#fff7df" stroke="url(#r)" stroke-width="2"/></svg>`
  return encode(svg)
}

export function disciplineSigilDataUrl(discipline: string): string | null {
  if (!DISCIPLINE_ORDER.includes(discipline as ArtDisciplineId)) return null
  const id = discipline as ArtDisciplineId
  const [accent, deep, spark] = THEMES[id]
  const seed = hash(`sigil.${id}`)
  const rune = 4 + (seed % 7)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><radialGradient id="b"><stop stop-color="${deep}"/><stop offset=".72" stop-color="#06070b"/><stop offset="1" stop-color="#010204"/></radialGradient><linearGradient id="m"><stop stop-color="#fff1c9"/><stop offset=".24" stop-color="#bc8b45"/><stop offset=".55" stop-color="${spark}"/><stop offset=".78" stop-color="#8c6535"/><stop offset="1" stop-color="#f6ddb2"/></linearGradient><filter id="g"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><circle cx="64" cy="64" r="61" fill="url(#b)"/><circle cx="64" cy="64" r="57" fill="none" stroke="url(#m)" stroke-width="3"/><circle cx="64" cy="64" r="49" fill="none" stroke="${accent}" stroke-width="1.5" stroke-dasharray="${rune} 4"/><circle cx="64" cy="64" r="43" fill="none" stroke="${spark}" stroke-opacity=".33"/><path d="M64 1 69 11 64 21 59 11ZM64 107l5 10-5 10-5-10ZM1 64l10-5 10 5-10 5ZM107 64l10-5 10 5-10 5Z" fill="url(#m)"/>${particles(seed,spark)}<g fill="none" stroke="url(#m)" stroke-width="3.7" stroke-linecap="round" stroke-linejoin="round" filter="url(#g)">${SYMBOLS[id]}</g></svg>`
  return encode(svg)
}

export const DARK_FANTASY_DISCIPLINES = DISCIPLINE_ORDER
