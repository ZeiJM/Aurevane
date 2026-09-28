'use client'

import { useState } from 'react'

import { CombatContentEditor, type CombatContentEditorSkillOption } from './combat-content-editor'
import styles from './combat-content-editor.module.css'
import { EssenceContentEditor, type EssenceContentEditorOption } from './essence-content-editor'
import {
  ResonanceContentEditor,
  type ResonanceContentEditorOption,
} from './resonance-content-editor'

export interface CombatContentAuthoringWorkspaceProps {
  readonly skills: readonly CombatContentEditorSkillOption[]
  readonly essences: readonly EssenceContentEditorOption[]
  readonly resonances: readonly ResonanceContentEditorOption[]
}

export function CombatContentAuthoringWorkspace({
  skills,
  essences,
  resonances,
}: CombatContentAuthoringWorkspaceProps) {
  const [contentType, setContentType] = useState<'skills' | 'essences' | 'resonances'>('skills')

  return (
    <div className={styles.authoringWorkspaceShell}>
      <label className={styles.contentTypeField}>
        <span>Content type</span>
        <select
          aria-label="Combat content type"
          value={contentType}
          onChange={(event) =>
            setContentType(event.currentTarget.value as 'skills' | 'essences' | 'resonances')
          }
        >
          <option value="skills">Skills</option>
          <option value="essences">Essences</option>
          <option value="resonances">Resonances</option>
        </select>
      </label>

      {contentType === 'skills' ? (
        <CombatContentEditor skills={skills} initialSkillId={skills[0]?.id} />
      ) : contentType === 'essences' ? (
        <EssenceContentEditor essences={essences} initialEssenceId={essences[0]?.id} />
      ) : (
        <ResonanceContentEditor resonances={resonances} initialResonanceId={resonances[0]?.id} />
      )}
    </div>
  )
}
