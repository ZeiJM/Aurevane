import { AurevaneError } from '@aurevane/game-core/errors'
import {
  DEFAULT_COMBAT_CONTENT_EVENT_SAMPLE,
  type CombatContentEventSample,
} from '@/components/master/combat-content/combat-content-workflow'

export function readCombatContentEventSample(value: unknown): CombatContentEventSample {
  if (value === undefined) return { ...DEFAULT_COMBAT_CONTENT_EVENT_SAMPLE }
  const invalid = (): never => {
    throw new AurevaneError('INVALID_REQUEST', 'Choose valid local event sample settings.')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  const row = value as Record<string, unknown>
  if (
    Object.keys(row).some(
      (key) => !['referenceActor', 'ownerHpPercent', 'ownerMpPercent', 'ownerStatus'].includes(key),
    ) ||
    !['owner', 'opponent'].includes(row.referenceActor as string) ||
    !Number.isInteger(row.ownerHpPercent) ||
    (row.ownerHpPercent as number) < 1 ||
    (row.ownerHpPercent as number) > 100 ||
    !Number.isInteger(row.ownerMpPercent) ||
    (row.ownerMpPercent as number) < 0 ||
    (row.ownerMpPercent as number) > 100 ||
    !['none', 'poison'].includes(row.ownerStatus as string)
  )
    return invalid()
  return {
    referenceActor: row.referenceActor as CombatContentEventSample['referenceActor'],
    ownerHpPercent: row.ownerHpPercent as number,
    ownerMpPercent: row.ownerMpPercent as number,
    ownerStatus: row.ownerStatus as CombatContentEventSample['ownerStatus'],
  }
}
