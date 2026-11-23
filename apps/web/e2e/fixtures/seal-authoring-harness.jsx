import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { SkillEffectEditor } from '@/components/master/combat-content/skill-effect-editor'
import { BattleCombatantEffects } from '@/components/battle/battle-combatant-effects'
import { CompactSkillEffectSummary } from '@/components/character/compact-skill-effect-summary'
import { validateCombatTagPayload } from '@aurevane/game-core/combat/combat-tag-registry'
import './production-styles'

function SealAuthoring() {
  const [effect, setEffect] = useState(
    () =>
      JSON.parse(sessionStorage.getItem('seal-draft') || 'null') ?? {
        type: 'apply-status',
        recipient: 'primary-unit',
        statusId: 'seal',
        stacks: 1,
        durationTurns: 2,
        sealedCategories: ['attack', 'recovery', 'utility'],
      },
  )
  const issues = validateCombatTagPayload(effect)
  return (
    <main style={{ padding: 16, maxWidth: 800, margin: 'auto' }}>
      <h1>Seal authoring</h1>
      <SkillEffectEditor value={effect} onChange={setEffect} />
      <section aria-label="Seal report">
        <CompactSkillEffectSummary effect={effect} />
      </section>
      <p role="status">{issues.length ? 'Choose at least one category.' : 'Valid Seal'}</p>
      <button
        disabled={issues.length > 0}
        onClick={() => sessionStorage.setItem('seal-draft', JSON.stringify(effect))}
      >
        Save Seal draft
      </button>
      <BattleCombatantEffects
        name="Target"
        compact
        statuses={[
          {
            ...effect,
            statusVersion: 1,
            remainingOwnerTurnStarts: effect.durationTurns,
            sourceCombatantId: 'actor',
          },
        ]}
      />
    </main>
  )
}
createRoot(document.getElementById('root')).render(<SealAuthoring />)
