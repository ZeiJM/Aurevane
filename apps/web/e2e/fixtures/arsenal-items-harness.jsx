import './production-styles'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { CharacterSelectShell } from '@/components/character/character-select-shell'
import { AuthenticatedShellPresentation } from '@/components/shell/authenticated-shell-presentation'
import { LoadoutHeader } from '@/components/character/loadout-header'
import { Surface } from '@aurevane/ui'
import arsenalStyles from '@/components/character/character-arsenal-shell.module.css'
import itemStyles from '@/components/character/character-items.module.css'
import { CharacterItems } from '@/components/character/character-items'
import { CharacterSkillBuildPanel } from '@/components/character/character-skill-build-panel'
import {
  characterItemsView,
  mutateCharacterItems,
} from '@/server/character/character-items-service'
import { starterItemDefinitions, starterItemGrant } from '@aurevane/game-core/content/starter-items'
import { selectInventorySupport } from '@aurevane/game-core/character/item-inventory'
const definitions = Object.fromEntries(starterItemDefinitions().map((item) => [item.id, item]))
const availability = JSON.parse(sessionStorage.getItem('arsenal-item-availability') || '{}')
for (const [id, enabled] of Object.entries(availability))
  definitions[id] = { ...definitions[id], enabled }
window.setItemEnabled = (id, enabled) => {
  definitions[id] = { ...definitions[id], enabled }
  availability[id] = enabled
  sessionStorage.setItem('arsenal-item-availability', JSON.stringify(availability))
}
let slots = {}
const stacks = Object.values(definitions).map((item, index) => ({
  id: `owned-${item.id}`,
  characterId: 'native',
  itemId: item.id,
  inventoryCategory: item.inventoryCategory,
  slotIndex: (slots[item.inventoryCategory] = (slots[item.inventoryCategory] ?? -1) + 1),
  quantity: starterItemGrant.items.find((grant) => grant.itemId === item.id).quantity,
  acquiredAt: `2026-11-03T00:${String(index).padStart(2, '0')}:00Z`,
  acquiredContentVersion: 1,
  provenance: 'test-only',
}))
stacks.push({
  id: 'owned-archive',
  characterId: 'native',
  itemId: 'archived',
  inventoryCategory: 'gear',
  slotIndex: 21,
  quantity: 1,
  acquiredAt: '2026-11-03T00:00:00Z',
  acquiredContentVersion: 1,
  provenance: 'test-only',
})
const original = {
  characterId: 'native',
  revision: 1,
  stacks,
  equipment: {
    head: 'owned-wayfarer-hood',
    body: 'owned-stormweave-robe',
    pants: 'owned-roadworn-trousers',
    boots: 'owned-trailbound-boots',
    'main-hand': 'owned-iron-shortsword',
    'off-hand': 'owned-wardstone-bracer',
  },
  selectedSupport: { kind: 'basic', actionId: 'basic.recover' },
  previousBasicSupport: 'basic.recover',
  grants: [],
}
const storage = 'arsenal-items-native-v1'
let snapshot = JSON.parse(localStorage.getItem(storage) || 'null') ?? original
window.calls = []
window.itemReads = 0
window.testState = { battleLocked: sessionStorage.getItem('arsenal-battle-locked') === 'true' }
if (new URLSearchParams(location.search).has('read-failure')) window.testState.failRead = true
window.setBattleLocked = (locked) => {
  window.testState.battleLocked = locked
  sessionStorage.setItem('arsenal-battle-locked', JSON.stringify(locked))
}
const state = () => ({
  ...(new URLSearchParams(location.search).has('evasion')
    ? {
        equipContext: {
          level: 1,
          disciplineIds: ['vanguard'],
          baseCoreStats: {
            might: 6,
            finesse: 6,
            vitality: 6,
            agility: 6,
            intellect: 6,
            resolve: 6,
          },
        },
      }
    : {}),
  snapshot,
  definitions,
  catalogueToken: 'a'.repeat(32),
  battleLocked: window.testState.battleLocked,
})
window.itemSnapshot = () => snapshot
const save = () => localStorage.setItem(storage, JSON.stringify(snapshot))
const repository = {
  read: async () => state(),
  write: async (_u, _c, revision, _token, command) => {
    if (revision !== snapshot.revision) throw new Error('stale fixture write')
    let notices = []
    if (command.action === 'sort')
      snapshot = {
        ...snapshot,
        revision: revision + 1,
        stacks: snapshot.stacks.map((s) =>
          s.inventoryCategory === command.category
            ? { ...s, slotIndex: command.stackIds.indexOf(s.id) }
            : s,
        ),
      }
    else {
      const invalidSupport =
        snapshot.selectedSupport.kind === 'equipment' &&
        snapshot.equipment[snapshot.selectedSupport.position] !==
          command.equipment[snapshot.selectedSupport.position]
      snapshot = {
        ...snapshot,
        revision: revision + 1,
        equipment: command.equipment,
        selectedSupport: invalidSupport
          ? { kind: 'basic', actionId: snapshot.previousBasicSupport }
          : command.selectedSupport,
      }
      if (invalidSupport) notices = ['equipment-support-removed']
    }
    save()
    return { state: state(), notices }
  },
}
window.deletionCalls = []
window.fetch = async (url, init = {}) => {
  if (url === '/api/account/deletion' || url === '/api/characters/roster-fixture/deletion') {
    window.deletionCalls.push({ url, method: init.method })
    await new Promise((resolve) => {
      window.releaseDeletion = resolve
    })
    return Response.json(
      { error: { message: 'Native fixture request rejected; no deletion scheduled.' } },
      { status: 400 },
    )
  }
  if (url === '/api/character/items') {
    if (!init.method) {
      window.itemReads++
      if (window.testState.failRead) {
        window.testState.failRead = false
        return Response.json(
          { error: { message: 'Current Items could not be refreshed.' } },
          { status: 503 },
        )
      }
      const view = characterItemsView(state())
      if (window.testState.deferRead) {
        window.testState.deferRead = false
        await new Promise((resolve) => {
          window.releaseItemRead = resolve
        })
      }
      return Response.json({ view })
    }
    const body = JSON.parse(init.body)
    window.calls.push(body)
    if (window.testState.rejectNext) {
      const rejection = window.testState.rejectNext
      window.testState.rejectNext = null
      return Response.json(
        { error: { code: 'INVALID_REQUEST', message: rejection } },
        { status: 400 },
      )
    }
    if (window.testState.failNext) {
      window.testState.failNext = false
      return Response.json(
        {
          error: {
            code: 'STALE_VERSION',
            message: 'Items changed. Refresh the inventory and try again.',
          },
        },
        { status: 409 },
      )
    }
    const { characterId, ...intent } = body
    try {
      const view = await mutateCharacterItems('owner', characterId, intent, repository)
      if (window.testState.dropResponse) {
        window.testState.dropResponse = false
        return Promise.reject(new TypeError('The save confirmation was lost.'))
      }
      return Response.json({ view })
    } catch (error) {
      return Response.json(
        { error: { message: error.publicMessage ?? error.message } },
        { status: 400 },
      )
    }
  }
  const body = JSON.parse(init.body)
  window.calls.push(body)
  const result = selectInventorySupport(snapshot, definitions, snapshot.revision, {
    kind: 'basic',
    actionId: body.supportActionId,
  })
  if (!result.ok) throw new Error(result.issue.message)
  snapshot = result.snapshot
  save()
  return Response.json({
    context: {
      build: { buildVersion: body.expectedBuildVersion + 1, supportActionId: body.supportActionId },
      disciplineSkills: { capacity: 4, learnedSkills: [], equippedSkills: [] },
    },
  })
}
window.archiveEquipment = () => {
  snapshot = {
    ...snapshot,
    revision: snapshot.revision + 1,
    equipment: { ...snapshot.equipment, head: 'owned-archive' },
  }
  save()
}
window.disablePositionItems = (position) => {
  for (const item of Object.values(definitions))
    if (item.equipment?.slot === position) window.setItemEnabled(item.id, false)
}
window.depleteFixtureStack = (position) => {
  const stackId = snapshot.equipment[position]
  const used = snapshot.stacks.find((stack) => stack.id === stackId)
  const remaining = snapshot.stacks.filter((stack) => stack.id !== stackId)
  snapshot = {
    ...snapshot,
    revision: snapshot.revision + 1,
    stacks: [
      ...remaining,
      {
        ...used,
        id: 'reserve-stack',
        quantity: 3,
        slotIndex:
          Math.max(
            ...remaining
              .filter((stack) => stack.inventoryCategory === used.inventoryCategory)
              .map((stack) => stack.slotIndex),
          ) + 1,
      },
    ],
    equipment: Object.fromEntries(
      Object.entries(snapshot.equipment).filter(([, id]) => id !== stackId),
    ),
  }
  save()
}
const view = new URLSearchParams(location.search).has('missing')
  ? null
  : characterItemsView(state())
