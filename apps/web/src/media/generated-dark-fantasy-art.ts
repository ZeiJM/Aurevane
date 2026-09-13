const DISCIPLINE_ORDER = [
  'vanguard',
  'farstrider',
  'shadehand',
  'ironfist',
  'aetherist',
  'lifebinder',
  'bastion',
  'chronist',
  'cinderweaver',
  'dawnshield',
  'edgedancer',
  'frostweaver',
  'ravager',
  'runeblade',
  'stormsinger',
  'tidecaller',
  'wildwarden',
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
  vanguard:
    '<path d="M64 22 90 33v23c0 22-11 37-26 49-15-12-26-27-26-49V33Z"/><path d="M64 31v61M47 51h34"/>',
  farstrider: '<path d="M37 91Q83 64 37 37Q67 64 37 91Z"/><path d="M45 84 91 38M70 42l21-4-4 21"/>',
  shadehand: '<path d="M38 89 84 35M44 35l45 54M36 96l14-7-7-7ZM92 96l-14-7 7-7Z"/>',
  ironfist:
    '<path d="M44 80V48q0-9 7-9 6 0 6 8V34q0-8 7-8t7 8v13q0-8 7-8t7 8v31q0 25-22 25-19 0-25-23Z"/>',
  aetherist:
    '<path d="m64 24 18 28-18 50-18-50Z"/><ellipse cx="64" cy="64" rx="42" ry="16"/><ellipse cx="64" cy="64" rx="16" ry="42"/>',
  lifebinder:
    '<path d="M64 101V54M64 71Q35 69 32 43q27-3 32 22M64 65q6-25 32-22-3 26-32 28"/><circle cx="64" cy="34" r="10"/>',
  bastion:
    '<path d="M34 36h60v54l-15 13H49L34 90Z"/><path d="M46 36V25h10v11M72 36V25h10v11M47 58h34M64 58v37"/>',
  chronist:
    '<path d="M44 27h40M44 101h40M48 31q0 23 16 33-16 10-16 33M80 31q0 23-16 33 16 10 16 33"/><circle cx="64" cy="64" r="43"/>',
  cinderweaver:
    '<path d="M67 21q4 21-12 34 9-2 15 9 8-8 13-22 14 18 8 38-6 24-29 24-26 0-27-25-1-18 17-35-2 17 8 24 1-18 7-47Z"/>',
  dawnshield:
    '<path d="M64 21v84M39 46h50"/><path d="M33 68q-14-13-18-1 13 4 22 15M95 68q14-13 18-1-13 4-22 15"/><circle cx="64" cy="39" r="22"/>',
  edgedancer:
    '<path d="M35 94 88 29M40 29l53 65"/><path d="m33 91 15-5-10-10ZM95 91l-15-5 10-10Z"/>',
  frostweaver:
    '<path d="M64 23v82M28 44l72 40M100 44 28 84M64 23l-8 13M64 23l8 13M28 44l16 1M28 44l7 14M100 44l-16 1M100 44l-7 14"/>',
  ravager:
    '<path d="M40 31q22 17 24 40 2-23 24-40l8 11q-8 35-32 61Q40 77 32 42Z"/><path d="M45 57 26 38M83 57l19-19"/>',
  runeblade:
    '<path d="M64 20 75 35 69 83 64 106 59 83 53 35Z"/><circle cx="64" cy="64" r="39"/><path d="M38 64h52M64 38v52"/>',
  stormsinger: '<path d="m70 19-28 48h22l-9 42 32-54H66Z"/><circle cx="64" cy="64" r="43"/>',
  tidecaller:
    '<path d="M64 25v74M45 38q19-20 38 0M45 38v18M83 38v18"/><path d="M24 82q13-14 26 0t27 0 27 0"/>',
  wildwarden:
    '<path d="M64 102V62M64 72Q42 69 35 49q23-4 29 15M64 64q8-20 29-15-7 20-29 23"/><path d="M48 54 34 32M80 54l14-22M38 38l-12-5M90 38l12-5"/>',
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
  return DISCIPLINE_ORDER.includes(candidate as ArtDisciplineId)
    ? (candidate as ArtDisciplineId)
    : null
}

function particles(seed: number, spark: string): string {
  let nodes = ''
  for (let i = 0; i < 9; i += 1) {
    const x = 14 + (((seed >>> (i % 24)) + i * 23) % 100)
    const y = 14 + (((seed >>> ((i + 7) % 24)) + i * 31) % 100)
    const r = 1 + ((seed >>> ((i + 13) % 24)) % 3)
    nodes += `<circle cx="${x}" cy="${y}" r="${r}" fill="${spark}" opacity=".${4 + (i % 5)}"/>`
  }
  return nodes
}

