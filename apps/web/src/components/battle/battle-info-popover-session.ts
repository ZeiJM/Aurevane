type Reader = { id: string; dismiss: () => void }
/** One primary reader and at most one compact child; ownership changes before callbacks run. */
export function createBattleInfoPopoverSession() {
  let active: Reader | null = null
  let child: Reader | null = null
  return {
    open(id: string, dismiss: () => void, parentId?: string | null): boolean {
      if (parentId) {
        if (active?.id !== parentId || id === parentId) return false
        const previous = child
        child = { id, dismiss }
        if (previous && previous.id !== id) previous.dismiss()
        return true
      }
      if (active?.id === id) {
        active = { id, dismiss }
        return true
      }
      const previous = active
      const previousChild = child
      active = { id, dismiss }
      child = null
      previousChild?.dismiss()
      previous?.dismiss()
      return true
    },
    close(id: string) {
      if (child?.id === id) child = null
      else if (active?.id === id) {
        const previousChild = child
        active = null
        child = null
        previousChild?.dismiss()
      }
    },
    dismissActive() {
      const previous = active
      const previousChild = child
      active = null
      child = null
      previousChild?.dismiss()
      previous?.dismiss()
    },
    isActive(id: string) {
      return (child ?? active)?.id === id
    },
    hasChild(id: string) {
      return active?.id === id && child !== null
    },
  }
}

export const battleInfoPopoverSession = createBattleInfoPopoverSession()