const presentationId = ['masculine', 'feminine', 'androgynous'].includes(
  new URLSearchParams(location.search).get('presentation'),
)
  ? new URLSearchParams(location.search).get('presentation')
  : 'androgynous'
const rosterCharacter = {
  id: 'roster-fixture',
  userId: 'owner',
  slotIndex: 0,
  rulesVersion: 1,
  name: 'Aurelia',
  nameKey: 'aurelia',
  presentationId: 'androgynous',
  pronounPresetId: 'they_them',
  portraitRef: 'portrait.starter.wayfarer-01',
  starterAppearanceRef: 'appearance.starter.roadworn',
  foundationDisciplineId: 'vanguard',
  attributes: { might: 6, finesse: 6, vitality: 6, agility: 6, intellect: 6, resolve: 6 },
  level: 2,
  xp: 0,
  progressionCycle: { number: 1 },
  createdAt: '',
  cycleStartedAt: '',
  lastActiveAt: '',
  deletionRequestedAt: null,
  deletionExecuteAfter: null,
  reselectAvailableAt: null,
  disciplines: { primary: { id: 'vanguard', name: 'Vanguard' }, secondary: null },
}
createRoot(document.getElementById('root')).render(
  new URLSearchParams(location.search).has('shell') ? (
    <AuthenticatedShellPresentation>
      {new URLSearchParams(location.search).get('shell') === 'nexus' ? (
        <div
          className={arsenalStyles.layout}
          data-arsenal-workspace
          data-character-concept="nexus"
          data-composition="correction"
        >
          <Surface className={arsenalStyles.arsenal} tone="elevated" data-arsenal-sheet="true">
            <LoadoutHeader active="nexus" />
          </Surface>
        </div>
      ) : (
        <section data-composition="correction" className={itemStyles.page}>
          <LoadoutHeader active="items" />
          <CharacterItems initialView={view} presentationId={presentationId} />
        </section>
      )}
    </AuthenticatedShellPresentation>
  ) : new URLSearchParams(location.search).has('roster') ? (
    <CharacterSelectShell
      characters={[rosterCharacter]}
      selectedCharacter={rosterCharacter}
      profileImageUrls={{}}
      accountDeletion={null}
    />
  ) : (
    <main style={{ maxWidth: 1400, margin: 'auto', background: '#101a22', minHeight: '100vh' }}>
      <CharacterItems initialView={view} presentationId={presentationId} />
      <CharacterSkillBuildPanel
        characterId="native"
        initialBuildVersion={1}
        initialItemsView={view}
        initialSupportActionId="basic.recover"
        primaryDiscipline={{ id: 'vanguard', name: 'Vanguard' }}
        secondaryDiscipline={null}
        initialCapacity={4}
        initialLearnedSkills={[]}
        initialEquippedSkills={[]}
        initialResonance={null}
        initialEssence={null}
      />
    </main>
  ),
)
