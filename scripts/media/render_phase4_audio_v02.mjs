import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const A07_AUDIO_SAMPLE_RATE = 48_000
export const A07_AUDIO_VERSION = 'v02'

export const DISCIPLINE_AUDIO_PROFILES = {
  vanguard: { label: 'Armored weapon impact', recipe: 'armored-impact', modes: [88, 176, 352], duration: 0.32 },
  farstrider: { label: 'Taut bowstring and arrow flight', recipe: 'bow-flight', modes: [145, 435, 1160], duration: 0.24 },
  shadehand: { label: 'Muted blade whisper and cloth', recipe: 'blade-whisper', modes: [118, 746, 1730], duration: 0.21 },
  aetherist: { label: 'Arcane glass spark and rising charge', recipe: 'arcane-charge', modes: [330, 880, 1760], duration: 0.31 },
  lifebinder: { label: 'Warm organic pulse and leaf release', recipe: 'organic-pulse', modes: [196, 294, 588], duration: 0.34 },
  ironfist: { label: 'Wrapped fist contact and cloth movement', recipe: 'padded-contact', modes: [102, 207, 431], duration: 0.25 },
  chronist: { label: 'Measured clockwork tap and suspended glass', recipe: 'clock-glass', modes: [330, 495, 825], duration: 0.28 },
  bastion: { label: 'Deep shield brace and metal bloom', recipe: 'shield-brace', modes: [74, 148, 296], duration: 0.36 },
  ravager: { label: 'Serrated heavy cut and scrape', recipe: 'serrated-cut', modes: [72, 217, 503], duration: 0.30 },
  edgedancer: { label: 'Precise bright blade slice', recipe: 'bright-slice', modes: [710, 1171, 1923], duration: 0.20 },
  wildwarden: { label: 'Wooden string snap and thorn brush', recipe: 'woodland-pluck', modes: [174, 348, 696], duration: 0.29 },
  runeblade: { label: 'Steel contact and rune resonance', recipe: 'rune-steel', modes: [238, 533, 863], duration: 0.33 },
  dawnshield: { label: 'Warm shield resonance and radiant bloom', recipe: 'radiant-shield', modes: [164, 330, 491], duration: 0.36 },
  cinderweaver: { label: 'Dry ignition and flame rush', recipe: 'dry-ignition', modes: [110, 201, 347], duration: 0.30 },
  frostweaver: { label: 'Brittle ice fracture and crystal ring', recipe: 'ice-fracture', modes: [1081, 1667, 2419], duration: 0.25 },
  stormsinger: { label: 'Thunder crack and charged air', recipe: 'storm-crack', modes: [83, 178, 419], duration: 0.30 },
  tidecaller: { label: 'Water impact and flowing release', recipe: 'water-release', modes: [231, 403, 617], duration: 0.36 },
}

function seedFor(family, variant, essence) {
  return createHash('sha256')
    .update(`${family}:${variant}:${essence}:${A07_AUDIO_VERSION}`)
    .digest()
    .readUInt32LE(0)
}

