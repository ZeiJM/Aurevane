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
