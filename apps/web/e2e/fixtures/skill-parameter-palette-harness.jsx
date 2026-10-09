import React from 'react'
import { createRoot } from 'react-dom/client'
import { SkillParameters } from '@/components/character/skill-parameters'
import { SkillDetails } from '@/components/character/skill-details'
import { SkillEffectListEditor } from '@/components/master/combat-content/skill-effect-list-editor'
import { SkillCharacteristicRows } from '@/components/character/skill-characteristic-rows'
import { basicActionCharacteristicRows } from '@/components/character/basic-action-presentation'
import { CompactSkillEffectSummary } from '@/components/character/compact-skill-effect-summary'
import { ResonanceParameters } from '@/components/character/resonance-parameters'
import { CharacterArsenalShell } from '@/components/character/character-arsenal-shell'
import { BattleSkillParameters } from '@/components/battle/battle-skill-parameters'
import { BattleInfoPopover } from '@/components/battle/battle-info-popover'
import { SummonAbilityList } from '@/components/battle/summon-ability-list'
import { SkillEffectTimingProvider } from '@/components/character/skill-effect-timing-context'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { resolveResonanceForPair } from '@aurevane/game-core/combat/resonance'
import { resolveEssenceForBuild } from '@aurevane/game-core/combat/essence'
import { buildPrimaryDisciplinePreview } from '@aurevane/game-core/character/discipline-build'
import { DISCIPLINE_ATLAS } from '@aurevane/game-core/character/discipline-atlas'
import './production-styles'

const query = new URLSearchParams(location.search)
const physical = resolveMatureSkillVersion('vanguard.forceful-strike')
const mystic = resolveMatureSkillVersion('runeblade.aether-cut')
const ground = resolveMatureSkillVersion('frostweaver.chilling-mist')
const guard = resolveMatureSkillVersion('edgedancer.poised-guard')
const healingDown = resolveMatureSkillVersion('runeblade.sigil-brand')
const blindside = resolveEssenceForBuild('shadehand', null).skill
const resonance = resolveResonanceForPair('wildwarden', 'edgedancer')
const essence = resolveEssenceForBuild('vanguard', null)
const battleSkill = (definition) => ({
  definition,
  id: definition.id,
  name: definition.id,
  apCost: definition.apCost,
  mpCost: definition.mpCost ?? 0,
  targetKind: definition.target.kind,
  targetTeamPolicy: definition.target.teamPolicy,
  minimumRange: definition.target.minimumRange,
  maximumRange: definition.target.maximumRange,
  tags: definition.tags,
  effectDescriptions: [],
  requirementDescriptions: [],
})
window.paletteDefinitions = { physical, mystic, guard, resonance, essence }
window.requests = []
window.fetch = async (url) => {
  window.requests.push(String(url))
  return new Response(JSON.stringify({ slots: [], entries: [], preferences: {} }))
}

