import type { AudioAssetDescriptor } from './registry'

export const PHASE4_AUDIO_DISCIPLINES = [
  'ironfist',
  'chronist',
  'bastion',
  'ravager',
  'edgedancer',
  'wildwarden',
  'runeblade',
  'dawnshield',
  'cinderweaver',
  'frostweaver',
  'stormsinger',
  'tidecaller',
] as const

const families = [...PHASE4_AUDIO_DISCIPLINES, 'attrition', 'healing', 'cleanse', 'resonance']

/** Original material renders; provenance and activation records live in content/media-releases. */
export const phase4AudioAssets: readonly AudioAssetDescriptor[] = families.flatMap((family) =>
  (PHASE4_AUDIO_DISCIPLINES.some((id) => id === family)
    ? ['action', 'essence']
    : ['action']
  ).flatMap((role) =>
    [1, 2, 3].map((variant): AudioAssetDescriptor => ({
      id: `audio.phase4.${family}-${role}-v01-${variant}`,
      kind: 'sfx',
      channel: 'sfx',
      status: 'approved',
      requestId:
        family === 'chronist'
          ? 'AUDIO-DISC-003'
          : family === 'ironfist'
            ? 'AUDIO-DISC-002'
            : 'AUDIO-DISC-001',
      src: `/media/audio/sfx/phase4/${family}-${role}-v01-${variant}.mp3`,
      loop: false,
      preload: 'none',
    })),
  ),
)
