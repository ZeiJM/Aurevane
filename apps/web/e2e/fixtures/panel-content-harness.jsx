import React from 'react'
import { createRoot } from 'react-dom/client'
import { MasterPanelShell } from '@/components/master/master-panel-shell'
import { CombatContentAuthoringWorkspace } from '@/components/master/combat-content/combat-content-authoring-workspace'
import { contentRecordName } from '@/components/master/combat-content/content-record-workflow'
import { PlayersWorkspace } from '@/components/master/players-workspace'
import { COMBAT_CONTENT_CATEGORIES } from '@/server/combat/combat-content-categories'
import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import { currentResonanceDefinitions } from '@aurevane/game-core/combat/resonance'
import './production-styles'

// These are transport fixtures. Runtime editors, engine definitions, categories,
// rendering, input behavior and CSS are production code; hosted authority is not.
const categories = COMBAT_CONTENT_CATEGORIES.map((entry) => entry.editor)
const template = categories.find((entry) => entry.category === 'discipline').defaultDefinition
const skill = structuredClone(
  latestEnabledMatureSkills().find((entry) => entry.sourceDisciplineId === 'bastion'),
)
const resonance = structuredClone(
  currentResonanceDefinitions().find((entry) => entry.disciplinePair.includes('bastion')),
)
skill.name = contentRecordName(skill)
resonance.name = contentRecordName(resonance)
const discipline = {
  ...structuredClone(template),
  id: 'bastion',
  name: 'Bastion',
  description: 'Current Bastion text.',
  linkedSkills: [skill.id],
  skillStages: [{ skillId: skill.id, minimumStage: 1 }],
  resonanceSelections: [
    {
      partnerDisciplineId: resonance.disciplinePair.find((id) => id !== 'bastion'),
      resonanceId: resonance.id,
    },
  ],
}
function version(definition, number) {
  return {
    contentVersion: number,
    definition: { ...structuredClone(definition), contentVersion: number },
    publishedBy: 'fixture-owner',
    publishedAt: '2026-10-26T12:00:00Z',
  }
}
function record(kind, definition, index = 0) {
  const current = version(definition, 2)
  return {
    contentKey: definition.id,
    contentKind: kind,
    lifecycle: 'active',
    revision: 2,
    versionFloor: 2,
    createdBy: null,
    createdAt: null,
    builtin: { contentVersion: 1, name: definition.name },
    builtinDefinition: structuredClone(definition),
    builtinRestoreVersion: 1,
    current,
    draft: null,
    history: [current, version({ ...definition, description: 'Previous saved description.' }, 1)],
    links: definition.linkedSkills ?? [],
    usedBy: kind === 'skill' ? [{ kind: 'discipline', key: 'bastion' }] : [],
    usedByTruncated: false,
    index,
  }
}
const records = new Map(
  [
    record('discipline', discipline),
    record('skill', skill),
    record('resonance', resonance),
    ...Array.from({ length: 30 }, (_, index) =>
      record(
        'discipline',
        {
          ...discipline,
          id: 'discipline.fixture.' + index,
          name: 'Additional Discipline ' + String(index + 1).padStart(2, '0'),
        },
        index + 1,
      ),
    ),
  ].map((entry) => [entry.contentKey, entry]),
)
const references = [...records.values()].map((entry) => ({
  contentKey: entry.contentKey,
  contentKind: entry.contentKind,
  name: entry.current.definition.name,
}))
function list(command = {}) {
  let rows = [...records.values()]
    .filter((row) => !command.kind || row.contentKind === command.kind)
    .filter(
      (row) =>
        !command.search ||
        JSON.stringify(row.current.definition).toLowerCase().includes(command.search.toLowerCase()),
    )
  rows.sort((a, b) => a.current.definition.name.localeCompare(b.current.definition.name))
  if (command.sort === 'name-desc') rows.reverse()
  return {
    records: rows.map((row) => ({
      contentKey: row.contentKey,
      contentKind: row.contentKind,
      lifecycle: row.lifecycle,
      revision: row.revision,
      name: row.current.definition.name,
    })),
    nextCursor: null,
  }
}
const player = {
  characterId: 'fixture-player',
  name: 'Reader Target',
  portraitRef: 'portrait',
  verifiedEmail: 'reader@example.test',
  fingerprint: 'f'.repeat(64),
  deletionPending: false,
  facts: {
    level: 1,
    xp: 0,
    cycle: 1,
    attributes: { might: 12, finesse: 4, vitality: 7, agility: 4, intellect: 3, resolve: 6 },
    build: {
      buildVersion: 1,
      primary: { disciplineId: 'bastion', definitionVersion: 1, profileVersion: 1 },
      secondary: null,
      disciplineSkills: [],
      supportActionId: 'basic.guard',
      extensions: { resonance: null, essence: null },
    },
  },
  calculated: { maxHp: 100, maxMp: 30, personalPointPool: 5 },
  disciplines: [{ id: 'bastion', name: 'Bastion', primary: true, secondary: true }],
  learnedSkills: [],
  savedLoadouts: Array.from({ length: 30 }, (_, index) => ({ name: 'Saved build ' + index })),
  world: null,
  training: null,
  battle: null,
}
const nativeFetch = window.fetch.bind(window)
window.__contentRequests = []
window.__contentFixture = {
  holdCommit: false,
  failCommit: false,
  failMedia: false,
  records,
  player,
  skillId: skill.id,
  resonanceId: resonance.id,
}
window.fetch = async (input, options) => {
  if (input === '/api/master/combat-content/media') {
    const body = options.body
    window.__contentRequests.push({
      path: input,
      fileType: body.get('file')?.type,
      crop: JSON.parse(body.get('crop') ?? 'null'),
    })
    if (window.__contentFixture.failMedia) {
      window.__contentFixture.failMedia = false
      return Response.json(
        { error: { message: 'Fixture media rejection; choose another image.' } },
        { status: 400 },
      )
    }
    return Response.json({
      media: {
        id: '11111111-1111-4111-8111-111111111111',
        checksum: 'a'.repeat(64),
        byteLength: 1024,
        kind: 'image',
        contentType: 'image/png',
        width: 192,
        height: 192,
        sourceWidth: 192,
        sourceHeight: 192,
        crop: { x: 0, y: 0, size: 192 },
      },
    })
  }
  if (typeof input === 'string' && input.startsWith('/api/master/combat-content/media/'))
    return nativeFetch('/fixture-finalized.png')
  if (input === '/api/master/players') {
    const body = JSON.parse(options.body)
    window.__contentRequests.push({ path: input, body })
    if (body.operation === 'search')
      return Response.json({
        players: Array.from({ length: 20 }, (_, index) => ({
          characterId: index ? 'fixture-player-' + index : player.characterId,
          name: index ? 'Search Result ' + index : player.name,
          level: 1,
          slotIndex: index,
          verifiedEmail: player.verifiedEmail,
          deletionPending: false,
        })),
      })
    return Response.json({ player })
  }
  if (input !== '/api/master/combat-content') return nativeFetch(input, options)
  const body = JSON.parse(options.body),
    command = body.command
  window.__contentRequests.push({ path: input, body: structuredClone(body) })
  if (command.action === 'list') return Response.json(list(command))
  if (command.action === 'read') return Response.json({ record: records.get(command.contentKey) })
  const entry = records.get(command.contentKey)
  if (command.action === 'commit') {
    if (window.__contentFixture.holdCommit)
      await new Promise((resolve) => (window.__releaseContentCommit = resolve))
    window.__contentFixture.holdCommit = false
    if (window.__contentFixture.failCommit) {
      window.__contentFixture.failCommit = false
      return Response.json(
        { error: { code: 'STALE_VERSION', message: 'Fixture server rejected this commit.' } },
        { status: 409 },
      )
    }
    if (command.expectedRevision !== entry.revision)
      return Response.json(
        { error: { code: 'STALE_VERSION', message: 'Fixture stale revision.' } },
        { status: 409 },
      )
    entry.current = version(command.definition, entry.current.contentVersion + 1)
    entry.history.unshift(entry.current)
    entry.revision++
    entry.draft = null
    return Response.json({ record: structuredClone(entry) })
  }
  if (command.action === 'restore') {
    entry.draft = {
      definition: structuredClone(
        entry.history.find((row) => row.contentVersion === command.sourceVersion).definition,
      ),
      draftVersion: 1,
      baseVersion: entry.current.contentVersion,
      updatedBy: 'fixture-owner',
      updatedAt: '2026-10-26T12:00:00Z',
      restoredFrom: command.sourceVersion,
      restoredBy: 'fixture-owner',
    }
    entry.revision++
    return Response.json({ record: structuredClone(entry) })
  }
  throw new Error('Unhandled fixture command ' + command.action)
}
const access = {
  userId: 'fixture-owner',
  accessVersion: 1,
  roles: ['game-owner'],
  specialCapabilities: [],
  effectiveCapabilities: ['master.access', 'staff.manage', 'content.combat.author'],
}
const players = new URLSearchParams(location.search).get('view') === 'players'
createRoot(document.getElementById('root')).render(
  <MasterPanelShell
    access={access}
    activeSection={players ? 'players' : 'combat'}
    title={players ? 'Players' : 'Game Content'}
    description="Production-component transport fixture"
  >
    {players ? (
      <PlayersWorkspace />
    ) : (
      <CombatContentAuthoringWorkspace
        categories={categories}
        initialPage={list({ kind: 'discipline' })}
        initialRecord={records.get('bastion')}
        references={references}
      />
    )}
  </MasterPanelShell>,
)
