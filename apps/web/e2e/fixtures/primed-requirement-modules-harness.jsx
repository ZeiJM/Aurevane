import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import baseline from '@baseline-cohort'
import correction from '@modularity-cohort'
import { captureCombatAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import {
  cancelCombatControlledAbility,
  combatAbilitySubject,
  primeCombatControlledAbility,
  reconcileCombatAbilitySources,
} from '@aurevane/game-core/combat/combat-behavior-runtime'
import { evaluateAbilityRequirements } from '@aurevane/game-core/combat/combat-requirements'
import { percentageDotEncounter } from '@aurevane/game-core/combat/combat-percentage-dots.test-utils'
import { preparePv1fTurnEconomy } from '@aurevane/game-core/combat/pv1f-action-economy'
import { reattachStatDrivenCombatBridge } from '@aurevane/game-core/combat/stat-driven-combat'
import { AbilityRequirementEditor } from '@/components/master/combat-content/ability-requirement-editor'
import { BattleCombatantEffects } from '@/components/battle/battle-combatant-effects'
import { projectBattleStatusStateForViewer } from '@/server/battle/battle-live-viewer-projection'
import {
  createSpectatorBattleViewerEntitlement,
  deriveParticipantBattleViewerEntitlement,
} from '@/server/battle/battle-viewer-entitlement'
import './production-styles'

const rewind = baseline.records.find((row) => row.id === 'chronist.rewind-step').after
const held = correction.records.find(
  (row) => row.id === 'resonance.aetherist-chronist.linked-sequence',
).after.ability.behaviors[0]
const bloodfed = correction.records.find(
  (row) => row.id === 'resonance.cinderweaver-ravager.linked-sequence',
).after.ability.behaviors[0]
const captured = captureCombatAbilitySource({
  schemaVersion: 1,
  sourceInstanceId: 'actor:browser-rewind',
  ownerCombatantId: 'actor',
  abilityId: rewind.id,
  contentVersion: rewind.contentVersion,
  sourceKind: 'discipline-skill',
  sourceDisciplineId: rewind.sourceDisciplineId,
  tags: rewind.tags,
  definition: rewind.ability,
})
function initialState() {
  const base = preparePv1fTurnEconomy(percentageDotEncounter())
  const state = {
    ...base,
    tactical: {
      ...base.tactical,
      battle: {
        ...base.tactical.battle,
        combatants: base.tactical.battle.combatants.map((unit) =>
          unit.id === 'actor' ? { ...unit, mp: 12 } : unit,
        ),
      },
    },
    effectTimingPolicy: {
      version: 8,
      tagAuthority: 'global',
      modes: { 'return-to-turn-start': 'controlled' },
    },
  }
  return reattachStatDrivenCombatBridge(
    reconcileCombatAbilitySources(state, [captured]),
    base.statBridge,
  )
}
function savedRequirement(key, fallback) {
  const saved = localStorage.getItem(key)
  return saved ? JSON.parse(saved) : structuredClone(fallback)
}
function Harness() {
  const [state, setState] = useState(initialState)
  const [heldSaved, setHeldSaved] = useState(() =>
    savedRequirement('held-formula-requirements', held.requirements),
  )
  const [heldDraft, setHeldDraft] = useState(() =>
    savedRequirement('held-formula-requirements', held.requirements),
  )
  const [bloodDraft, setBloodDraft] = useState(() => structuredClone(bloodfed.requirements))
  const [bloodSaved, setBloodSaved] = useState(() => structuredClone(bloodfed.requirements))
  const owner = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
    'actor',
  ])
  const opponent = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
    'enemy',
  ])
  const spectator = createSpectatorBattleViewerEntitlement()
  const projections = Object.fromEntries(
    Object.entries({ PvE: owner, PvP: owner, Opponent: opponent, Spectator: spectator }).map(
      ([mode, viewer]) => [
        mode,
        projectBattleStatusStateForViewer(state, viewer).find((row) => row.combatantId === 'actor')
          .statuses,
      ],
    ),
  )
  const eligible = evaluateAbilityRequirements(heldSaved, {
    owner: combatAbilitySubject(state, 'actor'),
  })
  const primed = projections.PvE.some((row) => row.statusId === 'primed')
  useEffect(() => {
    // Expose only the viewer projection and serialized authored requirements, never actor runtime.
    window.primedModules = {
      snapshot: () => ({ projections, heldSaved, bloodSaved, eligible, primed }),
    }
  }, [projections, heldSaved, bloodSaved, eligible, primed])
  function changePrime(cancel) {
    const transition = (cancel ? cancelCombatControlledAbility : primeCombatControlledAbility)({
      state,
      actorId: 'actor',
      sourceInstanceId: captured.sourceInstanceId,
      behaviorId: captured.definition.behaviors[0].id,
    })
    setState(transition.state)
  }
  return (
    <main
      style={{
        maxWidth: 1200,
        margin: 'auto',
        padding: 16,
        color: '#f0e8dc',
        background: '#0a202b',
      }}
    >
      <h1>Native Primed and Master requirements</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <button type="button" disabled={primed} onClick={() => changePrime(false)}>
          Prime Controlled skill
        </button>
        <button type="button" disabled={!primed} onClick={() => changePrime(true)}>
          Cancel prime
        </button>
        <output data-native-primed={String(primed)} data-held-eligible={String(eligible)}>
          Held Formula eligibility at 12 MP: {String(eligible)}
        </output>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
          margin: '16px 0',
        }}
      >
        {Object.entries(projections).map(([mode, statuses]) => (
          <section key={mode} aria-label={`${mode} shared rail`}>
            <h2>{mode}</h2>
            <BattleCombatantEffects name={`${mode} owner`} compact statuses={statuses} />
          </section>
        ))}
      </div>
      <section aria-label="Held Formula Master editor">
        <h2>Held Formula</h2>
        <AbilityRequirementEditor behavior={held} value={heldDraft} onChange={setHeldDraft} />
        <button
          type="button"
          onClick={() => {
            const encoded = JSON.stringify(heldDraft)
            localStorage.setItem('held-formula-requirements', encoded)
            setHeldSaved(JSON.parse(encoded))
          }}
        >
          Save Held Formula JSON
        </button>
        <pre data-saved-held="true" style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(heldSaved, null, 2)}
        </pre>
      </section>
      <section aria-label="Bloodfed Cinder Master editor">
        <h2>Bloodfed Cinder</h2>
        <AbilityRequirementEditor behavior={bloodfed} value={bloodDraft} onChange={setBloodDraft} />
        <button type="button" onClick={() => setBloodSaved(JSON.parse(JSON.stringify(bloodDraft)))}>
          Save Bloodfed Cinder JSON
        </button>
        <pre
          data-saved-bloodfed="true"
          style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
        >
          {JSON.stringify(bloodSaved, null, 2)}
        </pre>
      </section>
    </main>
  )
}
createRoot(document.getElementById('root')).render(<Harness />)
