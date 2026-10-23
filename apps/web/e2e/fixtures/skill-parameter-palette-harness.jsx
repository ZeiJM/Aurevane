import React from 'react'
import {
  defaultBasicSkills,
  validateBasicSkillDefinition,
} from '@aurevane/game-core/combat/combat-basic-actions'
import {
  parseAbilityDefinition,
  applyAbilityTimingDefaults,
} from '@aurevane/game-core/combat/combat-definition'
import { projectPublicCombat } from '@aurevane/game-core/combat/public-combat-presentation'
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
import { ManualArticle } from '@/components/public-information/manual-article'
import { createTechniquesManualArticle } from '@/content/techniques-manual'
import { defaultCombatEffectTimingPolicy } from '@aurevane/game-core/combat/combat-effect-timing'
import { ContentDefinitionFields } from '@/components/master/combat-content/content-definition-fields'
import { ContentNativeSample } from '@/components/master/combat-content/content-native-sample'
import { CombatContentAuthoringWorkspace } from '@/components/master/combat-content/combat-content-authoring-workspace'
import { AbilityDefinitionEditor } from '@/components/master/combat-content/ability-definition-editor'
import masterTheme from '@/components/master/master-panel-shell.module.css'
import './production-styles'

const query = new URLSearchParams(location.search)
const nativeFetch = window.fetch.bind(window)
const basicService = query.get('basicService') === '1'
const previewTimingPolicy = {
  version: 8,
  tagAuthority: 'global',
  modes: query.get('timing') === 'controlled' ? { healing: 'controlled' } : {},
}
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
const modularBase = defaultBasicSkills().find((row) => row.id === 'unarmed.basic').ability
  .behaviors[0]
const modularAbility = parseAbilityDefinition({
  schemaVersion: 1,
  behaviors: [
    {
      ...modularBase,
      id: 'leap',
      accuracy: { kind: 'fixed', chanceBasisPoints: 7777 },
      costs: [
        { resource: 'ap', amount: 11 },
        { resource: 'mp', amount: 2 },
        { resource: 'hp', amount: 1 },
      ],
      cooldown: { key: 'leap', ownerTurns: 3 },
      requirements: {
        kind: 'resource-state',
        subject: 'owner',
        resource: 'mp',
        comparison: 'at-least',
        amount: 3,
      },
      activationLimits: ['once-per-battle'],
      targeting: { ...modularBase.targeting, maximumRange: 4, maximumSelections: 2 },
      effects: [
        { id: 'walk', payload: { type: 'move', recipient: 'actor', maximumTiles: 2 } },
        {
          id: 'hit',
          timing: 'controlled',
          payload: { type: 'damage', recipient: 'primary-unit', amount: 13 },
        },
      ],
    },
    {
      ...modularBase,
      id: 'maintain',
      activation: 'ongoing',
      mode: 'modifier',
      classification: 'utility',
      attackFamily: undefined,
      costs: [],
      cooldown: null,
      targeting: null,
      requirements: {
        kind: 'status-presence',
        subject: 'owner',
        statusId: 'guarded',
        present: true,
      },
      effects: [
        {
          id: 'bonus',
          payload: { type: 'damage-bonus', recipient: 'actor', multiplierBasisPoints: 11250 },
        },
      ],
    },
  ],
})
const modularSkillFor = (definition) =>
  projectPublicCombat({
    ...definition,
    ability: modularAbility,
    apCost: 71,
    effectDescriptions: ['Wrong legacy explanation'],
    tags: ['recovery'],
  })
const modularSkill = modularSkillFor(physical)
const modularResonance = projectPublicCombat({ ...resonance, ability: modularAbility })
const modularEssence = projectPublicCombat({ ...essence, ability: modularAbility })
window.modularPublicDefinition = modularSkill
window.paletteDefinitions = { physical, mystic, guard, resonance, essence }
window.requests = []
window.fetch = async (url) => {
  window.requests.push(String(url))
  return new Response(JSON.stringify({ slots: [], entries: [], preferences: {} }))
}

