export const BATTLE_INSPECT_CLOSED_EVENT = 'aurevane:battle-inspect-closed'

export type BattleInspectClosedDetail = {
  battleSessionId: string
}

export function dispatchBattleInspectClosed(battleSessionId: string) {
  window.dispatchEvent(
    new CustomEvent<BattleInspectClosedDetail>(BATTLE_INSPECT_CLOSED_EVENT, {
      detail: { battleSessionId },
    }),
  )
}
