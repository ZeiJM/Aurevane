import React from 'react'
import { createRoot } from 'react-dom/client'
import { MasterPanelShell } from '@/components/master/master-panel-shell'
import { CombatContentAuthoringWorkspace } from '@/components/master/combat-content/combat-content-authoring-workspace'
import { contentRecordName } from '@/components/master/combat-content/content-record-workflow'
import { PlayersWorkspace } from '@/components/master/players-workspace'
import { COMBAT_CONTENT_CATEGORIES } from '@/server/combat/combat-content-categories'
import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import { currentEssenceDefinitions } from '@aurevane/game-core/combat/essence'
import { currentResonanceDefinitions } from '@aurevane/game-core/combat/resonance'
import { parseNoncombatContentDefinition } from '@aurevane/game-core/content/authored-content'
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
const essence = structuredClone(
  currentEssenceDefinitions().find((entry) => entry.sourceDisciplineId === 'bastion'),
)
skill.name = contentRecordName(skill)
resonance.name = contentRecordName(resonance)
const discipline = {
  ...structuredClone(template),
  id: 'bastion',
  name: 'Bastion',
  description: 'Current Bastion text.',
  essenceId: essence.essenceId,
  linkedSkills: [skill.id],
  skillStages: [{ skillId: skill.id, minimumStage: 1 }],
  resonanceSelections: [
    {
      withDisciplineId: resonance.disciplinePair.find((id) => id !== 'bastion'),
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
    contentKey: definition.id ?? definition.essenceId,
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
    record('skill', {
      ...skill,
      id: 'skill.fixture.unrelated',
      name: 'Unrelated Source Skill',
      sourceDisciplineId: resonance.disciplinePair.find((id) => id !== 'bastion'),
    }),
    record('resonance', resonance),
    record('resonance', {
      ...resonance,
      id: 'resonance.fixture.alternative',
      name: 'Alternative Shared Power',
    }),
    record('essence', essence),
    record('essence', {
      ...essence,
      essenceId: 'essence.fixture.alternative',
      name: 'Alternative Bastion Essence',
    }),
    record('discipline', {
      ...discipline,
      id: resonance.disciplinePair.find((id) => id !== 'bastion'),
      name: 'Partner Discipline',
      linkedSkills: [],
      skillStages: [],
      resonanceSelections: [],
    }),
    ...Array.from({ length: 125 }, (_, index) =>
      record(
        'discipline',
        {
          ...discipline,
          id: 'discipline.fixture.' + index,
          name: 'Additional Discipline ' + String(index + 1).padStart(3, '0'),
        },
        index + 1,
      ),
    ),
  ].map((entry) => [entry.contentKey, entry]),
)
const savedRecords = JSON.parse(sessionStorage.getItem('fixture.saved-records') ?? 'null')
if (savedRecords) for (const entry of savedRecords) records.set(entry.contentKey, entry)
const references = [...records.values()].map((entry) => ({
  contentKey: entry.contentKey,
  contentKind: entry.contentKind,
  name: (entry.current?.definition ?? entry.draft?.definition ?? entry.builtinDefinition).name,
  sourceDisciplineId: (
    entry.current?.definition ??
    entry.draft?.definition ??
    entry.builtinDefinition
  ).sourceDisciplineId,
  disciplinePair: (entry.current?.definition ?? entry.draft?.definition ?? entry.builtinDefinition)
    .disciplinePair,
}))
function list(command = {}) {
  let rows = [...records.values()]
    .filter((row) => !command.kind || row.contentKind === command.kind)
    .filter(
      (row) =>
        !command.search ||
        JSON.stringify(row.current?.definition ?? row.draft?.definition ?? row.builtinDefinition)
          .toLowerCase()
          .includes(command.search.toLowerCase()),
    )
  rows.sort((a, b) =>
    (a.current?.definition ?? a.draft?.definition).name.localeCompare(
      (b.current?.definition ?? b.draft?.definition).name,
    ),
  )
  if (command.sort === 'name-desc') rows.reverse()
  const start = Number(command.after?.replace('fixture-offset-', '') ?? 0)
  const end = start + (command.limit ?? 100)
  return {
    records: rows.slice(start, end).map((row) => ({
      contentKey: row.contentKey,
      contentKind: row.contentKind,
      lifecycle: row.lifecycle,
      revision: row.revision,
      name: (row.current?.definition ?? row.draft?.definition ?? row.builtinDefinition).name,
    })),
    nextCursor: end < rows.length ? 'fixture-offset-' + end : null,
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
const creationLedger = new Map(JSON.parse(sessionStorage.getItem('fixture.creations') ?? '[]'))
const fixtureGrantRecipient = {
  accountId: '11111111-1111-4111-8111-111111111111',
  name: 'Verified Fixture Player',
}
const fixtureGrants = new Map(JSON.parse(sessionStorage.getItem('fixture.grants') ?? '[]'))
const nativeFetch = window.fetch.bind(window)
window.__contentRequests = []
window.__contentCommitCount = Number(sessionStorage.getItem('fixture.commit-count') ?? 0)
window.__contentFixture = {
  holdCommit: false,
  failCommit: false,
  failMedia: false,
  loseCreateResponse: false,
  creations: creationLedger,
  records,
  player,
  essenceId: essence.essenceId,
  partnerId: resonance.disciplinePair.find((id) => id !== 'bastion'),
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
    if (body.get('file')?.type.startsWith('audio/'))
      return Response.json({
        media: {
          id: '11111111-1111-4111-8111-111111111112',
          checksum: 'b'.repeat(64),
          byteLength: 8864,
          kind: 'audio',
          contentType: 'audio/wav',
          durationMs: 100,
          channels: 1,
          sampleRate: 44100,
        },
      })
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
  if (typeof input === 'string' && input.startsWith('/api/master/combat-content/usage-balance?')) {
    const query = new URL(input, location.origin).searchParams
    const contentKey = query.get('contentKey')
    const historical = query.get('week') === '2026-10-19'
    return Response.json({
      contentKey,
      subjectKind: 'discipline',
      asOf: '2026-10-27T12:00:00Z',
      availableWeeks: ['2026-10-26', '2026-10-19'],
      weekStartsAt: historical ? '2026-10-19T00:00:00Z' : '2026-10-26T00:00:00Z',
      weekEndsAt: historical ? '2026-10-26T00:00:00Z' : '2026-11-02T00:00:00Z',
      current: {
        primaryPlayers: 3,
        secondaryPlayers: 2,
        primaryCharacters: 3,
        secondaryCharacters: 2,
        totalPlayers: 5,
        totalCharacters: 5,
      },
      skills: [
        {
          skillId: skill.id,
          name: skill.name,
          equippedPlayers: 2,
          equippedCharacters: 2,
          actualUses: historical ? 3 : 0,
          usedBattles: historical ? 1 : 0,
        },
      ],
      weekly: ['pvp', 'pve-recruit'].map((source) => ({
        source,
        appearances: historical && source === 'pvp' ? 2 : 0,
        wins: historical && source === 'pvp' ? 1 : 0,
        losses: historical && source === 'pvp' ? 1 : 0,
        draws: 0,
      })),
      pairs: [],
      matchups: [],
      coverage: {
        legacyHistoryAvailable: false,
        rosterTruncated: false,
        battlesTruncated: false,
        collectedBattles: historical ? 1 : 0,
        collectionStartedAt: '2026-10-19T00:00:00Z',
      },
    })
  }
  if (input === '/api/master/discipline-player-grants') {
    const body = JSON.parse(options.body)
    window.__contentRequests.push({ path: input, body })
    const existing = fixtureGrants.get(body.disciplineId) ?? []
    if (body.operation === 'read') return Response.json({ result: existing })
    if (body.operation === 'search') return Response.json({ result: [fixtureGrantRecipient] })
    const recipients = body.accountIds?.includes(fixtureGrantRecipient.accountId)
      ? [fixtureGrantRecipient]
      : []
    fixtureGrants.set(
      body.disciplineId,
      body.operation === 'grant'
        ? recipients
        : existing.filter((row) => !body.accountIds?.includes(row.accountId)),
    )
    sessionStorage.setItem('fixture.grants', JSON.stringify([...fixtureGrants]))
    return Response.json({ result: null })
  }
  if (input !== '/api/master/combat-content') return nativeFetch(input, options)
  const body = JSON.parse(options.body),
    command = body.command
  window.__contentRequests.push({ path: input, body: structuredClone(body) })
  if (command.action === 'list') {
    if (
      new URLSearchParams(location.search).get('holdRestore') === '1' &&
      !window.__contentRestoreReleased
    ) {
      await new Promise((resolve) => {
        window.__releaseContentRestore = () => {
          window.__contentRestoreReleased = true
          resolve()
        }
      })
    }
    return Response.json(list(command))
  }
  if (command.action === 'read') {
    if (
      new URLSearchParams(location.search).get('holdRead') === '1' &&
      !window.__contentReadReleased
    )
      await new Promise((resolve) => {
        window.__releaseContentRead = () => {
          window.__contentReadReleased = true
          resolve()
        }
      })
    return Response.json({ record: records.get(command.contentKey) })
  }
  if (command.action === 'create') {
    if (command.contentKind === 'discipline') {
      try {
        parseNoncombatContentDefinition('discipline', command.definition)
      } catch (error) {
        return Response.json(
          { error: { code: 'INVALID_REQUEST', message: error.message } },
          { status: 400 },
        )
      }
    }
    const fingerprint = JSON.stringify({
      kind: command.contentKind,
      definition: command.definition,
    })
    let receipt = creationLedger.get(command.requestId)
    if (receipt && receipt.fingerprint !== fingerprint)
      return Response.json(
        {
          error: {
            code: 'REQUEST_REUSED',
            message: 'Fixture request identity was reused with a different creation payload.',
          },
        },
        { status: 409 },
      )
    if (!receipt) {
      const key = command.contentKind + '.' + command.requestId
      const definition = { ...command.definition, id: key }
      const created = record(command.contentKind, definition)
      created.current = null
      created.history = []
      created.draft = {
        definition,
        draftVersion: 1,
        baseVersion: null,
        updatedBy: 'fixture-owner',
        updatedAt: '2026-10-27T12:00:00Z',
      }
      if (command.parentKey) {
        const parent = records.get(command.parentKey)
        if (!parent || parent.revision !== command.expectedParentRevision)
          return Response.json(
            { error: { code: 'STALE_VERSION', message: 'Discipline changed.' } },
            { status: 409 },
          )
        const assigned = new Set([
          ...(parent.links ?? []),
          ...((parent.draft ?? parent.current).definition.linkedSkills ?? []),
        ])
        if (assigned.size >= 8)
          return Response.json(
            {
              error: {
                code: 'INVALID_REQUEST',
                message: 'A Discipline can have at most 8 Skills.',
              },
            },
            { status: 400 },
          )
        parent.links = [...assigned, key]
        parent.revision++
      }
      records.set(key, created)
      receipt = { key, fingerprint }
      creationLedger.set(command.requestId, receipt)
      sessionStorage.setItem('fixture.creations', JSON.stringify([...creationLedger]))
      sessionStorage.setItem('fixture.saved-records', JSON.stringify([...records.values()]))
      if (window.__contentFixture.loseCreateResponse) {
        window.__contentFixture.loseCreateResponse = false
        throw new TypeError('Fixture response was lost after creation.')
      }
    }
    return Response.json({ record: structuredClone(records.get(receipt.key)) })
  }
  const entry = records.get(command.contentKey)
  if (command.action === 'commit') {
    window.__contentCommitCount++
    sessionStorage.setItem('fixture.commit-count', String(window.__contentCommitCount))
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
    const comparable = { ...command.definition, contentVersion: entry.current?.contentVersion }
    if (entry.contentKind === 'essence' && comparable.skill)
      comparable.skill = { ...comparable.skill, contentVersion: entry.current?.contentVersion }
    if (
      entry.current &&
      !entry.draft &&
      JSON.stringify(comparable) === JSON.stringify(entry.current.definition)
    )
      return Response.json({ record: structuredClone(entry) })
    entry.current = version(command.definition, (entry.current?.contentVersion ?? 0) + 1)
    entry.history.unshift(entry.current)
    entry.revision++
    entry.draft = null
    sessionStorage.setItem('fixture.saved-records', JSON.stringify([...records.values()]))
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
  effectiveCapabilities: [
    'master.access',
    'staff.manage',
    'content.combat.author',
    'combat.rules',
    'events.author',
    'events.operate',
    'moderation.manage',
    'players.manage',
    'music.manage',
    'world.manage',
    'activity.read',
  ],
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
        recoveryScope={
          new URLSearchParams(location.search).get('actor') ?? 'fixture-owner:selected-character'
        }
        categories={categories}
        initialPage={list({ kind: 'discipline' })}
        initialRecord={records.get('bastion')}
        references={references}
      />
    )}
  </MasterPanelShell>,
)