const basicOptions = basicService
  ? await (await nativeFetch('/__basic-acceptance/options')).json()
  : defaultBasicSkills().map((definition) => ({
      contentKey: definition.id,
      contentKind: 'skill',
      lifecycle: 'active',
      revision: 1,
      versionFloor: 1,
      createdBy: null,
      createdAt: null,
      builtin: { contentVersion: 1, name: definition.name },
      builtinDefinition: definition,
      current: null,
      history: [],
      links: [],
      usedBy: [],
      draft:
        definition.id === 'basic.guard'
          ? {
              definition: { ...definition, name: 'Saved Guard draft' },
              draftVersion: 4,
              baseVersion: 1,
              updatedBy: 'fixture-author',
              updatedAt: '2026-10-23T00:00:00Z',
              restoredFrom: null,
              restoredBy: null,
            }
          : null,
    }))
const fixtureRecords = new Map(basicOptions.map((row) => [row.contentKey, structuredClone(row)]))
const basicPage = {
  records: basicOptions.map((row) => ({
    contentKey: row.contentKey,
    contentKind: row.contentKind,
    lifecycle: row.lifecycle,
    revision: row.revision,
    name: row.draft?.definition.name ?? row.current?.definition.name ?? row.builtin.name,
  })),
  nextCursor: null,
}
if (basicService) window.fetch = nativeFetch
if (query.get('surface') === 'basic-editor' && !basicService) {
  const draftSequences = new Map(
    basicOptions.map((row) => [row.contentKey, row.draft?.draftVersion ?? 0]),
  )
  window.basicPublishedDefinitions = {}
  window.basicPublishedVersions = []
  window.basicDraftRequests = []
  window.basicSavedDrafts = {}
  window.fetch = async (url, options) => {
    if (String(url) !== '/api/master/combat-content')
      throw new Error('Unexpected Basic fixture request')
    const body = JSON.parse(options.body)
    window.basicDraftRequests.push(structuredClone(body))
    if (body.operation === 'diff')
      return Response.json({
        diff: {
          changedPaths:
            JSON.stringify(body.before) === JSON.stringify(body.after) ? [] : ['ability', 'name'],
        },
      })
    if (body.operation === 'record') {
      const command = body.command
      if (command.action === 'list')
        return Response.json({
          records: [...fixtureRecords.values()].map((row) => ({
            contentKey: row.contentKey,
            contentKind: row.contentKind,
            lifecycle: row.lifecycle,
            revision: row.revision,
            name: row.draft?.definition.name ?? row.current?.definition.name ?? row.builtin.name,
          })),
          nextCursor: null,
        })
      const stored = fixtureRecords.get(command.contentKey)
      if (!stored) throw new Error('Unknown fixture record')
      if (command.action === 'read') return Response.json({ record: stored })
      const record = structuredClone(stored)
      const conflict = () =>
        Response.json(
          {
            error: {
              code: 'STALE_VERSION',
              message: 'Combat content changed. Refresh the authoritative version and retry.',
            },
          },
          { status: 409 },
        )
      if (command.action === 'save') {
        if (command.expectedRevision !== record.revision) return conflict()
        if (window.holdBasicSave)
          await new Promise((resolve) => {
            window.releaseBasicSave = resolve
          })
        const draftVersion = draftSequences.get(record.contentKey) + 1
        draftSequences.set(record.contentKey, draftVersion)
        record.draft = {
          definition: structuredClone(command.definition),
          draftVersion,
          baseVersion: record.current?.contentVersion ?? record.builtin.contentVersion,
          updatedBy: 'fixture-author',
          updatedAt: new Date().toISOString(),
          restoredFrom: null,
          restoredBy: null,
        }
        window.basicSavedDrafts[record.contentKey] = structuredClone(command.definition)
      } else if (command.action === 'publish') {
        if (
          window.rejectBasicPublish ||
          command.expectedDraftVersion !== record.draft?.draftVersion ||
          command.expectedBaseVersion !== record.draft?.baseVersion ||
          command.expectedBaseVersion !==
            (record.current?.contentVersion ?? record.builtin.contentVersion)
        )
          return conflict()
        if (validateBasicSkillDefinition(record.draft.definition).length)
          return Response.json(
            { error: { code: 'INVALID_REQUEST', message: 'Invalid Basic definition.' } },
            { status: 400 },
          )
        if (window.holdBasicPublish)
          await new Promise((resolve) => {
            window.releaseBasicPublish = resolve
          })
        const contentVersion = (record.current?.contentVersion ?? record.builtin.contentVersion) + 1
        const definition = { ...structuredClone(record.draft.definition), contentVersion }
        record.current = {
          definition,
          contentVersion,
          authoredBy: record.draft.updatedBy,
          authoredAt: record.draft.updatedAt,
          publishedBy: 'fixture-author',
          publishedAt: new Date().toISOString(),
          restoredFrom: record.draft.restoredFrom,
          restoredBy: record.draft.restoredBy,
        }
        record.history.push(record.current)
        record.draft = null
        window.basicPublishedDefinitions[record.contentKey] = definition
        window.basicPublishedVersions.push({ id: record.contentKey, contentVersion })
      } else if (command.action === 'restore') {
        if (command.expectedRevision !== record.revision) return conflict()
        const version = record.history.find((row) => row.contentVersion === command.sourceVersion)
        if (!version)
          return Response.json(
            { error: { message: 'That recorded publication is unavailable.' } },
            { status: 400 },
          )
        const draftVersion = draftSequences.get(record.contentKey) + 1
        draftSequences.set(record.contentKey, draftVersion)
        record.draft = {
          definition: structuredClone(version.definition),
          draftVersion,
          baseVersion: record.current.contentVersion,
          updatedBy: 'fixture-author',
          updatedAt: new Date().toISOString(),
          restoredFrom: version.contentVersion,
          restoredBy: 'fixture-author',
        }
      } else throw new Error('Unexpected complete-record mutation')
      record.revision++
      fixtureRecords.set(record.contentKey, record)
      return Response.json({ record })
    }
    const issues = validateBasicSkillDefinition(body.definition)
    if (body.operation === 'preview') {
      const group = body.definition.ability.behaviors.find(
        (row) => row.id === body.behaviorId && row.activation === 'manual' && row.mode === 'action',
      )
      if (!group)
        return Response.json({ error: { message: 'Unsupported preview group.' } }, { status: 400 })
      return Response.json({
        preview: {
          behaviorId: group.id,
          legal: issues.length === 0 && body.definition.enabled,
          costs: {
            actionEconomy: group.costs.find((row) => row.resource === 'ap')?.amount ?? 0,
            mp: group.costs.find((row) => row.resource === 'mp')?.amount ?? 0,
            hp: group.costs.find((row) => row.resource === 'hp')?.amount ?? 0,
          },
          ...(group.effects.some((row) => row.payload.type === 'move')
            ? {
                movement: {
                  path: [
                    { x: 2, y: 1 },
                    { x: 3, y: 1 },
                  ],
                },
              }
            : {}),
          projections: { effects: group.effects.map((row) => ({ effectType: row.payload.type })) },
        },
      })
    }
    if (body.operation === 'validate')
      return Response.json({
        validation: { valid: issues.length === 0, issues, derivedTags: body.definition.tags },
      })
    throw new Error('Unexpected Basic fixture operation')
  }
}
// The API responses below are fixture receipts. Real service/kernel evaluation is
// covered separately by combat-content-authoring-service.test.ts.
const previewGuard = defaultBasicSkills().find((row) => row.id === 'basic.guard').ability
  .behaviors[0]
