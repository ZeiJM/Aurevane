import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { SkillEffectEditor } from '@/components/master/combat-content/skill-effect-editor'
import { BattleSkillParameters } from '@/components/battle/battle-skill-parameters'
import styles from '@/components/master/combat-content/combat-content-editor.module.css'
import { SkillDetails } from '@/components/character/skill-details'
import { BattleInfoPopover } from '@/components/battle/battle-info-popover'
import { SkillEffectTimingProvider } from '@/components/character/skill-effect-timing-context'
import {
  resolveMatureSkillVersion,
  validateMatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import './production-styles'

const original = resolveMatureSkillVersion('vanguard.forceful-strike')

function Authoring() {
  const [effect, setEffect] = useState({
    type: 'apply-status',
    recipient: 'primary-unit',
    statusId: 'suppress',
    stacks: 1,
  })
  const skill = useMemo(
    () => ({
      ...original,
      name: 'Authored Suppress',
      effects: [effect],
      effectDescriptions: undefined,
    }),
    [effect],
  )
  useEffect(() => {
    window.suppressAuthoredEffect = effect
    window.suppressValidation = validateMatureSkillDefinition(skill)
  }, [effect, skill])
  return (
    <main style={{ padding: 16, maxWidth: 800, margin: 'auto' }}>
      <h1>Suppress authoring fixture</h1>
      <section className={styles.editorMain}>
        <SkillEffectEditor value={effect} onChange={setEffect} />
        <SkillEffectTimingProvider policy={{ version: 7, modes: {} }}>
          <section className={styles.tags} aria-label="Ten characteristics">
            <SkillDetails skill={skill} expanded />
          </section>
          <BattleInfoPopover
            label="Read authored Suppress"
            trigger="!"
            title="Authored Suppress"
            hover
          >
            <BattleSkillParameters
              skill={{
                ...skill,
                definition: skill,
                cooldownOwnerTurns: skill.cooldown?.ownerTurns ?? 0,
                requirementDescriptions: [],
              }}
            />
          </BattleInfoPopover>
        </SkillEffectTimingProvider>
      </section>
    </main>
  )
}
createRoot(document.getElementById('root')).render(<Authoring />)
