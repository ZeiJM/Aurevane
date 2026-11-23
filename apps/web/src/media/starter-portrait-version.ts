/** Change with the replacement artwork URLs to bypass previously immutable portrait aliases. */
export const WAYFARER_ARTWORK_VERSION = 'wayfarer-v02'

export function starterPortraitArtworkVersion(portraitRef: string): string | null {
  const match = /^portrait\.starter\.wayfarer-(\d{2})$/u.exec(portraitRef)
  const number = match ? Number(match[1]) : 0
  return number >= 2 && number <= 40 ? WAYFARER_ARTWORK_VERSION : null
}
