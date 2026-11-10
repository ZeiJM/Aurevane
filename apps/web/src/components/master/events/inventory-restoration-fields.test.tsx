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
          rewards={[]}
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
        rewards={[]}
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

  it('keeps optional trial details collapsed for recovery-only drafts', () => {
    const html = renderToStaticMarkup(
      <InventoryRestorationFields
        value={restoration}
        canUseGlobalScope
        storyNpcs={[]}
        rewards={[]}
        change={() => {}}
      />,
    )
    expect(html).toContain('Enable a combat trial')
    expect(html).not.toContain('Trial encounter NPC')
    expect(html).not.toContain('Recovery Character XP package')
  })

  it('reopens trial dialogue and both saved branch rewards without clearing a saved NPC', () => {
    const npcId = '88888888-8888-4888-8888-888888888888'
    const html = renderToStaticMarkup(
      <InventoryRestorationFields
        value={{
          ...restoration,
          recoveryRewardPackageRef: 'reward.recovery',
          trial: {
            npcId,
            offer: 'Challenge the forge sentinel.',
            active: 'Win the fight and return.',
            ready: 'The forge is ready for you.',
            rewardPackageRef: 'reward.trial',
          },
        }}
        canUseGlobalScope
        storyNpcs={[]}
        rewards={[
          { key: 'reward.recovery', label: '10 Character XP · v1', budget: 'budget.recovery' },
          { key: 'reward.trial', label: '25 Character XP · v1', budget: 'budget.trial' },
        ]}
        change={() => {}}
      />,
    )
    expect(html).toContain('<legend>Combat trial</legend>')
    expect(html).toContain(`value="${npcId}" selected="">Saved NPC`)
    expect(html).toContain('value="reward.recovery" selected="">10 Character XP')
    expect(html).toContain('value="reward.trial" selected="">25 Character XP')
    expect(html).toContain('Challenge the forge sentinel.')
    expect(html).toContain('Win the fight and return.')
    expect(html).toContain('The forge is ready for you.')
  })

  it('preserves an existing giver reference when the NPC catalogue is unavailable', () => {
    const html = renderToStaticMarkup(
      <InventoryRestorationFields
        value={restoration}
        canUseGlobalScope={false}
        storyNpcs="unavailable"
        rewards={[]}
        change={() => {}}
      />,
    )
    expect(html).toContain(`value="${restoration.giverNpcId}" selected="">Saved NPC reference`)
    expect(html).toContain('Story NPCs could not be loaded.')
    expect(html).toContain('checked=""')
    expect(html).toMatch(/disabled=[^>]*\/>Enable a combat trial/)
  })
})