const selectableAbility = parseAbilityDefinition({
  schemaVersion: 1,
  behaviors: [
    {
      ...previewGuard,
      id: 'brace',
      costs: [{ resource: 'ap', amount: 5 }],
      effects: [{ id: 'ward', payload: { type: 'barrier-change', recipient: 'actor', amount: 1 } }],
    },
    {
      ...previewGuard,
      id: 'recover',
      classification: 'recovery',
      costs: [
        { resource: 'ap', amount: 13 },
        { resource: 'mp', amount: 3 },
      ],
      effects: [{ id: 'mend', payload: { type: 'healing', recipient: 'actor', amount: 17 } }],
    },
  ],
})
if (query.get('surface') === 'selected-preview') {
  window.groupPreviewRequests = []
  window.fetch = async (url, options) => {
    if (String(url) !== '/api/master/combat-content')
      throw new Error('Unexpected preview fixture request')
    const body = JSON.parse(options.body)
    window.groupPreviewRequests.push(structuredClone(body))
    if (body.operation === 'validate')
      return Response.json({ validation: { valid: true, issues: [], derivedTags: [] } })
    if (body.operation === 'diff')
      return Response.json({ diff: { changedPaths: ['ability.behaviors'] } })
    if (body.operation !== 'preview') throw new Error('Unexpected preview fixture operation')
    const selected = body.definition.ability.behaviors.find((row) => row.id === body.behaviorId)
    const group = selected ? applyAbilityTimingDefaults(selected, previewTimingPolicy) : undefined
    if (!group)
      return Response.json(
        { error: { message: 'Select a supported Manual action group.' } },
        { status: 400 },
      )
    if (window.holdGroupPreview)
      await new Promise((resolve) => {
        window.releaseGroupPreview = resolve
      })
    return Response.json({
      preview: {
        behaviorId: group.id,
        legal: true,
        ...(group.effects.some((effect) => effect.timing === 'controlled')
          ? { simulation: { preparation: 'free-controlled-prime' } }
          : {}),
        costs: {
          actionEconomy: group.costs.find((row) => row.resource === 'ap')?.amount ?? 0,
          mp: group.costs.find((row) => row.resource === 'mp')?.amount ?? 0,
        },
        projections: {
          effects: group.effects.map((effect) => ({ effectType: effect.payload.type })),
        },
      },
    })
  }
}
function SelectedPreviewEditor() {
  const isEssence = query.get('kind') === 'essence'
  const [definition, setDefinition] = React.useState(() =>
    isEssence
      ? { ...essence, skill: { ...essence.skill, ability: selectableAbility } }
      : { ...physical, ability: selectableAbility },
  )
  return (
    <main
      className={`av-master ${masterTheme.workspace}`}
      style={{ display: 'block', height: 'auto', padding: 12 }}
    >
      <SkillEffectTimingProvider policy={previewTimingPolicy}>
        <ContentDefinitionFields
          kind={isEssence ? 'essence' : 'skill'}
          value={definition}
          onChange={setDefinition}
          choices={[]}
          tab="Parameters"
        />
        <ContentNativeSample kind={isEssence ? 'essence' : 'skill'} definition={definition} />
      </SkillEffectTimingProvider>
    </main>
  )
}

