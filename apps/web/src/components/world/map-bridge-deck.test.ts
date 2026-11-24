import { expect, it } from 'vitest'
import { bridgeDeckPoint, type BridgeDeck } from './map-bridge-deck'

it.each(['footbridge', 'timber', 'stone', 'causeway'] as const)(
  'walks continuously from bank to bank and picks the original lane on the %s',
  (profile) => {
    for (const along of ['x', 'y'] as const) {
      const deck: BridgeDeck = {
        point: { x: 10.5, y: 20.5 },
        along,
        span: 6,
        profile,
        left: 1.5,
        right: 0.5,
      }
      const across = along === 'x' ? 'y' : 'x'
      for (let step = 0; step <= 48; step++) {
        for (const offset of [-1, 0, 0.4]) {
          const ground = { ...deck.point }
          ground[along] += step / 8 - 3
          ground[across] += offset
          const tread = bridgeDeckPoint(deck, ground)!
          const picked = bridgeDeckPoint(deck, tread, true)!
          expect(picked.x).toBeCloseTo(ground.x, 8)
          expect(picked.y).toBeCloseTo(ground.y, 8)
          if (step === 0 || step === 48) expect(tread).toEqual(ground)
          else if (step === 24 && offset === 0) expect(tread[along]).toBeLessThan(ground[along])
        }
      }
      expect(bridgeDeckPoint(deck, { ...deck.point, [across]: deck.point[across] + 1 })).toBeNull()
    }
  },
)
