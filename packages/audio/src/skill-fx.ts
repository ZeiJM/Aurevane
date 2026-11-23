import type { AudioAssetDescriptor } from './registry'
import groups from './skill-fx-groups.json'

/** Neutral group identities are independent of their initial Skill assignments. */
export const skillFxGroups: readonly { key: string; label: string }[] = groups
export const skillFxAudioAssets: readonly AudioAssetDescriptor[] = skillFxGroups.flatMap((group) =>
  [1, 2, 3].map((variant) => ({
    id: `${group.key}-${variant}`,
    kind: 'sfx',
    channel: 'sfx',
    status: 'approved',
    requestId: 'AUDIO-SKILL-001',
    loop: false,
    preload: 'none',
    src: `/media/audio/sfx/skill-fx-v01/${group.key.split('.').at(-1)}-${variant}.mp3`,
  })),
)

/** Stable semantic assignments reuse the supplied pool for non-Skill battle cues. */
export const sharedSkillFxGroups = {
  resonance: 'audio.skill-fx.v01.049',
  healing: 'audio.skill-fx.v01.092',
  cleanse: 'audio.skill-fx.v01.130',
  attrition: 'audio.skill-fx.v01.028',
} as const
