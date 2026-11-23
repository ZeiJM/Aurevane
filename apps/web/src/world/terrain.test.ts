import { expect, it } from 'vitest'
import { decodeTerrainRows, encodeTerrainRows } from './terrain'
it('losslessly compresses long public ground runs without changing collision characters', () => {
  const rows = [
    '.............',
    'ttttttttttttt',
    '~~~~~~~~~~~~~',
    'lllllllllllll',
    'bbbbbbbbbbbbb',
    'sssssssssssss',
    '=============',
    '#############',
    '.............',
  ]
  const encoded = encodeTerrainRows(rows)
  expect(encoded.length).toBeLessThan(117)
  expect(decodeTerrainRows(encoded, 117)).toBe(rows.join(''))
})
it('keeps mixed terrain raw when runs would increase the packet size', () => {
  const rows = Array.from({ length: 9 }, () => '.t.t.t.t.t.t.')
  expect(encodeTerrainRows(rows)).toBe(rows.join(''))
  expect(decodeTerrainRows(rows.join(''), 117)).toBe(rows.join(''))
})
it.each(['!0.', '!118.', '!99999999999999999999.', '!117.1t', '!117.extra', 'short'])(
  'rejects malformed or oversized public terrain %s',
  (encoded) => {
    expect(decodeTerrainRows(encoded, 117)).toBeNull()
  },
)
