'use client'

import { useState } from 'react'

import { CombatContentEditor, type CombatContentEditorSkillOption } from './combat-content-editor'
import styles from './combat-content-editor.module.css'
import {
  EssenceContentEditor,
  type EssenceContentEditorOption,
} from './essence-content-editor'

export interface CombatContentAuthoringWorkspaceProps {
  readonly skills: readonly CombatContentEditorSkillOption[]
  readonly essences: readonly EssenceContentEditorOption[]
}

export function CombatContentAuthoringWorkspace({
  skills,
  essences,
}: CombatContentAuthoringWorkspaceProps) {
  const [contentType, setContentType] = useState<'skills' | 'essences'>('skills')

  return (
    <div className={styles.authoringWorkspaceShell}>
      <label className={styles.contentTypeField}>
        <span>Content type</span>
        <select
          aria-label="Combat content type"
          value={contentType}
          onChange={(event) => setContentType(event.currentTarget.value as 'skills' | 'essences')}
        >
          <option value="skills">Skills</option>
          <option value="essences">Essences</option>
        </select>
      </label>

      {contentType === 'skills' ? (
        <CombatContentEditor skills={skills} initialSkillId={skills[0]?.id} />
      ) : (
        <EssenceContentEditor essences={essences} initialEssenceId={essences[0]?.id} />
      )}
    </div>
  )
}
