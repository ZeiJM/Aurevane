import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { PersonalInventoryRestoration } from '@aurevane/game-core/events/persistent-event'
import { InventoryRestorationFields } from './inventory-restoration-fields'

const restoration: PersonalInventoryRestoration = {
  giverNpcId: '00000000-0000-4000-8000-000000000001',
  checkpoint: { sectorId: 'crown-road', x: 7, y: 4 },
  outputItemId: 'fixture.restored-weapon',
  offer: 'Bring your discovery to the smith.',
  travel: 'Follow the road to the checkpoint.',
  ready: 'Hand in the two fragments.',
  completed: 'Your weapon is restored.',
}

describe('inventory restoration authoring', () => {
  it('keeps a discovery-only draft collapsed and gates adding a recovery route', () => {
    const markup = (canUseGlobalScope: boolean) =>
      renderToStaticMarkup(
        <InventoryRestorationFields
          canUseGlobalScope={canUseGlobalScope}
          storyNpcs={null}
          change={() => {}}
        />,
      )
    expect(markup(true)).toContain('Enable a recovery route')
    expect(markup(true)).not.toContain('Restoration giver')
    expect(markup(true)).not.toContain('disabled')
    expect(markup(false)).toContain('disabled=""')
  })

  it('renders a saved route with its published NPC, non-region checkpoint, weapon and dialogue', () => {
    const html = renderToStaticMarkup(
      <InventoryRestorationFields
        value={restoration}
        canUseGlobalScope
        storyNpcs={[
          { id: restoration.giverNpcId, name: 'Restoration Smith', portraitRef: null, revision: 1 },
        ]}
        change={() => {}}
      />,
    )
    expect(html).toContain('<legend>Restoration checkpoint</legend>')
    expect(html).toContain('value="crown-road" selected="">Crown Road')
    expect(html).toContain(`value="${restoration.giverNpcId}" selected="">Restoration Smith`)
    expect(html).toContain('value="fixture.restored-weapon"')
    expect(html).toContain('value="7"')
    expect(html).toContain('value="4"')
    expect(html).toContain('Recovery offer')
    expect(html).toContain('Recovery guidance')
    expect(html).toContain('Ready to restore')
    expect(html).toContain('Restoration completion')
    for (const text of [
      restoration.offer,
      restoration.travel,
      restoration.ready,
      restoration.completed,
    ])
      expect(html).toContain(text)
    expect(html).toContain('private to characters who discover the clue')
  })

  it('preserves an existing giver reference when the NPC catalogue is unavailable', () => {
    const html = renderToStaticMarkup(
      <InventoryRestorationFields
        value={restoration}
        canUseGlobalScope={false}
        storyNpcs="unavailable"
        change={() => {}}
      />,
    )
    expect(html).toContain(`value="${restoration.giverNpcId}" selected="">Saved NPC reference`)
    expect(html).toContain('Story NPCs could not be loaded.')
    expect(html).toContain('checked=""')
    expect(html).not.toContain('disabled')
  })
})
