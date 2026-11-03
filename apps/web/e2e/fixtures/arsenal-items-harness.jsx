import React from 'react'
import { createRoot } from 'react-dom/client'
import { CharacterSelectShell } from '@/components/character/character-select-shell'
import { CharacterItems } from '@/components/character/character-items'
import { CharacterSkillBuildPanel } from '@/components/character/character-skill-build-panel'
import {
  characterItemsView,
  mutateCharacterItems,
} from '@/server/character/character-items-service'
import { imageAssetRegistry } from '@/media/registry'
import { itemFixture } from '@aurevane/game-core/content/items-test-fixtures'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { selectInventorySupport } from '@aurevane/game-core/character/item-inventory'
import manifest from '@item-art-manifest'
import './production-styles'
// Test-only definitions. Genuine production source definitions belong to the source installer.
const attackAbility = defaultBasicSkills().find((s) => s.id === 'unarmed.basic').ability
const ability = defaultBasicSkills().find((s) => s.id === 'basic.recover').ability
const descriptions = [
  ['wayfarer-hood', 'armor', 'head', 8],
  ['warden-helm', 'armor', 'head', 32],
  ['traveler-jerkin', 'armor', 'body', 8],
  ['duskplate-cuirass', 'armor', 'body', 38],
  ['roadworn-trousers', 'armor', 'pants', 8],
  ['trailbound-boots', 'armor', 'boots', 8],
  ['iron-shortsword', 'weapon', 'hand', 8],
  ['hollow-dagger', 'weapon', 'hand', 6],
  ['wardstone-bracer', 'hand-armor', 'hand', 8],
  ['sunsplitter', 'weapon', 'hand', 50],
  ['mender-salve', 'battle-item', 'hand', 7],
  ['clarity-draught', 'battle-item', 'hand', 6],
]
const definitions = Object.fromEntries(
  descriptions.map(([key, itemClass, slot, qualityPoints], index) => {
    const art = manifest.items.find((row) => row.assetKey === key)
    imageAssetRegistry.set(`test.${key}`, {
      id: `test.${key}`,
      src: art.assets.preview.path,
      status: 'approved',
      kind: 'icon',
      requestId: 'native-only',
      decorative: false,
      alt: art.name,
    })
    return [
      key,
      itemFixture({
        id: key,
        name: art.name,
        description: 'A finished Aurevane illustration with an ordinary shared mechanics report.',
        media: { artworkId: `test.${key}` },
        inventoryCategory: itemClass === 'battle-item' ? 'battle-items' : 'gear',
        itemClass,
        qualityPoints,
        equipment: { slot, hands: key === 'sunsplitter' ? 2 : 1 },
        maximumStack: itemClass === 'battle-item' ? 99 : 1,
        tier: qualityPoints >= 38 ? 'S' : qualityPoints >= 20 ? 'B' : 'D',
        ability:
          itemClass === 'weapon'
            ? attackAbility
            : itemClass === 'battle-item' || key === 'wardstone-bracer'
              ? ability
              : null,
        battleUses: itemClass === 'battle-item' ? 3 : null,
        actions:
          itemClass === 'weapon'
            ? { attack: { name: 'Weapon strike', behaviorId: attackAbility.behaviors[0].id } }
            : itemClass === 'battle-item'
              ? { use: { name: 'Apply remedy', behaviorId: ability.behaviors[0].id } }
              : key === 'wardstone-bracer'
                ? { support: { name: 'Warding Prayer', behaviorId: ability.behaviors[0].id } }
                : undefined,
        sortOrder: index,
      }),
    ]
  }),
)
const sampleCategories = ['materials', 'general', 'event', 'companion']
manifest.items.slice(-15).forEach((art, index) => {
  const category = sampleCategories[Math.min(3, Math.floor(index / 4))]
  imageAssetRegistry.set(`test.${art.assetKey}`, {
    id: `test.${art.assetKey}`,
    src: art.assets.preview.path,
    status: 'approved',
    kind: 'icon',
    requestId: 'native-only',
    decorative: false,
    alt: art.name,
  })
  definitions[art.assetKey] = itemFixture({
    id: art.assetKey,
    name: art.name,
    media: { artworkId: `test.${art.assetKey}` },
    itemClass: category === 'materials' ? 'material' : category,
    inventoryCategory: category,
    qualityPoints: 0,
    equipment: null,
    maximumStack: 99,
  })
})
let slots = {}
const stacks = Object.values(definitions).map((item, index) => ({
  id: `owned-${item.id}`,
  characterId: 'native',
  itemId: item.id,
  inventoryCategory: item.inventoryCategory,
  slotIndex: (slots[item.inventoryCategory] = (slots[item.inventoryCategory] ?? -1) + 1),
  quantity: item.maximumStack === 99 ? 99 : 1,
  acquiredAt: `2026-11-03T00:${String(index).padStart(2, '0')}:00Z`,
  acquiredContentVersion: 1,
  provenance: 'test-only',
}))
stacks.push({
  id: 'owned-archive',
  characterId: 'native',
  itemId: 'archived',
  inventoryCategory: 'gear',
  slotIndex: 10,
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
    body: 'owned-traveler-jerkin',
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
window.testState = { battleLocked: false }
const state = () => ({
  snapshot,
  definitions,
  catalogueToken: 'a'.repeat(32),
  battleLocked: window.testState.battleLocked,
})
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
      return Response.json({
        view: await mutateCharacterItems('owner', characterId, intent, repository),
      })
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
const view = characterItemsView(state())
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
  new URLSearchParams(location.search).has('roster') ? (
    <CharacterSelectShell
      characters={[rosterCharacter]}
      selectedCharacter={rosterCharacter}
      profileImageUrls={{}}
      accountDeletion={null}
    />
  ) : (
    <main style={{ maxWidth: 1400, margin: 'auto', background: '#101a22', minHeight: '100vh' }}>
      <CharacterItems initialView={view} />
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
