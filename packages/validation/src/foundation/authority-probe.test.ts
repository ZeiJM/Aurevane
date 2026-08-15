import { describe, expect, it } from 'vitest'

import {
  parseAuthorityProbePersistenceRows,
  parseAuthorityProbeRequest,
} from './authority-probe'

describe('authority probe validation', () => {
  it('accepts a strict UUID idempotency request', () => {
    expect(
      parseAuthorityProbeRequest({
        idempotencyKey: '22ba2ea8-d9a1-4c63-8392-227877a73337',
      }),
    ).toEqual({ idempotencyKey: '22ba2ea8-d9a1-4c63-8392-227877a73337' })
  })

  it('rejects malformed or unexpected request fields', () => {
    expect(parseAuthorityProbeRequest({ idempotencyKey: 'not-a-uuid' })).toBeNull()
    expect(
      parseAuthorityProbeRequest({
        idempotencyKey: '22ba2ea8-d9a1-4c63-8392-227877a73337',
        trustedResult: true,
      }),
    ).toBeNull()
  })

  it('accepts exactly one well-formed persistence row', () => {
    expect(
      parseAuthorityProbePersistenceRows([
        {
          receipt_id: '6093e994-a0ca-4aae-85b9-d44cb428cfc0',
          accepted_at: '2026-08-15T20:50:00+00:00',
          replayed: false,
        },
      ]),
    ).toMatchObject({ replayed: false })
  })
})
