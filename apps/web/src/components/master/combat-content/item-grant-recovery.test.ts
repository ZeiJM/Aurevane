import { expect, it } from 'vitest'
import { itemGrantRecoveryKey, parsePreparedItemGrant } from './item-grant-recovery'
const prepared = {
  endpoint: '/api/master/combat-content/item-grant',
  itemName: 'Saved Sword',
  recipient: 'Recipient',
  body: {
    action: 'grant',
    characterId: '00000000-0000-4000-8000-000000007002',
    itemId: 'test.sword',
    quantity: 1,
    expectedRevision: 12,
    catalogueToken: 'a'.repeat(32),
    requestId: '00000000-0000-4000-8000-000000007021',
  },
}
it('restores only the exact supported prepared grant shape and account-scoped identity', () => {
  expect(itemGrantRecoveryKey('account-a')).not.toBe(itemGrantRecoveryKey('account-b'))
  expect(itemGrantRecoveryKey('')).toBeNull()
  expect(parsePreparedItemGrant(JSON.stringify(prepared))).toEqual(prepared)
  expect(
    parsePreparedItemGrant(
      JSON.stringify({
        ...prepared,
        endpoint: '/api/master/combat-content/item-test-grant',
        body: { ...prepared.body, action: undefined },
      }),
    ),
  ).toMatchObject({ endpoint: '/api/master/combat-content/item-test-grant' })
  for (const invalid of [
    null,
    '{',
    JSON.stringify({ ...prepared, endpoint: '/api/something-else' }),
    JSON.stringify({ ...prepared, body: { ...prepared.body, userId: 'spoofed' } }),
    JSON.stringify({ ...prepared, body: { ...prepared.body, quantity: 100 } }),
    JSON.stringify({ ...prepared, body: { ...prepared.body, requestId: 'missing' } }),
  ])
    expect(parsePreparedItemGrant(invalid)).toBeNull()
})
