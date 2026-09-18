import { PHASE4_AUDIO_DISCIPLINES, audioAssetRegistry } from '@aurevane/audio'
import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'

import { darkFantasySkillArtwork } from './generated-dark-fantasy-art'

export interface SkillIconHookOption {
  key: string
  skillId: string
  sourceDisciplineId: string
  label: string
  previewSrc: string
}

export interface SkillAudioCueHookOption {
  key: string
  skillId: string
  sourceDisciplineId: string
  label: string
  available: boolean
  audioFamily: string | null
  sampleAssetId: string | null
  sampleSrc: string | null
}

const CONCEPT_SKILL_ARTWORK: Readonly<Record<string, string>> = {
  'runeblade.aether-cut': '/media/art/concept-ui/skill-runeblade-aether-cut-v01.webp',
  'runeblade.sigil-brand': '/media/art/concept-ui/skill-runeblade-sigil-brand-v01.webp',
  'lifebinder.mend': '/media/art/concept-ui/skill-lifebinder-mend-v01.webp',
  'lifebinder.renew': '/media/art/concept-ui/skill-lifebinder-renew-v01.webp',
}

function titleSkill(skillId: string): string {
  const tail = skillId.includes('.') ? skillId.slice(skillId.indexOf('.') + 1) : skillId
  return tail
    .split(/[._-]/gu)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function registeredSkillArtworkSource(skillId: string): string | null {
  return CONCEPT_SKILL_ARTWORK[skillId] ?? darkFantasySkillArtwork(skillId)
}

const currentSkills = latestEnabledMatureSkills()

export const skillIconHookOptions: readonly SkillIconHookOption[] = currentSkills
  .flatMap((definition) => {
    const key = definition.media.iconKey
    const previewSrc = registeredSkillArtworkSource(definition.id)
    if (!key || !previewSrc) return []
    return [
      {
        key,
        skillId: definition.id,
        sourceDisciplineId: definition.sourceDisciplineId,
        label: `${titleSkill(definition.id)} · ${definition.sourceDisciplineId}`,
        previewSrc,
      },
    ]
  })
  .sort(
    (left, right) =>
      left.sourceDisciplineId.localeCompare(right.sourceDisciplineId) ||
      left.skillId.localeCompare(right.skillId),
  )

const iconHookByKey = new Map(skillIconHookOptions.map((option) => [option.key, option] as const))

export function resolveSkillIconHook(key: string | null | undefined): SkillIconHookOption | null {
  return key ? (iconHookByKey.get(key) ?? null) : null
}

export function isRegisteredSkillIconHook(key: string | null | undefined): boolean {
  return key === null || key === undefined || iconHookByKey.has(key)
}

const audioDisciplines = new Set<string>(PHASE4_AUDIO_DISCIPLINES)

export const skillAudioCueHookOptions: readonly SkillAudioCueHookOption[] = currentSkills
  .flatMap((definition) => {
    const key = definition.media.audioCueKey
    if (!key) return []
    const available = audioDisciplines.has(definition.sourceDisciplineId)
    const sampleAssetId = available
      ? `audio.phase4.${definition.sourceDisciplineId}-action-v01-1`
      : null
    const sample = sampleAssetId ? audioAssetRegistry.get(sampleAssetId) : undefined
    return [
      {
        key,
        skillId: definition.id,
        sourceDisciplineId: definition.sourceDisciplineId,
        label: `${titleSkill(definition.id)} · ${definition.sourceDisciplineId}`,
        available: Boolean(available && sample),
        audioFamily: available ? definition.sourceDisciplineId : null,
        sampleAssetId: sample?.id ?? null,
        sampleSrc: sample?.src ?? null,
      },
    ]
  })
  .sort(
    (left, right) =>
      left.sourceDisciplineId.localeCompare(right.sourceDisciplineId) ||
      left.skillId.localeCompare(right.skillId),
  )

const audioHookByKey = new Map(
  skillAudioCueHookOptions.map((option) => [option.key, option] as const),
)

export function resolveSkillAudioCueHook(
  key: string | null | undefined,
): SkillAudioCueHookOption | null {
  return key ? (audioHookByKey.get(key) ?? null) : null
}

export function isRegisteredSkillAudioCueHook(key: string | null | undefined): boolean {
  return key === null || key === undefined || audioHookByKey.has(key)
}
