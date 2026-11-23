import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { initialPersonalJourney } from './personal-journey-fields'
import { RepeatableTravelFields } from './repeatable-travel-fields'

it('reopens a hunt with its published giver, defeat quota and saved reward', () => {
  const giverId = '77777777-7777-4777-8777-777777777777'
  const rewardPackageRef = 'reward.alder-venn-hunt'
  const html = renderToStaticMarkup(
    <RepeatableTravelFields
      value={{
        journey: {
          type: 'defeat-and-report',
          giverId,
          npcTag: 'wolf',
          requiredDefeats: 5,
          rewardPackageRef,
          offer: 'Keep the wolves away from the pasture.',
          active: 'Defeat five wolves.',
          ready: 'Report your hunt.',
          completed: 'The pasture is safe.',
        },
        recurrence: { mode: 'calendar-day', timeZone: 'America/Port_of_Spain', resetMinute: 240 },
      }}
      storyNpcs={[{ id: giverId, name: 'Alder Venn', portraitRef: null, revision: 1 }]}
      rewards={[{ key: rewardPackageRef, label: '10 Character XP · v1', budget: 'budget.hunt' }]}
      change={() => {}}
    />,
  )
  expect(html).toContain('Enable repeatable activity')
  expect(html).toContain('value="defeat-and-report" selected="">Defeat and report')
  expect(html).toContain(`value="${giverId}" selected="">Alder Venn`)
  expect(html).toContain('World encounter tag')
  expect(html).toContain('value="wolf"')
  expect(html).toContain('Required defeats')
  expect(html).toContain('value="5"')
  expect(html).toContain(`value="${rewardPackageRef}" selected=""`)
  expect(html).toContain('value="04:00"')
  expect(html).toContain('Defeat five wolves.')
  expect(html).not.toContain('<legend>Destination</legend>')
})

it('keeps the destination and rolling cooldown for older travel drafts', () => {
  const html = renderToStaticMarkup(
    <RepeatableTravelFields
      value={{ journey: initialPersonalJourney, recurrence: { mode: 'rolling-24h' } }}
      storyNpcs={[]}
      rewards={[]}
      change={() => {}}
    />,
  )
  expect(html).toContain('<legend>Destination</legend>')
  expect(html).toContain('value="rolling-24h" selected=""')
  expect(html).not.toContain('World encounter tag')
})