const LIFEBINDER_SKILL_MOTIFS: Readonly<Record<string, string>> = {
  'lifebinder.mending-light':
    '<circle cx="64" cy="55" r="19"/><path d="M64 35v40M44 55h40M35 90q14-18 29-7 15-11 29 7M42 92q22 15 44 0"/>',
  'lifebinder.mend':
    '<path d="M24 78q17-17 34 0l6 7 6-7q17-17 34 0M29 75l11-22 18 15M99 75 88 53 70 68"/><circle cx="64" cy="52" r="10"/><path d="M64 44v16M56 52h16"/>',
  'lifebinder.barrier':
    '<path d="M64 24 96 37v25q0 27-32 44Q32 89 32 62V37Z"/><path d="M42 65q22-30 44 0M64 41v45M45 52q19-11 38 0"/>',
  'lifebinder.renew':
    '<path d="M64 101V67M64 76q-24-2-29-24 23-4 29 16M64 68q6-20 29-16-5 22-29 24"/><path d="M64 58q-18-13-5-29 18 8 5 29Zm0 0q18-13 5-29-18 8-5 29Z"/><circle cx="64" cy="65" r="31"/>',
  'lifebinder.sanctuary':
    '<path d="M29 96h70M38 96V56l26-25 26 25v40M51 96V70h26v26"/><circle cx="64" cy="47" r="8"/><path d="M64 42v10M59 47h10"/>',
  'lifebinder.fortifying-light':
    '<path d="M64 24 94 37v24q0 25-30 43Q34 86 34 61V37Z"/><path d="M64 35v54M45 60h38M24 35 36 45M104 35 92 45M64 12v14"/>',
  'lifebinder.vital-sever':
    '<path d="M31 94 91 34M37 30l55 55M26 99l18-6-12-12Z"/><path d="M64 31q20 17 0 35-20-18 0-35Z"/><path d="M78 78q13-15 25-4-8 19-27 14"/>',
  'lifebinder.searing-bloom':
    '<path d="M64 64q-27-7-22-28 22-5 28 21 7-27 28-22 6 22-20 29 27 7 22 28-22 6-29-20-7 27-28 22-6-22 20-29-27-7-22-28 22-6 29 20Z"/><circle cx="64" cy="64" r="10"/>',
  'essence.lifebinder.verdant-rupture':
    '<circle cx="64" cy="64" r="14"/><path d="M64 18 73 49 110 35 82 62l28 31-37-13-9 31-9-31-37 13 28-31-28-27 37 14Z"/><path d="M64 42v44M42 64h44"/>',
}

function bladeSkillMotif(seed: number): string {
  const tilt = 24 + (seed % 58)
  return `<g transform="rotate(${tilt} 64 64)"><path d="M59 17h10l5 65-10 26-10-26Z"/><path d="M43 82h42M52 89h24"/></g><path d="M21 91Q55 38 108 27M17 83Q56 47 103 38"/>`
}

function shieldSkillMotif(seed: number): string {
  const inset = 3 + (seed % 7)
  return `<path d="M64 20 99 34v29q0 28-35 46Q29 91 29 63V34Z"/><path d="M64 ${34 + inset}v55M45 60h38"/><path d="M40 42q24-13 48 0"/>`
}

function healingSkillMotif(seed: number): string {
  const bloom = 18 + (seed % 9)
  return `<circle cx="64" cy="57" r="${bloom}"/><path d="M64 37v40M44 57h40"/><path d="M26 92q19-21 38-6 19-15 38 6M36 96q28 17 56 0"/>`
}

function runeSkillMotif(seed: number): string {
  const angle = seed % 90
  return `<g transform="rotate(${angle} 64 64)"><circle cx="64" cy="64" r="35"/><path d="M64 24 82 55 64 104 46 55Z"/><path d="M29 64h70M64 29v70"/><circle cx="64" cy="64" r="10"/></g>`
}

function projectileSkillMotif(seed: number): string {
  const offset = 4 + (seed % 8)
  return `<path d="M24 94 98 28M75 29l23-1-2 23"/><path d="M28 ${76 + offset}q28-31 59-45"/><circle cx="94" cy="32" r="9"/><path d="M17 99 42 88"/>`
}

function elementalSkillMotif(seed: number): string {
  const rotation = seed % 75
  return `<g transform="rotate(${rotation} 64 64)"><path d="M64 17 76 49 109 39 83 64l26 25-33-10-12 32-12-32-33 10 26-25-26-25 33 10Z"/><circle cx="64" cy="64" r="16"/></g>`
}

