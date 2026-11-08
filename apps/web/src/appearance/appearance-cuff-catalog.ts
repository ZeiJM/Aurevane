import { supportsLowerGarment } from './appearance-lower-catalog'

export const CUFFS = ['folded', 'flared', 'braced'] as const

export type Cuff = (typeof CUFFS)[number]
export type CuffChoice = Cuff | 'original'

export const CUFF_LABELS: Readonly<Record<CuffChoice, string>> = {
  original: 'Original cuffs',
  folded: 'Turned-back cuffs',
  flared: 'Flared cuffs',
  braced: 'Plated bracers',
}

// These tops expose and animate a separate forearm layer. The bolero has bare arms.
export function supportsCuff(coat: string) {
  return coat !== 'bolero' && supportsLowerGarment(coat)
}
