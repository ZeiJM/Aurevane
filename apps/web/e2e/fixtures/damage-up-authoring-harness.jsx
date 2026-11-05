import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { SkillEffectEditor } from '@/components/master/combat-content/skill-effect-editor'
import { AbilityEffectEditor } from '@/components/master/combat-content/ability-effect-editor'
import { CompactSkillEffectSummary } from '@/components/character/compact-skill-effect-summary'
import { abilityBehaviorInformation } from '@/components/character/ability-detail-presentation'
import { validateCombatTagPayload } from '@aurevane/game-core/combat/combat-tag-registry'
import { executeCombatAction } from '@aurevane/game-core/combat/actions'
import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-combat-content'
import { percentageDotEncounter } from '@aurevane/game-core/combat/combat-percentage-dots.test-utils'
import { source } from '@aurevane/game-core/combat/combat-behavior.test-utils'
import {
  reconcileCombatAbilitySources,
  materializeCombatAbilityAction,
} from '@aurevane/game-core/combat/combat-behavior-runtime'
import './production-styles'
const packets = [
  { element: 'fire' },
  { element: 'water' },
  { element: 'ice' },
  { element: 'storm' },
  {},
  { piercing: true },
]
function DamageUpAuthoring() {
  const [draft, setDraft] = useState(
    () =>
      JSON.parse(sessionStorage.getItem('damage-up-draft') || 'null') ?? {
        mode: 'timed',
        timed: {
          type: 'apply-status',
          recipient: 'actor',
          statusId: 'inspired',
          stacks: 1,
          durationTurns: 3,
          potencyBasisPoints: 2000,
        },
        modifier: { type: 'damage-bonus', recipient: 'actor', multiplierBasisPoints: 12000 },
      },
  )
  const [amounts, setAmounts] = useState([])
  const effect = draft[draft.mode]
  const issues = validateCombatTagPayload(effect)
  const behavior = {
    id: 'bonus',
    activation: 'ongoing',
    mode: 'modifier',
    classification: 'attack',
    targeting: null,
    costs: [],
    cooldown: null,
    requirements: null,
    effects: [{ id: 'bonus', payload: draft.modifier }],
  }
  function resolveHit() {
    const root = source({ costs: [] })
    const action = {
      ...materializeCombatAbilityAction(root, root.definition.behaviors[0]),
      effectTimingModes: undefined,
      effectOrigins: undefined,
      effects: [
        ...(draft.mode === 'timed' ? [effect] : []),
        ...packets.map((packet) => ({
          type: 'damage',
          recipient: 'primary-unit',
          amount: 10,
          ...packet,
        })),
      ],
    }
    const state =
      draft.mode === 'modifier'
        ? reconcileCombatAbilitySources(percentageDotEncounter(), [
            source(behavior, 'scoped-bonus'),
          ])
        : percentageDotEncounter()
    const out = executeCombatAction(
      state,
      action,
      { kind: 'unit', combatantId: 'enemy' },
      PV1F_COMBAT_CONTENT,
    )
    setAmounts(
      out.events.filter((event) => event.event === 'damage_applied').map((event) => event.amount),
    )
  }
  return (
    <main style={{ padding: 16, maxWidth: 800, margin: 'auto' }}>
      <h1>Damage Up authoring</h1>
      <label>
        Damage Up form
        <select
          aria-label="Damage Up form"
          value={draft.mode}
          onChange={(event) => setDraft({ ...draft, mode: event.currentTarget.value })}
        >
          <option value="timed">Timed buff</option>
          <option value="modifier">Modifier</option>
        </select>
      </label>
      {draft.mode === 'timed' ? (
        <SkillEffectEditor value={effect} onChange={(timed) => setDraft({ ...draft, timed })} />
      ) : (
        <AbilityEffectEditor
          value={{ id: 'bonus', payload: effect }}
          behavior={behavior}
          onChange={(next) => setDraft({ ...draft, modifier: next.payload })}
        />
      )}
      <section aria-label="Damage Up report">
        {draft.mode === 'timed' ? (
          <CompactSkillEffectSummary effect={effect} />
        ) : (
          abilityBehaviorInformation(behavior).effectDescriptions.map((text, index) => (
            <p key={index}>{text}</p>
          ))
        )}
      </section>
      <p role="status">{issues.length ? 'Choose at least one damage type.' : 'Valid Damage Up'}</p>
      <button
        disabled={issues.length > 0}
        onClick={() => sessionStorage.setItem('damage-up-draft', JSON.stringify(draft))}
      >
        Save Damage Up draft
      </button>
      <button disabled={issues.length > 0} onClick={resolveHit}>
        Resolve battle hit
      </button>
      <output aria-label="Resolved damage">{amounts.join(',')}</output>
    </main>
  )
}
createRoot(document.getElementById('root')).render(<DamageUpAuthoring />)