function controlSkillMotif(seed: number): string {
  const rotation = seed % 80
  return `<g transform="rotate(${rotation} 64 64)"><circle cx="64" cy="64" r="39"/><path d="M64 21v86M21 64h86M35 35l58 58M93 35 35 93"/></g><path d="M47 64q17-24 34 0-17 24-34 0Z"/><circle cx="64" cy="64" r="7"/>`
}

function fallbackSkillMotif(seed: number): string {
  const angle = seed % 120
  const radius = 30 + (seed % 13)
  return `<g transform="rotate(${angle} 64 64)"><circle cx="64" cy="64" r="${radius}"/><path d="M64 19 76 52 109 64 76 76 64 109 52 76 19 64 52 52Z"/><path d="M28 96 100 32M31 32l66 64"/></g>`
}

function semanticSkillMotif(id: string, seed: number): string {
  const lifebinder = LIFEBINDER_SKILL_MOTIFS[id]
  if (lifebinder) return lifebinder
  if (id === 'runeblade.aether-cut') {
    return '<path d="M24 99Q57 39 108 23M18 88Q55 52 100 35"/><path d="M56 103 78 25 89 18 86 34 68 108Z"/><circle cx="66" cy="62" r="31"/><path d="M44 62h44M66 40v44"/>'
  }

  const key = id.split('.').at(-1) ?? id
  if (/(barrier|ward|guard|brace|cover|fortress|shield|fortif|hold-fast|steady)/.test(key)) {
    return shieldSkillMotif(seed)
  }
  if (/(mend|heal|renew|remedy|herb|sanctuary|light|restor|recovery|second-wind)/.test(key)) {
    return healingSkillMotif(seed)
  }
  if (
    /(rune|sigil|brand|aether|arcane|nova|burst|channel|spell|temporal|time|haste|slow|delay|rewind)/.test(
      key,
    )
  ) {
    return runeSkillMotif(seed)
  }
  if (/(bolt|shot|arrow|barrage|volley|longshot|deadeye|beam|lance)/.test(key)) {
    return projectileSkillMotif(seed)
  }
  if (
    /(frost|ice|snow|winter|cinder|fire|flame|burn|pyre|ember|storm|thunder|lightning|static|tide|wave|water|surge|venom|poison|blood|bleed|wound|thorn|root|snare)/.test(
      key,
    )
  ) {
    return elementalSkillMotif(seed)
  }
  if (/(frenzy|roar|reckless|rage|challenge|taunt|mark|expose|lock)/.test(key)) {
    return controlSkillMotif(seed)
  }
  if (
    /(cut|slash|strike|blow|cleave|lunge|thrust|bash|edge|sever|execution|riposte|flourish|gash)/.test(
      key,
    )
  ) {
    return bladeSkillMotif(seed)
  }
  return fallbackSkillMotif(seed)
}

