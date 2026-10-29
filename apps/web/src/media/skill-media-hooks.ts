import { skillFxGroups, audioAssetRegistry } from '@aurevane/audio'
import skillFxAssignments from './skill-fx-assignments.json'
import { DISCIPLINE_ATLAS } from '@aurevane/game-core/character/discipline-atlas'
import { resolveEssenceForBuild } from '@aurevane/game-core/combat/essence'
import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'

import { essenceSkillArtwork } from './essence-skill-art'
import { darkFantasySkillArtwork } from './generated-dark-fantasy-art'
import { regularSkillArtwork } from './regular-skill-art'

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
  audioGroup?: string
  sampleAssetId: string | null
  sampleSrc: string | null
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
  return (
    regularSkillArtwork(skillId) ?? essenceSkillArtwork(skillId) ?? darkFantasySkillArtwork(skillId)
  )
}

const currentEssenceSkills = DISCIPLINE_ATLAS.flatMap((discipline) => {
  if (discipline.publication !== 'published') return []
  const essence = resolveEssenceForBuild(discipline.id, null)
  return essence ? [essence.skill] : []
})

const currentSkills = [...latestEnabledMatureSkills(), ...currentEssenceSkills]

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

export const skillAudioCueHookOptions: readonly SkillAudioCueHookOption[] = skillFxGroups.map(
  (group) => {
    const sample = audioAssetRegistry.get(`${group.key}-1`)
    return {
      key: group.key,
      skillId: '',
      sourceDisciplineId: '',
      label: group.label,
      available: Boolean(sample?.src),
      audioFamily: null,
      audioGroup: group.key,
      sampleAssetId: sample?.id ?? null,
      sampleSrc: sample?.src ?? null,
    }
  },
)
const audioHookByKey = new Map(
  skillAudioCueHookOptions.map((option) => [option.key, option] as const),
)
const initialAssignments: Readonly<Record<string, string>> = skillFxAssignments
export function resolveSkillAudioCueHook(
  key: string | null | undefined,
): SkillAudioCueHookOption | null {
  if (!key) return null
  const group = audioHookByKey.get(key)
  if (group) return group
  const assigned = initialAssignments[key]
  const option = assigned ? audioHookByKey.get(assigned) : undefined
  if (!option) return null
  const original = currentSkills.find((skill) => skill.media.audioCueKey === key)
  return {
    ...option,
    key,
    skillId: original?.id ?? '',
    sourceDisciplineId: original?.sourceDisciplineId ?? '',
  }
}
export function isRegisteredSkillAudioCueHook(key: string | null | undefined): boolean {
  return key === null || key === undefined || resolveSkillAudioCueHook(key) !== null
}
