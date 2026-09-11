import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const base = resolve(root, 'content/media-candidates/phase4')
const audio = JSON.parse(await readFile(resolve(base, 'audio-manifest.json'), 'utf8'))
const art = JSON.parse(await readFile(resolve(base, 'art-manifest.json'), 'utf8'))
const source = async (path, mime) =>
  `data:${mime};base64,${(await readFile(resolve(base, path))).toString('base64')}`
const escape = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
const label = (id) => id.charAt(0).toUpperCase() + id.slice(1)
const descriptions = {
  bastion: 'Broad steel. A steady defensive silhouette.',
  ravager: 'Heavy iron. Coarse, forceful contact.',
  edgedancer: 'Slender steel. Precise, light movement.',
  wildwarden: 'Yew, thorns and a taut bowstring.',
  runeblade: 'Steel grounded in restrained rune light.',
  dawnshield: 'Warm bronze and protective sun geometry.',
  cinderweaver: 'Dry ignition and a contained flame.',
  frostweaver: 'Angular ice and brittle fractures.',
  stormsinger: 'A brief electric crack and displaced air.',
  tidecaller: 'A smooth crest and flowing release.',
  attrition: 'A subdued tick for Burn, Bleed and Poison.',
  healing: 'A soft release for restored health.',
  cleanse: 'A clear release for removing harmful effects.',
  resonance: 'A short conversion accent; pair-specific mixing awaits listening review.',
}
const decisions =
  '<option>Not reviewed</option><option>Keep candidate</option><option>Revise</option>'
const cueData = []
const cards = []
for (const family of Object.keys(descriptions)) {
  const identity = art.find((entry) => entry.disciplineId === family)
  let artwork = ''
  if (identity) {
    const thumbnail = await source(
      identity.previews.find((item) => item.width === 256).path,
      'image/webp',
    )
    const master = await source(identity.master, 'image/webp')
    artwork = `<button class="artwork" data-master="${master}" aria-label="View ${label(family)} identity artwork"><img src="${thumbnail}" alt="${escape(descriptions[family])}" width="256" height="256" loading="lazy"></button><div class="sample"><img src="${thumbnail}" alt="${label(family)} icon size sample"><span>Gameplay size sample</span></div>`
  }
  let controls = ''
  for (const role of ['action', 'essence']) {
    const cues = audio.filter((entry) => entry.family === family && entry.role === role)
    if (!cues.length) continue
    for (const cue of cues) cueData.push({ ...cue, src: await source(cue.runtime, 'audio/mpeg') })
    controls += `<div class="cue-row"><span>${label(role)}</span>${cues.map((cue) => `<button data-cue="${cue.id}" aria-label="Play ${label(family)} ${role} ${cue.variant}">▶ ${cue.variant}</button>`).join('')}</div>`
  }
  cards.push(
    `<article data-family="${family}">${artwork}<h2>${label(family)}</h2><p>${descriptions[family]}</p>${controls}<details><summary>Review notes</summary>${identity ? `<label>Artwork<select data-art-decision>${decisions}</select></label>` : ''}<label>Sound<select data-audio-decision>${decisions}</select></label><label>Notes<textarea rows="3" placeholder="What should stay or change?"></textarea></label></details></article>`,
  )
}
const req = createRequire(resolve(root, 'packages/audio/package.json'))
const viteReq = createRequire(req.resolve('vitest/package.json'))
const { build } = await import(pathToFileURL(viteReq.resolve('vite')).href)
const bundle = await build({
  configFile: false,
  logLevel: 'error',
  root,
  build: {
    write: false,
    minify: true,
    lib: {
      entry: resolve(root, 'apps/web/scripts/phase4-media-review.ts'),
      name: 'Phase4MediaReview',
      formats: ['iife'],
    },
  },
})
const code = (Array.isArray(bundle) ? bundle[0] : bundle).output.find(
  (item) => item.type === 'chunk',
).code
const css = await readFile(resolve(root, 'scripts/media/phase4-review.css'), 'utf8')
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AUREVANE · Phase 4 media review</title><style>${css}</style></head><body>
<header><p class="eyebrow">AUREVANE / PHASE 4</p><h1>Materials, motion, magic.</h1><p class="intro">Ten Discipline identities. Seventy-two sound candidates. Compare their silhouettes at gameplay sizes, then listen for clear and distinct material character.</p><span class="badge">Candidate set 01 · awaiting your review</span></header>
<main><section class="controls" aria-label="Review controls"><div><label>Find a family<input id="filter" type="search" placeholder="Bastion, healing…"></label><small id="results">14 sound and art families shown</small></div><div><span class="control-label">Icon sample size</span><div class="buttons"><button data-size="32" aria-pressed="false">32 px</button><button data-size="64" aria-pressed="true">64 px</button><button data-size="128" aria-pressed="false">128 px</button></div></div><label>Master <output id="master-value">55%</output><input id="master" type="range" min="0" max="100" value="55"></label><label>Sound effects <output id="sfx-value">78%</output><input id="sfx" type="range" min="0" max="100" value="78"></label><div class="buttons"><button id="mute" aria-pressed="false">Mute</button><button id="stop">Stop audio</button></div><p id="audio-status" role="status">Sound starts only when you press Play. Up to two cues can overlap.</p></section>
<section class="grid" aria-label="Discipline art and sound candidates">${cards.join('')}</section>
<section class="review-guide"><h2>What to look and listen for</h2><p>Check the 32 px and 64 px silhouettes. Compare Bastion with Dawnshield, and Edgedancer with Runeblade. Listen on headphones and ordinary speakers at a comfortable volume. Essence cues should feel richer without a volume jump.</p><p>The sounds are original synthesized material studies, not field recordings. These are identity masters and cue families; they are not 80 bespoke Skill paintings or 105 finished pair-specific sound mixes. The existing targeting and effect glyphs remain the mechanical information layer.</p><p>Use the notes under each card, then save your feedback. Nothing in this packet publishes assets or changes the live game. The project’s media pipeline requires human review before production use.</p><button id="export">Save review notes</button></section></main>
<footer>No external assets or network requests. Generated artwork and original rendered audio · candidate provenance retained with the project.</footer>
<dialog id="art-modal" aria-labelledby="master-label"><div><strong id="master-label"></strong><button id="close-art">Close artwork</button></div><img id="master-image" alt=""></dialog>
<script id="media-data" type="application/json">${JSON.stringify({ audio: cueData }).replaceAll('<', '\\u003c')}</script><script>${code.replaceAll('</script', '<\\/script')}</script></body></html>`
const output = resolve(process.argv[2] ?? resolve(root, '../phase4-media-review.html'))
await writeFile(output, html)
console.log(
  JSON.stringify({ output, bytes: Buffer.byteLength(html), art: art.length, audio: audio.length }),
)
