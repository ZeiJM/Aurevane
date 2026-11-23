import { describe, expect, it } from 'vitest'
import { paginateBattleActionReader, resolveBattleActionSelection } from './battle-action-reader'

describe('measured action reader pagination', () => {
  it('awaits asynchronous geometry before choosing a page boundary', async () => {
    const pages = await paginateBattleActionReader(
      [{ label: 'Result', text: 'ABCDEF', tone: 'damage' }],
      async (page) => page.reduce((sum, item) => sum + item.text.length, 0) <= 2,
    )
    expect(pages?.flat().map((block) => block.text)).toEqual(['AB', 'CD', 'EF'])
  })
  it('discards a cancelled pagination job instead of publishing partial pages', async () => {
    const controller = new AbortController()
    const pages = await paginateBattleActionReader(
      [{ label: 'Result', text: 'Complete result', tone: 'neutral' }],
      async () => {
        controller.abort()
        return true
      },
      controller.signal,
    )
    expect(pages).toBeNull()
  })
  it('defers pagination when available geometry cannot fit one labelled glyph', async () => {
    expect(
      await paginateBattleActionReader(
        [{ label: 'Result', text: 'Important result', tone: 'neutral' }],
        () => false,
      ),
    ).toBeNull()
  })
  it('splits long results without losing any content or tone', async () => {
    const blocks = [
      { label: 'Result', text: 'Alpha beta gamma delta epsilon', tone: 'damage' as const },
    ]
    const pages = await paginateBattleActionReader(
      blocks,
      (page) => page.reduce((total, item) => total + item.text.length, 0) <= 12,
    )
    if (!pages) throw new Error('Fixture must fit a glyph')
    expect(pages.length).toBeGreaterThan(1)
    expect(
      pages
        .flat()
        .map((item) => item.text)
        .join(''),
    ).toBe('Alpha beta gamma delta epsilon')
    expect(
      pages.every((page) => page.reduce((total, item) => total + item.text.length, 0) <= 12),
    ).toBe(true)
    expect(pages.flat().every((item) => item.tone === 'damage')).toBe(true)
  })
  it('retains every recorded result beyond presentation fact caps', async () => {
    const blocks = Array.from({ length: 9 }, (_, index) => ({
      label: 'Recorded result',
      text: `Target ${index} takes damage.`,
      tone: 'damage' as const,
    }))
    const pages = await paginateBattleActionReader(
      blocks,
      (page) => page.length <= 2 && page.every((item) => item.text.length <= 25),
    )
    if (!pages) throw new Error('Fixture must fit a glyph')
    expect(pages.every((page) => page.length <= 2)).toBe(true)
    expect(pages.flat().map((item) => item.text)).toEqual([
      'Target 0 takes damage.',
      'Target 1 takes damage.',
      'Target 2 takes damage.',
      'Target 3 takes damage.',
      'Target 4 takes damage.',
      'Target 5 takes damage.',
      'Target 6 takes damage.',
      'Target 7 takes damage.',
      'Target 8 takes damage.',
    ])
  })
  it('can page an unbroken unicode name in a very small reader', async () => {
    const pages = await paginateBattleActionReader(
      [{ label: 'Action', text: '🔥🔥🔥🔥', tone: 'neutral' }],
      (page) => page.flatMap((item) => Array.from(item.text)).length <= 1,
    )
    if (!pages) throw new Error('Fixture must fit a glyph')
    expect(pages.map((page) => page[0]?.text)).toEqual(['🔥', '🔥', '🔥', '🔥'])
  })
})

describe('live reader selection', () => {
  const turns = [
    { key: 'turn:1', actions: [{ key: 'a' }, { key: 'b' }] },
    { key: 'turn:2', actions: [{ key: 'c' }] },
  ]
  it('follows the latest action only while following live', () => {
    expect(resolveBattleActionSelection(turns, null)).toEqual({ turnIndex: 1, actionIndex: 0 })
    expect(
      resolveBattleActionSelection([...turns, { key: 'turn:3', actions: [{ key: 'd' }] }], null),
    ).toEqual({ turnIndex: 2, actionIndex: 0 })
  })
  it('pins an older turn and action during same-turn and new-turn appends', () => {
    const updated = [
      { ...turns[0]!, actions: [...turns[0]!.actions, { key: 'later' }] },
      turns[1]!,
      { key: 'turn:3', actions: [{ key: 'd' }] },
    ]
    expect(resolveBattleActionSelection(updated, { turnKey: 'turn:1', actionKey: 'a' })).toEqual({
      turnIndex: 0,
      actionIndex: 0,
    })
  })
  it('pins an older action in the latest turn during appends', () => {
    expect(
      resolveBattleActionSelection([{ key: 'turn:2', actions: [{ key: 'c' }, { key: 'later' }] }], {
        turnKey: 'turn:2',
        actionKey: 'c',
      }),
    ).toEqual({ turnIndex: 0, actionIndex: 0 })
  })
})
