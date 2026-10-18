import { describe, expect, it } from 'vitest'
import { createBattleInfoPopoverSession } from './battle-info-popover-session'

describe('shared information reader ownership', () => {
  it('dismisses the previous reader synchronously on every new open', () => {
    const session = createBattleInfoPopoverSession()
    const closed: string[] = []
    session.open('pinned', () => closed.push('pinned'))
    session.open('hover', () => closed.push('hover'))
    session.open('focus', () => closed.push('focus'))
    expect(closed).toEqual(['pinned', 'hover'])
    expect(session.isActive('focus')).toBe(true)
    expect(session.isActive('pinned')).toBe(false)
  })

  it('keeps the new reader owned when the old reader cleans up during handoff', () => {
    const session = createBattleInfoPopoverSession()
    session.open('old', () => session.close('old'))
    session.open('new', () => session.close('new'))
    session.close('old')
    expect(session.isActive('new')).toBe(true)
    session.close('new')
    expect(session.isActive('new')).toBe(false)
  })

  it('does not dismiss the same reader when hover becomes pinned', () => {
    const session = createBattleInfoPopoverSession()
    let closed = false
    session.open('reader', () => {
      closed = true
    })
    session.open('reader', () => {
      closed = true
    })
    expect(closed).toBe(false)
    expect(session.isActive('reader')).toBe(true)
  })

  it('releases ownership before synchronously dismissing the active reader', () => {
    const session = createBattleInfoPopoverSession()
    let dismissals = 0
    session.open('reader', () => {
      expect(session.isActive('reader')).toBe(false)
      dismissals++
      session.close('reader')
    })
    expect(session).toHaveProperty('dismissActive')
    session.dismissActive()
    session.dismissActive()
    expect(dismissals).toBe(1)
    expect(session.isActive('reader')).toBe(false)
  })

  it('preserves a reader opened reentrantly during active dismissal', () => {
    const session = createBattleInfoPopoverSession()
    const dismissed: string[] = []
    session.open('old', () => {
      dismissed.push('old')
      session.open('nested', () => dismissed.push('nested'))
      session.close('old')
    })
    expect(session).toHaveProperty('dismissActive')
    session.dismissActive()
    expect(dismissed).toEqual(['old'])
    expect(session.isActive('nested')).toBe(true)
    session.dismissActive()
    expect(dismissed).toEqual(['old', 'nested'])
    expect(session.isActive('nested')).toBe(false)
  })
})

it('keeps the parent open while a single child explanation owns dismissal', () => {
  const session = createBattleInfoPopoverSession()
  const closed: string[] = []
  session.open('parent', () => closed.push('parent'))
  session.open('term', () => closed.push('term'), 'parent')
  expect(closed).toEqual([])
  expect(session.isActive('term')).toBe(true)
  session.close('term')
  expect(session.isActive('parent')).toBe(true)
})
it('replaces only the sibling explanation and keeps parent reopen events from dismissing it', () => {
  const session = createBattleInfoPopoverSession()
  const closed: string[] = []
  session.open('parent', () => closed.push('parent'))
  session.open(
    'one',
    () => {
      closed.push('one')
      session.close('one')
    },
    'parent',
  )
  session.open('two', () => closed.push('two'), 'parent')
  expect(closed).toEqual(['one'])
  session.open('parent', () => closed.push('parent'))
  expect(session.isActive('two')).toBe(true)
  expect(closed).toEqual(['one'])
})
it('cleans up the child when its parent closes or an unrelated reader takes ownership', () => {
  const session = createBattleInfoPopoverSession()
  const closed: string[] = []
  session.open('parent', () => {
    closed.push('parent')
    session.close('parent')
  })
  session.open(
    'term',
    () => {
      closed.push('term')
      session.close('term')
    },
    'parent',
  )
  session.open('other', () => closed.push('other'))
  expect(closed).toEqual(['term', 'parent'])
  expect(session.isActive('other')).toBe(true)
  session.close('other')
  session.open('parent', () => closed.push('parent'))
  session.open('term', () => closed.push('term'), 'parent')
  session.close('parent')
  expect(session.isActive('term')).toBe(false)
  expect(closed.at(-1)).toBe('term')
})
it('rejects orphaned references and deeper nesting while preserving the active pair', () => {
  const session = createBattleInfoPopoverSession()
  const closed: string[] = []
  session.open('parent', () => closed.push('parent'))
  session.open('term', () => closed.push('term'), 'parent')
  expect(closed).toEqual([])
  expect(session.open('orphan', () => closed.push('orphan'), 'missing')).toBe(false)
  expect(session.open('deep', () => closed.push('deep'), 'term')).toBe(false)
  expect(session.isActive('term')).toBe(true)
})
it('dismisses the whole pair for existing global inspection handoffs, releasing ownership first', () => {
  const session = createBattleInfoPopoverSession()
  const closed: string[] = []
  session.open('parent', () => {
    expect(session.isActive('parent')).toBe(false)
    closed.push('parent')
  })
  session.open(
    'term',
    () => {
      expect(session.isActive('term')).toBe(false)
      closed.push('term')
    },
    'parent',
  )
  expect(closed).toEqual([])
  session.dismissActive()
  expect(closed).toEqual(['term', 'parent'])
  expect(session.isActive('parent')).toBe(false)
})

it('retains an unrelated reader opened reentrantly while dismissing a whole pair', () => {
  const session = createBattleInfoPopoverSession()
  session.open('parent', () => session.close('parent'))
  session.open(
    'term',
    () => {
      session.open('replacement', () => undefined)
      session.close('term')
    },
    'parent',
  )
  session.dismissActive()
  expect(session.isActive('replacement')).toBe(true)
})
