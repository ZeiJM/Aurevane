import React from 'react'
import { createRoot } from 'react-dom/client'
import { ItemDetails } from '@/components/character/item-details'
import { presentItem } from '@/lib/items/item-presentation'
import { CombatContentAuthoringWorkspace } from '@/components/master/combat-content/combat-content-authoring-workspace'
import { starterItemDefinitions } from '@aurevane/game-core/content/starter-items'
import { parseRuntimeItemDefinition } from '@aurevane/game-core/content/items'
import './production-styles'

// Local transport/persistence fixture only; actual workspace, editors and parser are production.
const key = 'native-imbued-item'
const original = {
  ...starterItemDefinitions().find((item) => item.itemClass === 'weapon'),
  sortOrder: 317,
}
const version = (definition, contentVersion) => ({
  contentVersion,
  definition,
  publishedBy: 'fixture',
  publishedAt: '2026-11-05T00:00:00Z',
})
let record = JSON.parse(localStorage.getItem(key) || 'null') ?? {
  contentKey: original.id,
  contentKind: 'item',
  lifecycle: 'active',
  revision: 1,
  versionFloor: 1,
  builtinDefinition: original,
  current: version(original, 1),
  draft: null,
  history: [version(original, 1)],
  links: [],
  usedBy: [],
}
window.imbuedOriginal = original
window.imbuedSaved = record.current.definition
const summary = () => ({
  contentKey: record.contentKey,
  contentKind: 'item',
  lifecycle: 'active',
  revision: record.revision,
  name: record.current.definition.name,
})
const nativeFetch = window.fetch.bind(window)
window.fetch = async (input, options) => {
  if (String(input) !== '/api/master/combat-content') return nativeFetch(input, options)
  const { command } = JSON.parse(options.body)
  if (command?.action === 'list') return Response.json({ records: [summary()], nextCursor: null })
  if (command?.action === 'read') return Response.json({ record })
  if (command?.action === 'commit') {
    if (command.expectedRevision !== record.revision) throw new Error('Fixture stale revision')
    const definition = parseRuntimeItemDefinition(command.definition)
    const current = version(definition, record.current.contentVersion + 1)
    record = {
      ...record,
      revision: record.revision + 1,
      current,
      draft: null,
      history: [current, ...record.history],
    }
    localStorage.setItem(key, JSON.stringify(record))
    window.imbuedSaved = definition
    return Response.json({ record })
  }
  throw new Error(`Unexpected local command ${JSON.stringify(command)}`)
}
createRoot(document.getElementById('root')).render(
  <main style={{ height: '95vh', minHeight: 0, padding: 8 }}>
    <CombatContentAuthoringWorkspace
      initialRecord={record}
      initialPage={{ records: [summary()], nextCursor: null }}
      categories={[
        { category: 'item', storedKind: 'item', label: 'Items', defaultDefinition: original },
      ]}
      recoveryScope="native-imbued-owner"
    />
    <section aria-label="Saved Item reader">
      <ItemDetails item={presentItem(record.current.definition)} />
    </section>
  </main>,
)