function skillSvg(id: string, discipline: ArtDisciplineId, essence: boolean): string {
  const seed = hash(id)
  const [accent, deep, spark] = THEMES[discipline]
  const angle = seed % 360
  const ring = 38 + (seed % 8)
  const shard = 10 + ((seed >>> 5) % 16)
  const motif = semanticSkillMotif(id, seed)
  const classSymbol = SYMBOLS[discipline]
  const essenceHalo = essence
    ? `<circle cx="64" cy="64" r="52" fill="none" stroke="url(#metal)" stroke-width="3"/><circle cx="64" cy="64" r="47" fill="none" stroke="${spark}" stroke-width="1.8" stroke-dasharray="3 4" opacity=".9"/><path d="M64 6 70 17 64 28 58 17ZM64 100l6 11-6 11-6-11Z" fill="${spark}"/>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><radialGradient id="bg" cx="27%" cy="19%" r="98%"><stop stop-color="${accent}" stop-opacity=".68"/><stop offset=".42" stop-color="${deep}" stop-opacity=".92"/><stop offset="1" stop-color="#020309"/></radialGradient><linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff5d7"/><stop offset=".3" stop-color="#a98147"/><stop offset=".58" stop-color="${spark}"/><stop offset="1" stop-color="#624a2e"/></linearGradient><linearGradient id="energy" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff"/><stop offset=".3" stop-color="${spark}"/><stop offset=".72" stop-color="${accent}"/><stop offset="1" stop-color="#fff"/></linearGradient><filter id="g"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="mist"><feTurbulence type="fractalNoise" baseFrequency=".022 .055" numOctaves="3" seed="${1 + (seed % 89)}"/><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 .28 0"/></filter></defs><title>${id}</title><rect width="128" height="128" rx="15" fill="url(#bg)"/><rect x="5" y="5" width="118" height="118" rx="12" fill="none" stroke="url(#metal)" stroke-width="2.4"/><rect x="9" y="9" width="110" height="110" rx="10" fill="none" stroke="${accent}" stroke-opacity=".42"/><rect x="8" y="8" width="112" height="112" rx="11" filter="url(#mist)" opacity=".25"/><g transform="rotate(${angle} 64 64)" opacity=".34" stroke="${spark}" fill="none"><circle cx="64" cy="64" r="${ring}" stroke-dasharray="${shard} 7"/><circle cx="64" cy="64" r="31" stroke-dasharray="2 7"/><path d="M18 64h92M64 18v92" stroke-width=".8"/></g>${particles(seed, spark)}${essenceHalo}<g transform="translate(78 78) scale(.34)" fill="none" stroke="${spark}" stroke-width="4.2" opacity=".2">${classSymbol}</g><g fill="none" stroke="#020207" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round" opacity=".68">${motif}</g><g fill="none" stroke="url(#energy)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" filter="url(#g)">${motif}</g><circle cx="64" cy="64" r="3.5" fill="#fff9e9" opacity=".9"/></svg>`
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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><radialGradient id="bg"><stop stop-color="${a[1]}"/><stop offset=".55" stop-color="#090711"/><stop offset="1" stop-color="${b[1]}"/></radialGradient><linearGradient id="r"><stop stop-color="${a[2]}"/><stop offset=".5" stop-color="#fff5d7"/><stop offset="1" stop-color="${b[2]}"/></linearGradient><filter id="g"><feGaussianBlur stdDeviation="1.7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect width="128" height="128" rx="15" fill="url(#bg)"/><circle cx="64" cy="64" r="54" fill="none" stroke="url(#r)" stroke-width="3"/><circle cx="64" cy="64" r="45" fill="none" stroke="url(#r)" stroke-dasharray="6 5" opacity=".75" transform="rotate(${angle} 64 64)"/>${particles(seed, a[2])}<g transform="translate(-13 4) scale(.72)" fill="none" stroke="${a[2]}" stroke-width="3.7" stroke-linecap="round" stroke-linejoin="round" filter="url(#g)">${SYMBOLS[first]}</g><g transform="translate(49 4) scale(.72)" fill="none" stroke="${b[2]}" stroke-width="3.7" stroke-linecap="round" stroke-linejoin="round" filter="url(#g)">${SYMBOLS[second]}</g><path d="M42 86Q64 105 86 86M42 42Q64 23 86 42" fill="none" stroke="url(#r)" stroke-width="2.5"/><circle cx="64" cy="64" r="7" fill="#fff7df" stroke="url(#r)" stroke-width="2"/></svg>`
  return encode(svg)
}

export function disciplineSigilDataUrl(discipline: string): string | null {
  if (!DISCIPLINE_ORDER.includes(discipline as ArtDisciplineId)) return null
  const id = discipline as ArtDisciplineId
  const [accent, deep, spark] = THEMES[id]
  const seed = hash(`sigil.${id}`)
  const rune = 4 + (seed % 7)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><radialGradient id="b"><stop stop-color="${deep}"/><stop offset=".72" stop-color="#06070b"/><stop offset="1" stop-color="#010204"/></radialGradient><linearGradient id="m"><stop stop-color="#fff1c9"/><stop offset=".24" stop-color="#bc8b45"/><stop offset=".55" stop-color="${spark}"/><stop offset=".78" stop-color="#8c6535"/><stop offset="1" stop-color="#f6ddb2"/></linearGradient><filter id="g"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><circle cx="64" cy="64" r="61" fill="url(#b)"/><circle cx="64" cy="64" r="57" fill="none" stroke="url(#m)" stroke-width="3"/><circle cx="64" cy="64" r="49" fill="none" stroke="${accent}" stroke-width="1.5" stroke-dasharray="${rune} 4"/><circle cx="64" cy="64" r="43" fill="none" stroke="${spark}" stroke-opacity=".33"/><path d="M64 1 69 11 64 21 59 11ZM64 107l5 10-5 10-5-10ZM1 64l10-5 10 5-10 5ZM107 64l10-5 10 5-10 5Z" fill="url(#m)"/>${particles(seed, spark)}<g fill="none" stroke="url(#m)" stroke-width="3.7" stroke-linecap="round" stroke-linejoin="round" filter="url(#g)">${SYMBOLS[id]}</g></svg>`
  return encode(svg)
}

export const DARK_FANTASY_DISCIPLINES = DISCIPLINE_ORDER
