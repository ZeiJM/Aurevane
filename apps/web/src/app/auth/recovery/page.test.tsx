import { describe, expect, it } from 'vitest'
import Recovery from './page'

describe('scanner-safe recovery landing', () => {
  it('renders an explicit continuation without verifying or granting a recovery session', async () => {
    for (let visit = 0; visit < 2; visit += 1) {
      const page = await Recovery({
        searchParams: Promise.resolve({ token_hash: 'an-opaque-recovery-token-hash' }),
      })
      expect(page.props.authConfig).toBeNull()
      expect(page.props.children.props.tokenHash).toBe('an-opaque-recovery-token-hash')
    }
  })
  it.each([undefined, 'short', ['an-opaque-recovery-token-hash', 'second-token']])(
    'does not offer verification for malformed transport %j',
    async (token_hash) => {
      const page = await Recovery({ searchParams: Promise.resolve({ token_hash }) })
      expect(page.props.children.props.tokenHash).toBeNull()
    },
  )
})
