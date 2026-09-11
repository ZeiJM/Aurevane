import { AudioDirector } from '../../../packages/audio/src/director'
import { createDefaultAudioSettings } from '../../../packages/audio/src/settings'

type Cue = { id: string; family: string; role: string; variant: number; src: string }
const data = JSON.parse(document.getElementById('media-data')!.textContent!) as { audio: Cue[] }
const director = new AudioDirector()
const settings = createDefaultAudioSettings()
settings.volumes.master = 0.55
const status = document.getElementById('audio-status')!
let generation = 0

function stop() {
  generation += 1
  director.stopAll()
  status.textContent = 'Audio stopped.'
}
document.getElementById('stop')!.addEventListener('click', stop)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stop()
})
window.addEventListener('pagehide', () => {
  stop()
  void director.close()
})

for (const channel of ['master', 'sfx'] as const) {
  const input = document.getElementById(channel) as HTMLInputElement
  input.addEventListener('input', () => {
    settings.volumes[channel] = Number(input.value) / 100
    document.getElementById(channel + '-value')!.textContent = input.value + '%'
    director.setSettings(settings)
  })
}
document.getElementById('mute')!.addEventListener('click', (event) => {
  settings.muted = !settings.muted
  const button = event.currentTarget as HTMLButtonElement
  button.setAttribute('aria-pressed', String(settings.muted))
  button.textContent = settings.muted ? 'Unmute' : 'Mute'
  if (settings.muted) stop()
  director.setSettings(settings)
  status.textContent = settings.muted ? 'Audio muted.' : 'Ready to audition.'
})

document.querySelectorAll<HTMLButtonElement>('[data-cue]').forEach((button) => {
  button.addEventListener('click', async () => {
    const cue = data.audio.find((entry) => entry.id === button.dataset.cue)!
    const current = generation
    director.setSettings(settings)
    const ready = await director.unlock()
    if (current !== generation || document.hidden) return
    if (settings.muted || settings.volumes.master === 0 || settings.volumes.sfx === 0) {
      status.textContent = 'Raise the volume or unmute to audition.'
      return
    }
    const playing =
      ready === 'ready' &&
      (await director.auditionAsset({
        id: cue.id,
        kind: 'sfx',
        channel: 'sfx',
        status: 'candidate',
        requestId: 'AUDIO-DISC-001',
        src: cue.src,
        loop: false,
        preload: 'none',
      }))
    if (current === generation)
      status.textContent = playing
        ? `Audition started: ${button.getAttribute('aria-label')!.replace(/^Play /, '')}.`
        : 'Audio could not start. Try another browser or check its sound settings.'
  })
})

document.querySelectorAll<HTMLButtonElement>('[data-size]').forEach((button) => {
  button.addEventListener('click', () => {
    document.documentElement.style.setProperty('--sample-size', button.dataset.size + 'px')
    document
      .querySelectorAll('[data-size]')
      .forEach((other) => other.setAttribute('aria-pressed', String(other === button)))
  })
})
document.getElementById('filter')!.addEventListener('input', (event) => {
  const query = (event.target as HTMLInputElement).value.trim().toLowerCase()
  let visible = 0
  document.querySelectorAll<HTMLElement>('[data-family]').forEach((card) => {
    card.hidden = !card.dataset.family!.includes(query)
    if (!card.hidden) visible += 1
  })
  document.getElementById('results')!.textContent = `${visible} sound and art families shown`
})

document.querySelectorAll<HTMLButtonElement>('[data-master]').forEach((button) => {
  button.addEventListener('click', () => {
    const modal = document.getElementById('art-modal') as HTMLDialogElement
    const image = document.getElementById('master-image') as HTMLImageElement
    image.src = button.dataset.master!
    image.alt = button.getAttribute('aria-label')!.replace(/^View /, '')
    document.getElementById('master-label')!.textContent = image.alt
    modal.showModal()
  })
})
document
  .getElementById('close-art')!
  .addEventListener('click', () =>
    (document.getElementById('art-modal') as HTMLDialogElement).close(),
  )

document.getElementById('export')!.addEventListener('click', () => {
  const notes = Array.from(document.querySelectorAll<HTMLElement>('[data-family]')).map((card) => ({
    family: card.dataset.family,
    art: card.querySelector<HTMLSelectElement>('[data-art-decision]')?.value ?? null,
    audio: card.querySelector<HTMLSelectElement>('[data-audio-decision]')!.value,
    notes: card.querySelector<HTMLTextAreaElement>('textarea')!.value,
  }))
  const payload = {
    set: 'phase4-v01',
    status: 'reviewer-notes-only',
    createdAt: new Date().toISOString(),
    notes,
  }
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'aurevane-phase4-review-notes.json'
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
})
