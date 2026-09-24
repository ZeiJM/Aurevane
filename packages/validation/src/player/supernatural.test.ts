import { describe, expect, it } from 'vitest'

import {
  parseAuthoredSupernaturalTransitionRequest,
  parseSupernaturalStoryStateRow,
  parseSupernaturalStoryTransitionRow,
} from './supernatural'

const base = {
  character_id: '00000000-0000-4000-8000-000000000901',
  schema_version: 1,
  state_version: 1,
  story_id: 'supernatural.main',
  story_version: 1,
  node_id: 'awakening.threshold',
  path: 'unawakened' as const,
  ascension_id: null,
  ascension_content_version: null,
  severence_id: null,
  severence_content_version: null,
  chosen_at: null,
  updated_at: '2026-09-23T12:00:00.000Z',
}

describe('supernatural persistence validation', () => {
  it('accepts the strict Unawakened persistence shape', () => {
    expect(parseSupernaturalStoryStateRow(base)).toEqual(base)
  })

  it('accepts exactly one Ascension reference for Ascended state', () => {
    expect(
      parseSupernaturalStoryStateRow({
        ...base,
        state_version: 2,
        path: 'ascended',
        ascension_id: 'ascension.proof',
        ascension_content_version: 1,
        chosen_at: '2026-09-23T12:05:00.000Z',
      }),
    ).toMatchObject({ path: 'ascended', ascension_id: 'ascension.proof' })
  })

  it('accepts exactly one Severence reference for Severed state', () => {
    expect(
      parseSupernaturalStoryStateRow({
        ...base,
        state_version: 2,
        path: 'severed',
        severence_id: 'severence.proof',
        severence_content_version: 1,
        chosen_at: '2026-09-23T12:05:00.000Z',
      }),
    ).toMatchObject({ path: 'severed', severence_id: 'severence.proof' })
  })

  it('rejects cross-path or partially-bound persistence rows', () => {
    expect(
      parseSupernaturalStoryStateRow({
        ...base,
        path: 'ascended',
        ascension_id: 'ascension.proof',
        ascension_content_version: 1,
        severence_id: 'severence.proof',
        severence_content_version: 1,
        chosen_at: '2026-09-23T12:05:00.000Z',
      }),
    ).toBeNull()

    expect(
      parseSupernaturalStoryStateRow({
        ...base,
        path: 'severed',
        severence_id: 'severence.proof',
        severence_content_version: null,
        chosen_at: '2026-09-23T12:05:00.000Z',
      }),
    ).toBeNull()
  })

  it('rejects extra fields so future schema drift fails closed', () => {
    expect(parseSupernaturalStoryStateRow({ ...base, client_override: true })).toBeNull()
  })

  it('validates transition receipts with an explicit replay marker', () => {
    expect(parseSupernaturalStoryTransitionRow({ ...base, replayed: true })).toMatchObject({
      replayed: true,
      path: 'unawakened',
    })
    expect(parseSupernaturalStoryTransitionRow(base)).toBeNull()
  })

describe('authored supernatural transition request validation', () => {
  const request = {
    expectedStateVersion: 1,
    idempotencyKey: '00000000-0000-4000-8000-000000000919',
    transitionId: 'supernatural.main.choose-ascension',
    transitionContentVersion: 1,
  }

  it('accepts only the exact server-resolvable transition reference shape', () => {
    expect(parseAuthoredSupernaturalTransitionRequest(request)).toEqual(request)
  })

  it('rejects malformed, extra or caller-authored transition payloads', () => {
    for (const invalid of [
      { ...request, expectedStateVersion: 0 },
      { ...request, transitionContentVersion: 0 },
      { ...request, idempotencyKey: 'not-a-uuid' },
      { ...request, transitionId: 'Ascension Choice' },
      { ...request, transition: { result: { path: 'ascended' } } },
    ])
      expect(parseAuthoredSupernaturalTransitionRequest(invalid)).toBeNull()
  })
})
