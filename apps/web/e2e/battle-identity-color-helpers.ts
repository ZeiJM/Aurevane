import { expect, type Locator } from '@playwright/test'

/** Check the mounted cascade, including the shared playable and spectator surfaces. */
export async function expectCombatantIdentityColors(root: Locator) {
  await expect
    .poll(
      async () =>
        root.evaluate((element) => {
          const cards = [...element.querySelectorAll<HTMLElement>('[data-battle-combatant-card]')]
          return (
            cards.length >= 2 &&
            cards.every((card) => {
              const name = card.querySelector<HTMLElement>('header strong')?.title
              const portrait = card.querySelector<HTMLElement>(
                'button[data-desktop-inspect-combatant]',
              )
              const facing = card.querySelector<HTMLElement>('header [aria-label*=" facing "]')
              const tile = [
                ...element.querySelectorAll<HTMLElement>(
                  '#battlefield button[aria-label*="occupied by"]',
                ),
              ].find(
                (tile) => name && tile.getAttribute('aria-label')?.includes(`occupied by ${name}`),
              )
              const token = tile?.querySelector<HTMLElement>(':scope > [data-team]')
              const arrow =
                tile?.querySelector<HTMLElement>(':scope > [data-battle-facing-indicator]') ??
                token?.querySelector<HTMLElement>(':scope > i')
              if (!portrait || !facing || !token || !arrow) return false
              const accent = getComputedStyle(card).borderTopColor
              return (
                getComputedStyle(portrait).borderTopColor === accent &&
                getComputedStyle(facing).color === accent &&
                getComputedStyle(token).borderTopColor === accent &&
                getComputedStyle(arrow).color === accent
              )
            })
          )
        }),
      {
        message: 'Rail portraits and facing arrows must match their combatant token identity color',
      },
    )
    .toBe(true)
}