const sectionStyle = { background: '#0a202b', color: '#f0e8dc', padding: 12, marginBottom: 12 }
function BlindsideAuthoring() {
  const [effects, setEffects] = React.useState([
    {
      type: 'apply-status',
      recipient: 'actor',
      statusId: 'guarded',
      stacks: 1,
      durationTurns: 2,
      potencyBasisPoints: 1400,
    },
  ])
  return (
    <section aria-label="Master Blindside authoring" style={sectionStyle}>
      <SkillEffectListEditor
        value={effects}
        onChange={(next) => {
          window.blindsideAuthoringEffects = next
          setEffects(next)
        }}
      />
    </section>
  )
}
function Reports() {
  return (
    <main style={{ padding: 16, maxWidth: 780 }}>
      <BlindsideAuthoring />
      {[
        ['physical', physical],
        ['mystic', mystic],
        ['ground', ground],
        ['healing-down', healingDown],
        ['blindside', blindside],
      ].map(([family, skill]) => (
        <React.Fragment key={family}>
          <section aria-label={`Nexus ${family} parameters`} style={sectionStyle}>
            <dl>
              <SkillParameters skill={skill} />
            </dl>
          </section>
          <section aria-label={`Master ${family} details`} style={sectionStyle}>
            <SkillDetails skill={skill} expanded />
          </section>
          <section aria-label={`Battle ${family} parameters`} style={sectionStyle}>
            <BattleSkillParameters skill={battleSkill(skill)} />
          </section>
        </React.Fragment>
      ))}
      <section aria-label="Basic Attack parameters" style={sectionStyle}>
        <dl>
          <SkillCharacteristicRows
            rows={basicActionCharacteristicRows('basic.attack.unarmed.basic')}
          />
        </dl>
      </section>
      <section aria-label="Discipline effect reference" style={sectionStyle}>
        {guard.effects.map((effect, index) => (
          <CompactSkillEffectSummary key={index} effect={effect} />
        ))}
      </section>
      <section aria-label="Inline Resonance parameters">
        <ResonanceParameters definition={resonance} />
      </section>
      <BattleInfoPopover label="Read pinned Resonance" title={resonance.name}>
        <ResonanceParameters definition={resonance} />
      </BattleInfoPopover>
      <BattleInfoPopover label="Read pinned Mystic Skill" title="Aether Cut">
        <dl>
          <SkillParameters skill={mystic} />
        </dl>
      </BattleInfoPopover>
    </main>
  )
}
function Nexus() {
  const pure = query.get('attunement') === 'essence'
  const primaryId = pure ? 'vanguard' : 'wildwarden'
  const primary = {
    ...DISCIPLINE_ATLAS.find((entry) => entry.id === primaryId),
    definitionVersion: 1,
    enabledForPrimary: true,
    enabledForSecondary: true,
  }
  const secondary = pure ? null : DISCIPLINE_ATLAS.find((entry) => entry.id === 'edgedancer')
  const attributes = { might: 6, finesse: 6, vitality: 6, agility: 6, intellect: 6, resolve: 6 }
  const current = buildPrimaryDisciplinePreview({
    attributes,
    level: 1,
    primaryDefinition: primary,
    primaryProfile: { disciplineId: primaryId, profileVersion: 1, statOffsets: {} },
  })
  const profile = {
    characterId: 'palette-character',
    attributes,
    identity: { name: 'Wayfarer' },
    progression: { level: 1 },
  }
  const disciplineBuild = {
    buildVersion: 1,
    current,
    currentSecondary: secondary,
    availablePrimaries: [],
    availableSecondaries: [],
    attunement: {
      policy: { version: 1, primaryCooldownSeconds: 0, secondaryCooldownSeconds: 0 },
      serverNow: '2026-10-05T00:00:00Z',
      primaryLockedUntil: null,
      secondaryLockedUntil: null,
      primaryRemainingSeconds: 0,
      secondaryRemainingSeconds: 0,
    },
    disciplineSkills: {
      capacity: 4,
      learnedSkills: [],
      equippedSkills: [],
      extensions: { resonance: pure ? null : resonance, essence: pure ? essence : null },
    },
  }
  return (
    <CharacterArsenalShell
      profile={profile}
      attributeAllocation={{ characterId: profile.characterId }}
      disciplineBuild={disciplineBuild}
    />
  )
}
function ElementalReaders() {
  const definition = {
    ...resolveMatureSkillVersion('tidecaller.water-lance'),
    name: 'Overlap Water',
    effects: [
      {
        type: 'damage',
        recipient: 'affected-units',
        amount: 10,
        element: 'water',
        durationTurns: 0,
      },
      {
        type: 'apply-status',
        recipient: 'primary-unit',
        statusId: 'wet',
        stacks: 1,
        durationTurns: 3,
        potencyBasisPoints: 3500,
      },
    ],
    effectDescriptions: ['Pinned Water explanation.'],
  }
  const ability = {
    ...resolveMatureSkillVersion('wildwarden.renewing-herbs').summonProfile.abilities[0],
    name: 'Captured Water',
    effects: [
      {
        type: 'damage',
        recipient: 'primary-unit',
        amount: 10,
        element: 'water',
        durationTurns: 3,
        potencyBasisPoints: 3500,
      },
      {
        type: 'apply-status',
        recipient: 'primary-unit',
        statusId: 'wet',
        stacks: 1,
        durationTurns: 3,
        potencyBasisPoints: 3500,
      },
    ],
  }
  const [effects, setEffects] = React.useState(definition.effects)
  const capturedDefinition = { ...definition, effects }
  const capturedAbility = { ...ability, effects: [ability.effects[0], effects[1]] }
  const mode = query.get('wet') || 'instant'
  const historical = query.get('historical') === 'true'
  const elementalPolicy = historical ? null : query.get('elemental') === '1' ? 1 : 2
  const policies = {
    effectTimingPolicy: { version: 7, modes: mode === 'unset' ? {} : { wet: mode } },
    ...(historical ? {} : { elementalDamagePolicyVersion: elementalPolicy }),
  }
  return (
    <main style={{ padding: 16, maxWidth: 780 }}>
      <section aria-label="Master elemental authoring" style={sectionStyle}>
        <SkillEffectListEditor value={effects} onChange={setEffects} />
      </section>
      <section aria-label="Master elemental details" style={sectionStyle}>
        <SkillEffectTimingProvider
          policy={policies.effectTimingPolicy}
          elementalDamagePolicyVersion={elementalPolicy}
        >
          <SkillDetails skill={capturedDefinition} expanded />
        </SkillEffectTimingProvider>
      </section>
      <section aria-label="Battle overlap reader" style={sectionStyle}>
        <SkillEffectTimingProvider
          policy={policies.effectTimingPolicy}
          elementalDamagePolicyVersion={elementalPolicy}
        >
          <BattleInfoPopover label="About Overlap Water" title="Overlap Water" trigger="!">
            <BattleSkillParameters skill={battleSkill(capturedDefinition)} />
          </BattleInfoPopover>
        </SkillEffectTimingProvider>
      </section>
      <section aria-label="Captured summon abilities" style={sectionStyle}>
        <SummonAbilityList abilities={[capturedAbility]} policies={policies} />
      </section>
    </main>
  )
}
function FireReaders() {
  const base = resolveMatureSkillVersion(
    query.get('fire') === 'ground' ? 'cinderweaver.flame-burst' : 'cinderweaver.cinder-bolt',
  )
  const [effects, setEffects] = React.useState([
    base.effects.find((effect) => effect.type === 'damage'),
  ])
  React.useEffect(() => {
    window.fireAuthoringEffects = effects
  }, [effects])
  const definition = { ...base, effects, effectDescriptions: [] }
  return (
    <main style={{ padding: 16, maxWidth: 780 }}>
      <section aria-label="Master Fire authoring" style={sectionStyle}>
        <SkillEffectListEditor value={effects} onChange={setEffects} />
      </section>
      <SkillEffectTimingProvider
        policy={{ version: 7, modes: { 'remove-status': 'instant' } }}
        elementalDamagePolicyVersion={2}
      >
        <section aria-label="Master Fire details" style={sectionStyle}>
          <SkillDetails skill={definition} expanded />
        </section>
        <section aria-label="Nexus Fire parameters" style={sectionStyle}>
          <dl>
            <SkillParameters skill={definition} />
          </dl>
        </section>
        <BattleInfoPopover label="About Fire report" title="Fire report" trigger="!">
          <BattleSkillParameters skill={battleSkill(definition)} />
        </BattleInfoPopover>
      </SkillEffectTimingProvider>
    </main>
  )
}
createRoot(document.getElementById('root')).render(
  query.get('surface') === 'nexus' ? (
    <Nexus />
  ) : query.get('surface') === 'fire-readers' ? (
    <FireReaders />
  ) : query.get('surface') === 'elemental-readers' ? (
    <ElementalReaders />
  ) : (
    <Reports />
  ),
)
