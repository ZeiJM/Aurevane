import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseRuntimeItemDefinition } from './items'
import { starterItemDefinitions, starterItemGrant } from './starter-items'

it('ships the complete illustrated 47 Item catalogue with genuine executable equipment and bounded sample quantities', () => {
  const items = starterItemDefinitions()
  const artwork = JSON.parse(
    readFileSync(
      new URL('../../../../docs/artwork/2026-11-03-starter-items.json', import.meta.url),
      'utf8',
    ),
  )
  expect(items).toHaveLength(47)
  expect(new Set(items.map((x) => x.id)).size).toBe(47)
  expect(items.map((x) => x.media.artworkId).sort()).toEqual(
    artwork.items.map((x: { assetKey: string }) => `item.${x.assetKey}.art.v1`).sort(),
  )
  for (const [itemClass, count] of Object.entries({
    armor: 11,
    'hand-armor': 2,
    weapon: 8,
    'battle-item': 11,
    material: 5,
    general: 4,
    event: 3,
    companion: 3,
  }))
    expect(
      items.filter((x) => x.itemClass === itemClass),
      itemClass,
    ).toHaveLength(count)
  for (const item of items) {
    expect(parseRuntimeItemDefinition(item)).toEqual(item)
    expect(item.requirements).toBeNull()
    expect(item.consumeOnUse).toBe(false)
    expect(item.equipment ? item.ability?.behaviors.length : item.ability === null).toBeTruthy()
  }
  expect(starterItemGrant.items.map((x) => x.itemId).sort()).toEqual(items.map((x) => x.id).sort())
  expect(starterItemGrant.items.map((x) => x.quantity)).toEqual(
    expect.arrayContaining([12, 40, 99]),
  )
  expect(items.find((x) => x.id === 'sunsplitter')).toMatchObject({
    qualityPoints: 50,
    equipment: { slot: 'hand', hands: 2 },
  })
  const boots = ['trailbound-boots', 'galewalker-boots'].map((id) =>
    items.find((x) => x.id === id)!,
  )
  expect(boots[1]!.qualityPoints).toBeGreaterThan(boots[0]!.qualityPoints)
  boots.forEach((item, index) =>
    expect(item.ability?.behaviors[0]?.effects[0]?.payload).toEqual({
      type: 'stat-bonus',
      recipient: 'actor',
      stat: 'movement',
      amount: index + 1,
    }),
  )
})

it('balances all eleven consumables between 10 and 30 AP in steps of five', () => {
  const supplies = starterItemDefinitions().filter((item) => item.itemClass === 'battle-item')
  expect(
    Object.fromEntries(
      supplies.map((item) => [item.id, item.ability!.behaviors[0]!.costs[0]!.amount]),
    ),
  ).toEqual({
    'mender-salve': 20,
    'clarity-draught': 20,
    'purifying-incense': 30,
    'whetstone-charm': 15,
    'ironbark-tonic': 10,
    'swiftleaf-tea': 25,
    emberflask: 20,
    'vulnerability-oil': 15,
    'frostbind-powder': 30,
    'smoke-veil': 20,
    'ward-sigil-scroll': 30,
  })
})

it('keeps the original one-time starter grant receipt', () => {
  expect(starterItemGrant.key).toBe('starter-items.2026-11-03.v1')
})

it('binds distinct selectable weapon Supports while preserving Tower Guard', () => {
  const items = starterItemDefinitions()
  expect(
    Object.fromEntries(
      items
        .filter((item) => item.itemClass === 'weapon' && item.actions?.support)
        .map((item) => [item.id, item.actions!.support!.name]),
    ),
  ).toEqual({
    'twinfang-blade': 'Quickstep',
    'stormcaller-staff': 'Storm Ward',
    emberbrand: 'Kindle',
    'tower-shield': 'Tower Guard',
  })
})

it('retains the reviewed Fire-only Kindle scope and consumable description corrections', () => {
  const items = starterItemDefinitions()
  expect(
    items
      .filter(
        (item) =>
          ['emberbrand', 'vulnerability-oil', 'ward-sigil-scroll'].includes(item.id) &&
          item.contentVersion === (item.id === 'emberbrand' ? 10 : 6),
      )
      .map((item) => item.id)
      .sort(),
  ).toEqual(['emberbrand', 'vulnerability-oil', 'ward-sigil-scroll'])
  const kindle = items
    .find((item) => item.id === 'emberbrand')!
    .ability!.behaviors.find((group) => group.id === 'kindle')!
  expect(kindle.effects[0]!.payload).toMatchObject({
    type: 'apply-status',
    statusId: 'inspired',
    damageTypes: ['fire'],
    potencyBasisPoints: 1000,
    durationTurns: 2,
  })
  expect(items.find((item) => item.id === 'vulnerability-oil')!.description).toContain('2 turns')
  expect(items.find((item) => item.id === 'ward-sigil-scroll')!.description).toContain(
    'once per battle',
  )
})