function BasicEditor() {
  return (
    <main
      className={`av-master ${masterTheme.workspace}`}
      style={{ display: 'block', height: 'auto', padding: 12 }}
    >
      <SkillEffectTimingProvider policy={defaultCombatEffectTimingPolicy()}>
        <CombatContentAuthoringWorkspace
          categories={[
            {
              category: 'basic',
              storedKind: 'skill',
              label: 'Basic',
              group: 'Skills',
              defaultDefinition: null,
              publicationBlocker: null,
            },
          ]}
          initialRecord={basicOptions[0]}
          initialPage={basicPage}
        />
      </SkillEffectTimingProvider>
    </main>
  )
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
function ModularReaders() {
  return (
    <main style={{ padding: 16, maxWidth: 780 }}>
      <section aria-label="Modular Master details" style={sectionStyle}>
        <SkillDetails skill={modularSkill} expanded />
      </section>
      <section aria-label="Modular Nexus parameters" style={sectionStyle}>
        <SkillParameters skill={modularSkill} />
      </section>
      <section aria-label="Modular Resonance parameters" style={sectionStyle}>
        <ResonanceParameters definition={modularResonance} />
      </section>
    </main>
  )
}
function ModularManual() {
  const article = createTechniquesManualArticle({
    skills: [modularSkill],
    basics: projectPublicCombat(
      defaultBasicSkills().map((basic, index) => ({
        ...basic,
        name: `Edited ${basic.id}`,
        contentVersion: basic.contentVersion + 1,
        ability: parseAbilityDefinition({
          schemaVersion: 1,
          behaviors: [
            {
              ...basic.ability.behaviors[0],
              costs: [{ resource: 'ap', amount: 21 + index }],
            },
          ],
        }),
      })),
    ),
    timingPolicy: defaultCombatEffectTimingPolicy(),
  })
  return (
    <main style={{ padding: 16 }}>
      <ManualArticle {...article} />
    </main>
  )
}
function CanonicalEditor() {
  const [definition, setDefinition] = React.useState(() => structuredClone(modularAbility))
  const [notes, setNotes] = React.useState(['Walk <once> & return', null, 'Maintain guard'])
  React.useEffect(() => {
    window.inspectEditedAbility = () => ({ definition: parseAbilityDefinition(definition), notes })
    return () => {
      delete window.inspectEditedAbility
    }
  }, [definition, notes])
  return (
    <main style={{ padding: 16, maxWidth: 1000, background: '#0a202b', color: '#f0e8dc' }}>
      <h1>Modular Ability</h1>
      <AbilityDefinitionEditor
        value={definition}
        effectDescriptions={notes}
        onChange={(next, descriptions) => {
          setDefinition(next)
          setNotes(descriptions)
        }}
      />
    </main>
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
            <SkillParameters skill={skill} />
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
        <SkillParameters skill={mystic} />
      </BattleInfoPopover>
    </main>
  )
}
function Nexus() {
  const pure = query.get('attunement') === 'essence'
  const modular = query.get('modular') === '1'
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
      learnedSkills: modular
        ? [
            {
              definition: modularSkillFor(
                resolveMatureSkillVersion(
                  pure ? 'vanguard.forceful-strike' : 'wildwarden.renewing-herbs',
                ),
              ),
              learnedAt: '2026-10-15T00:00:00Z',
              activeSource: true,
            },
          ]
        : [],
      equippedSkills: [],
      extensions: {
        resonance: pure ? null : modular ? modularResonance : resonance,
        essence: pure ? (modular ? modularEssence : essence) : null,
      },
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
          <SkillParameters skill={definition} />
        </section>
        <BattleInfoPopover label="About Fire report" title="Fire report" trigger="!">
          <BattleSkillParameters skill={battleSkill(definition)} />
        </BattleInfoPopover>
      </SkillEffectTimingProvider>
    </main>
  )
}
createRoot(document.getElementById('root')).render(
  query.get('surface') === 'selected-preview' ? (
    <SelectedPreviewEditor />
  ) : query.get('surface') === 'basic-editor' ? (
    <BasicEditor />
  ) : query.get('surface') === 'canonical-editor' ? (
    <CanonicalEditor />
  ) : query.get('surface') === 'modular-manual' ? (
    <ModularManual />
  ) : query.get('surface') === 'modular-readers' ? (
    <ModularReaders />
  ) : query.get('surface') === 'nexus' ? (
    <Nexus />
  ) : query.get('surface') === 'fire-readers' ? (
    <FireReaders />
  ) : query.get('surface') === 'elemental-readers' ? (
    <ElementalReaders />
  ) : (
    <Reports />
  ),
)
