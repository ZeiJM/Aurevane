/** Synchronous ownership prevents rapid hover/focus/click opens from racing React effects. */
export function createBattleInfoPopoverSession() {
  let active: { id: string; dismiss: () => void } | null = null
  return {
    open(id: string, dismiss: () => void) {
      const previous = active
      active = { id, dismiss }
      if (previous && previous.id !== id) previous.dismiss()
    },
    close(id: string) {
      if (active?.id === id) active = null
    },
    dismissActive() {
      const previous = active
      active = null
      previous?.dismiss()
    },
    isActive(id: string) {
      return active?.id === id
    },
  }
}

export const battleInfoPopoverSession = createBattleInfoPopoverSession()