it('matches reviewed successors while preserving every unaffected source body', () => {
  const audit = JSON.parse(
    readFileSync(
      new URL(
        '../../../../docs/verification/2026-11-05-items-polish-successors.json',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  const before = JSON.parse(
    readFileSync(
      new URL(
        '../../../../docs/verification/2026-11-05-item-description-successors.json',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  const items = starterItemDefinitions()
  expect(audit.candidates).toHaveLength(20)
  for (const item of items) {
    const candidate = audit.candidates.find((row: { itemId: string }) => row.itemId === item.id)
    if (candidate) {
      const prior = parseRuntimeItemDefinition(candidate.sourceDefinition)
      const successor = [
        'twinfang-blade',
        'tower-shield',
        'stormcaller-staff',
        'emberbrand',
      ].includes(item.id)
      expect(
        successor
          ? { ...item, contentVersion: prior.contentVersion, actions: prior.actions }
          : item,
      ).toEqual(prior)
      const normalized = structuredClone(candidate.beforeDefinition)
      normalized.contentVersion = item.contentVersion
      if (successor) normalized.actions.support = item.actions!.support
      for (const group of normalized.ability.behaviors)
        for (const effect of group.effects) delete effect.timing
      if (item.itemClass === 'weapon')
        normalized.ability.behaviors = normalized.ability.behaviors.filter(
          (group: { activation: string }) => group.activation === 'manual',
        )
      if (item.id === 'wardstone-bracer') {
        normalized.ability.behaviors = normalized.ability.behaviors.filter(
          (group: { activation: string }) => group.activation === 'ongoing',
        )
        delete normalized.actions
      }
      if (item.id === 'emberbrand')
        normalized.ability.behaviors[0].effects[0].payload.scaling.coefficientBasisPoints = 1400
      if (['emberbrand', 'tower-shield', 'wardstone-bracer'].includes(item.id))
        normalized.description = item.description
      expect(item).toEqual(normalized)
    } else {
      const baseline = before.auditedCatalogue.find(
        (row: { itemId: string }) => row.itemId === item.id,
      ).effectiveDefinition
      expect({ ...item, contentVersion: baseline.contentVersion }).toEqual(baseline)
    }
  }
})

it('retains four independent technique artworks on purpose successors', () => {
  const successors = starterItemDefinitions().filter((item) => item.contentVersion === 10)
  expect(successors.map((item) => item.id).sort()).toEqual([
    'emberbrand',
    'stormcaller-staff',
    'tower-shield',
    'twinfang-blade',
  ])
  for (const item of successors)
    expect(item.actions!.support!.media).toEqual({ artworkId: `item.${item.id}.technique.art.v1` })
})

it('adds exactly four source10 purpose successors without changing captured mechanics or historical source8 bodies', () => {
  const prior = JSON.parse(
    readFileSync(
      new URL(
        '../../../../docs/verification/2026-11-06-item-technique-successors.json',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  const purpose = {
    'twinfang-blade': 'Reduce the AP cost of your movement for 1 turn.',
    'tower-shield': 'Reduce incoming damage with Guarded for 2 turns.',
    'stormcaller-staff': 'Gain a Barrier equal to 8% of your maximum HP for 2 turns.',
    emberbrand: 'Increase your direct Fire damage for 2 turns.',
  }
  const items = starterItemDefinitions()
  expect(
    items
      .filter((row) => row.contentVersion === 10)
      .map((row) => row.id)
      .sort(),
  ).toEqual(Object.keys(purpose).sort())
  for (const candidate of prior.candidates) {
    const source8 = parseRuntimeItemDefinition(candidate.afterDefinition)
    expect(source8.actions!.support).not.toHaveProperty('description')
    expect(items.find((row) => row.id === source8.id)).toEqual({
      ...source8,
      contentVersion: 10,
      actions: {
        ...source8.actions,
        support: {
          ...source8.actions!.support!,
          description: purpose[source8.id as keyof typeof purpose],
        },
      },
    })
  }
})

it('matches every reviewed purpose successor audit body and permits only purpose/version differences', () => {
  const audit = JSON.parse(
    readFileSync(
      new URL(
        '../../../../docs/verification/2026-11-06-item-purpose-successors.json',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  expect(audit.candidates).toHaveLength(4)
  expect(audit.unchangedSources).toHaveLength(43)
  for (const candidate of audit.candidates) {
    const current = starterItemDefinitions().find((row) => row.id === candidate.itemId)!
    expect(current).toEqual(parseRuntimeItemDefinition(candidate.afterDefinition))
    expect({
      ...current,
      contentVersion: candidate.beforeContentVersion,
      actions: { ...current.actions, support: candidate.beforeDefinition.actions.support },
    }).toEqual(candidate.beforeDefinition)
    expect(candidate.changedPaths).toEqual(['actions.support.description', 'contentVersion'])
  }
  for (const unchanged of audit.unchangedSources)
    expect(
      starterItemDefinitions().find((row) => row.id === unchanged.itemId)?.contentVersion,
    ).toBe(unchanged.contentVersion)
})