function randomGenerator(seed) {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

function whiteNoise(length, random) {
  const result = new Float64Array(length)
  for (let index = 0; index < length; index += 1) result[index] = random() * 2 - 1
  return result
}

function lowPass(input, cutoff) {
  const result = new Float64Array(input.length)
  const dt = 1 / A07_AUDIO_SAMPLE_RATE
  const rc = 1 / (2 * Math.PI * cutoff)
  const alpha = dt / (rc + dt)
  for (let index = 1; index < input.length; index += 1) {
    result[index] = result[index - 1] + alpha * (input[index] - result[index - 1])
  }
  return result
}

function bandNoise(input, lowCutoff, highCutoff) {
  const high = lowPass(input, highCutoff)
  const low = lowPass(input, lowCutoff)
  const result = new Float64Array(input.length)
  for (let index = 0; index < input.length; index += 1) result[index] = high[index] - low[index]
  return result
}

function addSine(target, frequency, amplitude, decay, detune = 1, attack = 0.002) {
  for (let index = 0; index < target.length; index += 1) {
    const time = index / A07_AUDIO_SAMPLE_RATE
    const envelope = Math.min(time / attack, 1) * Math.exp(-time / decay)
    target[index] += Math.sin(2 * Math.PI * frequency * detune * time) * amplitude * envelope
  }
}

function addSweep(target, startFrequency, endFrequency, amplitude, duration, decay, detune = 1) {
  const slope = ((endFrequency - startFrequency) * detune) / Math.max(duration, 0.001)
  const start = startFrequency * detune
  for (let index = 0; index < target.length; index += 1) {
    const time = index / A07_AUDIO_SAMPLE_RATE
    const swept = Math.min(time, duration)
    const phase = 2 * Math.PI * (start * swept + 0.5 * slope * swept * swept)
    target[index] += Math.sin(phase) * amplitude * Math.exp(-time / decay)
  }
}

function addNoise(target, source, amplitude, decay, attack = 0.001) {
  for (let index = 0; index < target.length; index += 1) {
    const time = index / A07_AUDIO_SAMPLE_RATE
    const envelope = Math.min(time / attack, 1) * Math.exp(-time / decay)
    target[index] += source[index] * amplitude * envelope
  }
}

function addWindowedNoise(target, source, amplitude, center, width) {
  for (let index = 0; index < target.length; index += 1) {
    const time = index / A07_AUDIO_SAMPLE_RATE
    const position = (time - center) / width
    target[index] += source[index] * amplitude * Math.exp(-(position * position))
  }
}

function addModalBody(target, modes, detune, gain = 0.4) {
  modes.forEach((mode, index) => addSine(target, mode, gain / (index + 1), 0.07 + index * 0.035, detune))
}

function addDelay(target, seconds, gain) {
  const offset = Math.round(seconds * A07_AUDIO_SAMPLE_RATE)
  if (offset <= 0 || offset >= target.length) return
  const copy = Float64Array.from(target)
  for (let index = offset; index < target.length; index += 1) {
    target[index] += copy[index - offset] * gain
  }
}

function renderRecipe(family, variant, essence) {
  const profile = DISCIPLINE_AUDIO_PROFILES[family]
  if (!profile) throw new Error(`Unknown A07 Discipline audio family: ${family}`)
  const duration = essence ? 0.62 : profile.duration
  const length = Math.round(duration * A07_AUDIO_SAMPLE_RATE)
  const target = new Float64Array(length)
  const random = randomGenerator(seedFor(family, variant, essence))
  const noise = whiteNoise(length, random)
  const detune = [0.965, 1, 1.035][variant - 1]
  const low = lowPass(noise, 300)
  const cloth = bandNoise(noise, 90, 900)
  const mid = bandNoise(noise, 300, 2800)
  const bright = bandNoise(noise, 1500, 8500)

  switch (profile.recipe) {
    case 'armored-impact':
      addModalBody(target, profile.modes, detune, 0.6)
      addNoise(target, low, 0.75, 0.045)
      addSine(target, 640, 0.20, 0.10, detune)
      break
    case 'bow-flight':
      for (let harmonic = 1; harmonic <= 9; harmonic += 1) {
        addSine(target, 145 * harmonic, 0.56 / harmonic, 0.05 + harmonic * 0.014, detune)
      }
      addNoise(target, bright, 0.34, 0.035)
      addSweep(target, 1550, 900, 0.22, 0.20, 0.12, detune)
      break
    case 'blade-whisper':
      addNoise(target, bandNoise(noise, 700, 3600), 0.58, 0.075)
      addSweep(target, 2100, 950, 0.30, 0.15, 0.07, detune)
      addNoise(target, cloth, 0.22, 0.045)
      break
    case 'arcane-charge':
      addSweep(target, 520, 2500, 0.42, 0.24, 0.16, detune)
      addSine(target, 1760, 0.28, 0.20, detune)
      addSine(target, 2640, 0.11, 0.13, detune)
      ;[0.012, 0.055, 0.11].forEach((center, index) =>
        addWindowedNoise(target, bright, [0.18, 0.11, 0.07][index], center, 0.003),
      )
      break
    case 'organic-pulse':
      addSine(target, 196, 0.48, 0.16, detune, 0.012)
      addNoise(target, bandNoise(noise, 180, 1100), 0.24, 0.055)
      addNoise(target, bandNoise(noise, 1200, 4200), 0.17, 0.20, 0.025)
      addSine(target, 588, 0.16, 0.21, detune, 0.02)
      break
    case 'padded-contact':
      addModalBody(target, profile.modes, detune, 0.34)
      addNoise(target, cloth, 0.48, 0.05)
      addNoise(target, low, 0.20, 0.04)
      break
    case 'clock-glass':
      ;[0.01, 0.095, 0.19].forEach((center, index) =>
        addWindowedNoise(target, bright, [0.34, 0.22, 0.13][index], center, 0.0017),
      )
      addSine(target, 825, 0.22, 0.22, detune)
      addSine(target, 495, 0.12, 0.12, detune)
      break
    case 'shield-brace':
      addModalBody(target, profile.modes, detune, 0.72)
      addNoise(target, low, 0.70, 0.06)
      addSine(target, 296, 0.20, 0.18, detune)
      break
    case 'serrated-cut':
      addModalBody(target, profile.modes, detune, 0.28)
      addNoise(target, bandNoise(noise, 450, 4200), 0.54, 0.14, 0.007)
      addSine(target, 72, 0.24, 0.20, detune)
      break
    case 'bright-slice':
      addNoise(target, bright, 0.62, 0.045)
      addSine(target, 2350, 0.22, 0.075, detune)
      addSweep(target, 1300, 2600, 0.18, 0.12, 0.06, detune)
      break
    case 'woodland-pluck':
      for (let harmonic = 1; harmonic <= 7; harmonic += 1) {
        addSine(target, 174 * harmonic, 0.48 / harmonic, 0.07 + harmonic * 0.012, detune)
      }
      addNoise(target, bandNoise(noise, 500, 2400), 0.25, 0.18, 0.02)
      ;[0.018, 0.072].forEach((center, index) =>
        addWindowedNoise(target, bright, [0.16, 0.09][index], center, 0.0022),
      )
      break
    case 'rune-steel':
      addNoise(target, bandNoise(noise, 850, 5600), 0.46, 0.03)
      addSine(target, 533, 0.30, 0.24, detune)
      addSine(target, 1066, 0.13, 0.15, detune)
      break
    case 'radiant-shield':
      addModalBody(target, profile.modes, detune, 0.28)
      addNoise(target, low, 0.28, 0.05)
      addSine(target, 330, 0.28, 0.28, detune, 0.025)
      addSine(target, 660, 0.12, 0.22, detune, 0.025)
      break
    case 'dry-ignition':
      for (let index = 0; index < (essence ? 16 : 10); index += 1) {
        addWindowedNoise(target, bright, 0.13, 0.008 + random() * duration * 0.48, 0.0028)
      }
      addNoise(target, mid, 0.32, 0.17, 0.012)
      break
    case 'ice-fracture':
      for (let index = 0; index < (essence ? 11 : 7); index += 1) {
        addWindowedNoise(target, bright, 0.15, 0.005 + random() * duration * 0.33, 0.0017)
      }
      addSine(target, 1667, 0.24, 0.24, detune)
      addSine(target, 2419, 0.09, 0.19, detune)
      break
    case 'storm-crack':
      addNoise(target, low, 0.56, 0.09)
      addNoise(target, bright, 0.38, 0.014)
      addSweep(target, 180, 1100, 0.20, 0.22, 0.15, detune)
      break
    case 'water-release':
      addSweep(target, 360, 120, 0.42, 0.28, 0.16, detune)
      addNoise(target, mid, 0.46, 0.10, 0.008)
      break
    default:
      throw new Error(`Unsupported A07 audio recipe: ${profile.recipe}`)
  }

  if (essence) {
    switch (profile.recipe) {
      case 'armored-impact':
      case 'shield-brace':
      case 'radiant-shield':
        addDelay(target, 0.145, 0.36)
        break
      case 'bow-flight':
      case 'woodland-pluck':
        addDelay(target, 0.11, 0.28)
        addDelay(target, 0.225, 0.18)
        break
      case 'blade-whisper':
        addDelay(target, 0.085, -0.18)
        break
      case 'arcane-charge':
        addSweep(target, 300, 3300, 0.18, 0.42, 0.33, detune)
        break
      case 'organic-pulse':
        addSine(target, 392, 0.18, 0.34, detune, 0.05)
        break
      case 'padded-contact':
        addDelay(target, 0.135, 0.85)
        addDelay(target, 0.27, 0.45)
        break
      case 'clock-glass':
        addDelay(target, 0.095, 0.34)
        addDelay(target, 0.19, 0.18)
        break
      case 'serrated-cut':
        addNoise(target, mid, 0.18, 0.26, 0.02)
        break
      case 'bright-slice':
        addDelay(target, 0.055, 0.20)
        break
      case 'rune-steel':
        addSine(target, 1066, 0.16, 0.31, detune, 0.03)
        break
      case 'dry-ignition':
        addNoise(target, mid, 0.18, 0.26, 0.02)
        break
      case 'ice-fracture':
        addSine(target, 2419, 0.14, 0.34, detune, 0.03)
        break
      case 'storm-crack':
        addDelay(target, 0.18, 0.24)
        break
      case 'water-release':
        addSweep(target, 500, 90, 0.17, 0.46, 0.31, detune)
        break
    }
  }

  let mean = 0
  for (const sample of target) mean += sample
  mean /= target.length
  let peak = 0
  let squares = 0
  for (let index = 0; index < target.length; index += 1) {
    const time = index / A07_AUDIO_SAMPLE_RATE
    const fadeIn = Math.min(time / 0.0025, 1)
    const fadeOut = Math.max(Math.min((duration - time) / (essence ? 0.05 : 0.035), 1), 0)
    target[index] = (target[index] - mean) * fadeIn * fadeOut * fadeOut
    peak = Math.max(peak, Math.abs(target[index]))
    squares += target[index] * target[index]
  }

  const rms = Math.sqrt(squares / target.length)
  const targetRms = 10 ** ((family === 'shadehand' || family === 'edgedancer' ? -25 : -24) / 20)
  const peakLimit = 10 ** (-10 / 20)
  const scale = Math.min(targetRms / Math.max(rms, 1e-9), peakLimit / Math.max(peak, 1e-9))
  const pcm = new Int16Array(target.length)
  for (let index = 0; index < target.length; index += 1) {
    pcm[index] = Math.round(Math.max(-1, Math.min(1, target[index] * scale)) * 32767)
  }
  pcm[0] = 0
  pcm[pcm.length - 1] = 0
  return pcm
}

function wavBuffer(samples) {
  const bytes = Buffer.alloc(44 + samples.length * 2)
  bytes.write('RIFF', 0)
  bytes.writeUInt32LE(bytes.length - 8, 4)
  bytes.write('WAVE', 8)
  bytes.write('fmt ', 12)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(A07_AUDIO_SAMPLE_RATE, 24)
  bytes.writeUInt32LE(A07_AUDIO_SAMPLE_RATE * 2, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(samples.length * 2, 40)
  for (let index = 0; index < samples.length; index += 1) bytes.writeInt16LE(samples[index], 44 + index * 2)
  return bytes
}

export function renderA07DisciplineAudio(outputDirectory) {
  mkdirSync(outputDirectory, { recursive: true })
  for (const file of readdirSync(outputDirectory)) {
    if (/-v02-[123]\.wav$/u.test(file)) rmSync(resolve(outputDirectory, file))
  }

  const rows = []
  for (const [family, profile] of Object.entries(DISCIPLINE_AUDIO_PROFILES)) {
    for (const role of ['action', 'essence']) {
      for (const variant of [1, 2, 3]) {
        const samples = renderRecipe(family, variant, role === 'essence')
        const buffer = wavBuffer(samples)
        const filename = `${family}-${role}-${A07_AUDIO_VERSION}-${variant}.wav`
        writeFileSync(resolve(outputDirectory, filename), buffer)
        rows.push({
          family,
          recipe: profile.recipe,
          role,
          variant,
          filename,
          bytes: buffer.length,
          sha256: createHash('sha256').update(buffer).digest('hex'),
        })
      }
    }
  }
  return rows
}

function main() {
  const outputFlag = process.argv.indexOf('--output')
  const outputDirectory =
    outputFlag >= 0 && process.argv[outputFlag + 1]
      ? resolve(process.cwd(), process.argv[outputFlag + 1])
      : resolve(process.cwd(), 'apps/web/public/media/audio/sfx/phase4')
  const rows = renderA07DisciplineAudio(outputDirectory)
  process.stdout.write(
    JSON.stringify({
      cues: rows.length,
      families: new Set(rows.map((row) => row.family)).size,
      runtimeBytes: rows.reduce((total, row) => total + row.bytes, 0),
      maxRuntimeBytes: Math.max(...rows.map((row) => row.bytes)),
    }) + '\n',
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main()
