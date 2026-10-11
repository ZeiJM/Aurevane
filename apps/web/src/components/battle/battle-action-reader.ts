import type { BattleLogTone } from '@/server/battle/battle-log-service'

export interface BattleActionReaderBlock {
  label: string
  text: string
  tone: BattleLogTone
}
export interface BattleActionReaderSelection {
  turnKey: string
  actionKey: string | null
}
export async function paginateBattleActionReader(
  blocks: readonly BattleActionReaderBlock[],
  fits: (page: readonly BattleActionReaderBlock[]) => boolean | Promise<boolean>,
  signal?: AbortSignal,
): Promise<BattleActionReaderBlock[][] | null> {
  async function measuredFits(candidate: readonly BattleActionReaderBlock[]): Promise<boolean> {
    if (signal?.aborted) return false
    const result = await fits(candidate)
    return !signal?.aborted && result
  }
  const pages: BattleActionReaderBlock[][] = []
  let page: BattleActionReaderBlock[] = []
  for (const block of blocks) {
    if (!block.text) continue
    let characters = Array.from(block.text)
    while (characters.length) {
      if (signal?.aborted) return null
      const remainder = { ...block, text: characters.join('') }
      if (await measuredFits([...page, remainder])) {
        page.push(remainder)
        break
      }
      // Start an intact block on the next page when it fits there.
      if (page.length && (await measuredFits([remainder]))) {
        pages.push(page)
        page = []
        continue
      }
      let low = 0
      let high = characters.length
      while (low < high) {
        if (signal?.aborted) return null
        const middle = Math.ceil((low + high) / 2)
        if (await measuredFits([...page, { ...block, text: characters.slice(0, middle).join('') }]))
          low = middle
        else high = middle - 1
      }
      if (low === 0 && page.length) {
        pages.push(page)
        page = []
        continue
      }
      // Wait for usable geometry rather than committing a page that clips even one glyph.
      if (low === 0) return null
      const count = low
      page.push({ ...block, text: characters.slice(0, count).join('') })
      pages.push(page)
      page = []
      characters = characters.slice(count)
    }
  }
  if (page.length) pages.push(page)
  return signal?.aborted ? null : pages.length ? pages : [[]]
}
export function resolveBattleActionSelection(
  turns: readonly { key: string; actions: readonly { key: string }[] }[],
  selection: BattleActionReaderSelection | null,
): { turnIndex: number; actionIndex: number } {
  const pinnedTurn = selection ? turns.findIndex((turn) => turn.key === selection.turnKey) : -1
  const turnIndex = pinnedTurn < 0 ? turns.length - 1 : pinnedTurn
  const actions = turns[turnIndex]?.actions ?? []
  const pinnedAction =
    pinnedTurn >= 0 ? actions.findIndex((action) => action.key === selection?.actionKey) : -1
  return { turnIndex, actionIndex: pinnedAction < 0 ? actions.length - 1 : pinnedAction }
}
