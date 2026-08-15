import { describe, expect, it } from 'vitest'

import { toUserActorKey } from './command'

describe('authoritative command actor keys', () => {
  it('namespaces authenticated users for persistence scopes', () => {
    expect(toUserActorKey({ userId: '54f099d3-f947-41ea-bac1-82b102643bf8' })).toBe(
      'user:54f099d3-f947-41ea-bac1-82b102643bf8',
    )
  })
})
