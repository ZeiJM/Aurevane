'use client'

import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import { SkillCharacteristicRows } from './skill-characteristic-rows'
import { skillParameterRows } from './skill-detail-presentation'
import {
  useSkillEffectTimingPolicy,
  useSkillCopyPolicyVersion,
} from './skill-effect-timing-context'

export function SkillParameters({ skill }: { skill: MatureSkillDefinition }) {
  const timingPolicy = useSkillEffectTimingPolicy()
  const copyPolicyVersion = useSkillCopyPolicyVersion()
  return (
    <SkillCharacteristicRows
      rows={skillParameterRows(skill, skill, timingPolicy, copyPolicyVersion)}
    />
  )
}
