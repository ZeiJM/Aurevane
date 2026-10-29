import type { CombatTagPresentationSnapshot } from '@aurevane/game-core/combat/combat-tag-registry'
import { renderCombatTagWording } from '@aurevane/game-core/combat/combat-tag-wording'
import type { CombatEffectPresentationStatus } from '@aurevane/game-core/combat/combat-effect-timing'

/** Compact public projection only: no source keys, full descriptions or unused catalogue rows. */
export type BattleTagWording = Pick<
  CombatTagPresentationSnapshot,
  'tagId' | 'contentVersion' | 'name' | 'compact'
>

export function battleTagForStatus(
  tags: readonly CombatTagPresentationSnapshot[] | undefined,
  status: Pick<CombatEffectPresentationStatus, 'statusId' | 'recovery'>,
  exactTagId?: string,
): BattleTagWording | undefined {
  const aliases: Readonly<Record<string, string>> = {
    'barrier-change': 'barrier',
    'create-terrain': 'freeze-ground',
    'return-to-turn-start': 'rewind',
    sensory: 'reveal',
  }
  const id =
    exactTagId ??
    (status.recovery
      ? status.recovery.basis === 'percentage'
        ? status.recovery.resource === 'hp'
          ? 'hp-recovery'
          : 'mp-recovery'
        : status.recovery.resource === 'hp'
          ? 'healing'
          : 'mp-restore'
      : (aliases[status.statusId] ?? status.statusId))
  const tag =
    tags?.find((row) => row.tagId === id) ?? tags?.find((row) => row.tagId === status.statusId)
  return tag
    ? { tagId: tag.tagId, contentVersion: tag.contentVersion, name: tag.name, compact: tag.compact }
    : undefined
}

export function battleTagDescription(tag: BattleTagWording | undefined, generated: string): string {
  return tag
    ? renderCombatTagWording(tag.compact, { details: generated, summary: generated })
    : generated
}
