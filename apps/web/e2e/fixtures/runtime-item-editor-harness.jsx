import React, { useEffect, useState } from 'react'
import workspaceStyles from '@/components/master/combat-content/game-content-workspace.module.css'
import { createRoot } from 'react-dom/client'
import { ContentDefinitionFields } from '@/components/master/combat-content/content-definition-fields'
import { ItemDetails } from '@/components/character/item-details'
import { presentItem } from '@/lib/items/item-presentation'
import { starterItemDefinitions } from '@aurevane/game-core/content/starter-items'
import { parseRuntimeItemDefinition } from '@aurevane/game-core/content/items'
import './production-styles'
const key = `runtime-item-editor-native:${new URLSearchParams(location.search).get('item') ?? 'mender-salve'}`
const fixtureId = new URLSearchParams(location.search).get('item') ?? 'mender-salve'
const original = {
  ...starterItemDefinitions().find((item) => item.id === fixtureId),
  sortOrder: 317,
}
if (new URLSearchParams(location.search).get('binding') === 'missing')
  original.actions = {
    ...original.actions,
    attack: { ...original.actions.attack, behaviorId: 'missing-private-id' },
  }
if (new URLSearchParams(location.search).get('ability') === 'missing') {
  original.ability = null
  original.actions = {}
}
if (new URLSearchParams(location.search).has('legacy-active')) {
  const active = starterItemDefinitions()
    .find((item) => item.id === 'emberbrand')
    .ability.behaviors.find((group) => group.id === 'kindle')
  original.actions = { support: { behaviorId: active.id, name: 'Old Prayer' } }
  original.ability = { ...original.ability, behaviors: [...original.ability.behaviors, active] }
}
function App() {
  const [value, setValue] = useState(
    () => JSON.parse(localStorage.getItem(key) || 'null') ?? original,
  )
  const [saved, setSaved] = useState(value),
    [error, setError] = useState('')
  useEffect(() => {
    window.itemEditorValue = value
  }, [value])
  return (
    <main style={{ maxWidth: 950, margin: 'auto', padding: 12 }}>
      <section aria-label="Master Item editor" className={workspaceStyles.workspace}>
        <div className={workspaceStyles.modalBody} style={{ maxHeight: '80vh' }}>
          <ContentDefinitionFields
            kind="item"
            tab="Parameters"
            value={value}
            onChange={setValue}
            choices={[
              {
                contentKey: 'discipline.fixture-artificer',
                contentKind: 'discipline',
                name: 'Fixture Artificer',
              },
            ]}
          />
        </div>
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
