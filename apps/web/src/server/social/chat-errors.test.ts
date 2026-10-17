import { AurevaneError } from '@aurevane/game-core/errors'
import { describe, expect, it } from 'vitest'

import { mapChatRpcError } from './chat-errors'

function mapped(error: { code?: string; message?: string }) {
  try {
    mapChatRpcError(error)
  } catch (thrown) {
    return thrown as AurevaneError
  }
  throw new Error('expected an error')
}

describe('chat RPC error mapping', () => {
  it('turns limits into readable, player-safe messages', () => {
    expect(mapped({ message: 'CHAT_RATE_LIMITED' }).publicMessage).toMatch(/too quickly/)
    expect(mapped({ message: 'CHAT_REACTION_RATE_LIMITED' }).publicMessage).toMatch(/Too many reactions/)
    expect(mapped({ message: 'CHAT_FRIEND_LIMIT' }).publicMessage).toMatch(/\(10\)/)
    expect(mapped({ message: 'CHAT_GROUP_FULL' }).publicMessage).toMatch(/10 people/)
  })

  it('distinguishes the friend limits of the two players', () => {
    expect(mapped({ message: 'CHAT_OTHER_FRIEND_LIMIT' }).publicMessage).toMatch(/That player/)
    expect(mapped({ message: 'CHAT_FRIEND_LIMIT' }).publicMessage).toMatch(/Your friend list/)
  })

  it('maps permission failures to FORBIDDEN', () => {
    expect(mapped({ message: 'CHAT_FORBIDDEN' }).code).toBe('FORBIDDEN')
    expect(mapped({ code: '42501', message: 'anything' }).code).toBe('FORBIDDEN')
    expect(mapped({ message: 'CHAT_INVITE_NOT_ALLOWED' }).code).toBe('FORBIDDEN')
  })

  it('never leaks database details for unknown failures', () => {
    const error = mapped({ code: 'XX000', message: 'relation app_private.chat_messages is broken' })
    expect(error.code).toBe('PERSISTENCE_UNAVAILABLE')
    expect(error.publicMessage).not.toMatch(/app_private|relation/)
  })
})
