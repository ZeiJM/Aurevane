import { expect, it } from 'vitest'
import {
  defaultBattlefieldElevationPolicy,
  parseBattlefieldElevationPolicy,
} from './standard-battlefield'

it('returns independent default policies and accepts exact fractional chances', () => {
  const policy = defaultBattlefieldElevationPolicy()
  expect(policy).toEqual({
    version: 1,
    level1BasisPoints: 6000,
    level2BasisPoints: 3000,
    level3BasisPoints: 1000,
  })
  expect(defaultBattlefieldElevationPolicy()).not.toBe(policy)
  expect(
    parseBattlefieldElevationPolicy({
      ...policy,
      level1BasisPoints: 1234,
      level2BasisPoints: 8766,
      level3BasisPoints: 0,
    }),
  ).toEqual({ ...policy, level1BasisPoints: 1234, level2BasisPoints: 8766, level3BasisPoints: 0 })
})
it.each([
  null,
  [],
  {},
  { version: 1, level1BasisPoints: 6000, level2BasisPoints: 3000, level3BasisPoints: 999 },
  { version: 0, level1BasisPoints: 10000, level2BasisPoints: 0, level3BasisPoints: 0 },
  { version: 1, level1BasisPoints: 10001, level2BasisPoints: -1, level3BasisPoints: 0 },
  { version: 1, level1BasisPoints: 9999.5, level2BasisPoints: 0.5, level3BasisPoints: 0 },
  { version: 1, level1BasisPoints: 10000, level2BasisPoints: 0, level3BasisPoints: 0, unknown: 1 },
])('rejects malformed policy %j', (value) =>
  expect(() => parseBattlefieldElevationPolicy(value)).toThrow(),
)
