import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ContentDefinitionFields } from '@/components/master/combat-content/content-definition-fields'
import { ItemDetails } from '@/components/character/item-details'
import { presentItem } from '@/lib/items/item-presentation'
import { itemFixture } from '@aurevane/game-core/content/items-test-fixtures'
import { parseRuntimeItemDefinition } from '@aurevane/game-core/content/items'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import './production-styles'
const key = 'runtime-item-editor-native'
const ability = defaultBasicSkills().find((row) => row.id === 'basic.recover').ability
const original = itemFixture({
  name: 'Native Draught',
  media: { artworkId: 'environment.entry.gateway' },
  inventoryCategory: 'battle-items',
  itemClass: 'battle-item',
  equipment: { slot: 'hand', hands: 1 },
  maximumStack: 99,
  battleUses: 3,
  ability,
  actions: { use: { behaviorId: ability.behaviors[0].id, name: 'Drink' } },
})
function App() {
  const [value, setValue] = useState(
    () => JSON.parse(localStorage.getItem(key) || 'null') ?? original,
  )
  const [saved, setSaved] = useState(value),
    [error, setError] = useState('')
  return (
    <main style={{ maxWidth: 950, margin: 'auto', padding: 12 }}>
      <section aria-label="Master Item editor">
        <ContentDefinitionFields kind="item" tab="Parameters" value={value} onChange={setValue} />
        <button
          onClick={() => {
            try {
              const next = parseRuntimeItemDefinition(value)
              localStorage.setItem(key, JSON.stringify(next))
              setSaved(next)
              setError('')
            } catch (cause) {
              setError(cause.message)
            }
          }}
        >
          Save definition JSON
        </button>
        {error ? <p role="alert">{error}</p> : null}
      </section>
      <section aria-label="Saved player Item reader">
        <ItemDetails item={presentItem(saved)} />
      </section>
    </main>
  )
}
createRoot(document.getElementById('root')).render(<App />)
