import Image from 'next/image'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useCallback: (callback: unknown) => callback,
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => string) => snapshot(),
}))
import { useSelectedBattleItem } from './use-selected-battle-item'
import type { BattleItemPresentation } from '@/lib/battle/battle-item-presentation'
const items = [
  { actionId: 'item.salve.consumable-1.use', name: 'Salve', artworkSrc: '/salve.webp' },
  { actionId: 'item.salve.consumable-2.use', name: 'Salve', artworkSrc: '/second.webp' },
] as BattleItemPresentation[]
type Props = Record<string, unknown> & { children?: ReactNode }
function nodes(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(nodes)
  return isValidElement<Props>(node) ? [node, ...nodes(node.props.children)] : []
}
function Selection({
  battleId,
  actorId,
  choices = items,
}: {
  battleId: string
  actorId: string
  choices?: readonly BattleItemPresentation[]
}) {
  const [selected, choose] = useSelectedBattleItem(battleId, actorId, choices)
  return (
    <div>
      <output>{selected?.actionId ?? 'None'}</output>
      {selected?.artworkSrc ? (
        <Image alt={selected.name} src={selected.artworkSrc} width={28} height={28} unoptimized />
      ) : null}
      {choices.map((item) => (
        <button key={item.actionId} onClick={() => choose(item.actionId)}>
          {item.actionId}
        </button>
      ))}
    </div>
  )
}
beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('window', {
    location: { href: 'https://example.test/battle' },
    sessionStorage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
    },
  })
})
afterEach(() => vi.unstubAllGlobals())
it('remembers the exact captured action for this battle and actor and falls back when that action is removed', () => {
  const render = (actorId = 'actor-a', battleId = 'battle-choice-a', choices = items) =>
    Selection({ battleId, actorId, choices })
  ;(nodes(render()).filter((node) => node.type === 'button')[1]!.props.onClick as () => void)()
  expect(renderToStaticMarkup(render())).toContain('/second.webp')
  expect(renderToStaticMarkup(render('actor-b'))).toContain('/salve.webp')
  expect(renderToStaticMarkup(render('actor-a', 'battle-choice-b'))).toContain('/salve.webp')
  expect(renderToStaticMarkup(render('actor-a', 'battle-choice-a', [items[0]!]))).not.toContain(
    '/second.webp',
  )
  expect(renderToStaticMarkup(render('actor-a', 'battle-choice-a', []))).toContain('None')
})
it('keeps the latest selected artwork usable when browser preference storage is unavailable', () => {
  vi.stubGlobal('window', {
    location: { href: 'https://example.test/battle' },
    sessionStorage: {
      getItem() {
        throw new Error('unavailable')
      },
      setItem() {
        throw new Error('unavailable')
      },
    },
  })
  const render = () => Selection({ battleId: 'battle-choice-no-storage', actorId: 'actor-a' })
  ;(nodes(render()).filter((node) => node.type === 'button')[1]!.props.onClick as () => void)()
  expect(renderToStaticMarkup(render())).toContain('/second.webp')
})
