import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import baseline from '@baseline-cohort'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import {
  parseAbilityDefinition,
  validateAbilityDefinition,
} from '@aurevane/game-core/combat/combat-definition'
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
import { projectPublicCombat } from '@aurevane/game-core/combat/public-combat-presentation'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { resolveResonanceForPair } from '@aurevane/game-core/combat/resonance'
import { AbilityDefinitionEditor } from '@/components/master/combat-content/ability-definition-editor'
import { SkillParameters } from '@/components/character/skill-parameters'
import { BattleSkillParameters } from '@/components/battle/battle-skill-parameters'
import { ResonanceParameters } from '@/components/character/resonance-parameters'
import './production-styles'

const storageKey = 'simple-requirements-native-definition'
const rewind = baseline.records.find((row) => row.id === 'chronist.rewind-step').after
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
        combatants: base.tactical.battle.combatants.map((unit) => ({
          ...unit,
          hp: unit.id === 'actor' ? 500 : 250,
          mp: unit.id === 'actor' ? 10 : 5,
        })),
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
function initialDefinition() {
  const saved = localStorage.getItem(storageKey)
  return saved
    ? parseAbilityDefinition(JSON.parse(saved))
    : parseAbilityDefinition({
        schemaVersion: 1,
        behaviors: [
          {
            ...defaultBasicSkills().find((row) => row.id === 'unarmed.basic').ability.behaviors[0],
            id: 'simple-browser',
            requirementMode: 'simple',
            requirements: null,
            effects: [
              {
                id: 'hit',
                payload: { type: 'healing', recipient: 'primary-unit', amount: 1, ticks: 1 },
              },
            ],
          },
        ],
      })
}
function Harness() {
  const [state, setState] = useState(initialState)
  const [draft, setDraft] = useState(initialDefinition)
  const [saved, setSaved] = useState(initialDefinition)
  const subjects = useMemo(
    () => ({
      owner: combatAbilitySubject(state, 'actor'),
      selected: combatAbilitySubject(state, 'enemy'),
    }),
    [state],
  )
  const requirement = saved.behaviors[0].requirements
  const eligible = evaluateAbilityRequirements(requirement, {
    ...subjects,
    affected: subjects.selected,
    triggering: subjects.selected,
  })
  const primed = subjects.owner.primeAbilityIds.length > 0
  useEffect(() => {
    window.simpleRequirements = {
      snapshot: () => ({
        draft,
        saved,
        eligible,
        primed,
        subjects,
        validationIssues: validateAbilityDefinition(draft),
      }),
    }
  }, [draft, saved, eligible, primed, subjects])
  const skill = projectPublicCombat({
    ...resolveMatureSkillVersion('vanguard.forceful-strike'),
    ability: saved,
  })
  const resonance = projectPublicCombat({
    ...resolveResonanceForPair('wildwarden', 'edgedancer'),
    ability: saved,
  })
  const battleSkill = {
    definition: skill,
    id: skill.id,
    name: skill.name,
    apCost: skill.apCost,
    mpCost: skill.mpCost ?? 0,
    targetKind: skill.target.kind,
    targetTeamPolicy: skill.target.teamPolicy,
    minimumRange: skill.target.minimumRange,
    maximumRange: skill.target.maximumRange,
    tags: skill.tags,
    effectDescriptions: [],
    requirementDescriptions: [],
  }
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
        maxWidth: 1120,
        margin: 'auto',
        padding: 16,
        background: '#0a202b',
        color: '#f0e8dc',
      }}
    >
      <h1>Native simple Requirements</h1>
      <p>Self has 50% HP and MP. Target has 25% HP and MP.</p>
      <button type="button" disabled={primed} onClick={() => changePrime(false)}>
        Prime Controlled skill
      </button>
      <button type="button" disabled={!primed} onClick={() => changePrime(true)}>
        Cancel prime
      </button>
      <output data-native-eligible={String(eligible)} data-native-primed={String(primed)}>
        Native saved requirement eligibility: {String(eligible)}
      </output>
      <section aria-label="Master simple authoring">
        <AbilityDefinitionEditor
          value={draft}
          allowEffectDescriptions={false}
          onChange={setDraft}
        />
        <button
          type="button"
          onClick={() => {
            const encoded = JSON.stringify(parseAbilityDefinition(draft))
            localStorage.setItem(storageKey, encoded)
            setSaved(JSON.parse(encoded))
          }}
        >
          Save definition JSON
        </button>
        <pre
          data-saved-definition="true"
          style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
        >
          {JSON.stringify(saved, null, 2)}
        </pre>
      </section>
      <section aria-label="Nexus saved reader">
        <SkillParameters skill={skill} />
      </section>
      <section aria-label="Battle saved reader">
        <BattleSkillParameters skill={battleSkill} />
      </section>
      <section aria-label="Resonance saved reader">
        <ResonanceParameters definition={resonance} />
      </section>
    </main>
  )
}
createRoot(document.getElementById('root')).render(<Harness />)
