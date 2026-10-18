import type { PublicCombatGroundArea } from '@aurevane/game-core/combat/combat-ground-visuals'
export interface CombatContentValidationIssue {
  readonly path: string
  readonly code: string
  readonly message: string
}

export interface CombatContentValidationResult {
  readonly valid: boolean
  readonly issues: readonly CombatContentValidationIssue[]
  readonly derivedTags: readonly string[]
}

export interface CombatContentSemanticDiff {
  readonly changedPaths: readonly string[]
}

export interface CombatContentEventSample {
  readonly referenceActor: 'owner' | 'opponent'
  readonly ownerHpPercent: number
  readonly ownerMpPercent: number
  readonly ownerStatus: 'none' | 'poison'
}

export const DEFAULT_COMBAT_CONTENT_EVENT_SAMPLE: CombatContentEventSample = Object.freeze({
  referenceActor: 'owner',
  ownerHpPercent: 60,
  ownerMpPercent: 60,
  ownerStatus: 'none',
})

export interface CombatContentHistoricalSample {
  readonly mode: 'sequence' | 'immediate'
  readonly sameTurnOnly: boolean
  readonly activated: boolean
  readonly armedByActionId: string | null
  readonly steps: readonly {
    readonly referenceAction: { readonly id: string; readonly contentVersion: number }
    readonly legal: boolean
    readonly ran: boolean
    readonly issues: readonly { readonly code: string; readonly message: string }[]
    readonly costs?: { readonly actionEconomy: number; readonly mp: number }
    readonly combatants: readonly {
      readonly id: string
      readonly presentBefore: boolean
      readonly presentAfter: boolean
      readonly hpBefore: number | null
      readonly hpAfter: number | null
      readonly mpBefore: number | null
      readonly mpAfter: number | null
      readonly apBefore: number | null
      readonly apAfter: number | null
      readonly barrierBefore: number | null
      readonly barrierAfter: number | null
    }[]
    readonly resonanceEvents: readonly {
      readonly event: 'resonance_armed' | 'resonance_activated' | 'resonance_expired'
      readonly resonanceId: string
      readonly contentVersion: number
      readonly setupActionId: string | null
      readonly triggerActionId?: string
      readonly interruptedByActionId?: string
    }[]
  }[]
}

export interface CombatContentPreviewSummary {
  readonly historicalSample?: CombatContentHistoricalSample
  readonly eventSample?: {
    readonly ran: boolean
    readonly activated: boolean
    readonly scenario: CombatContentEventSample
    readonly eventTypes: readonly string[]
    readonly ownerStatusChanges: readonly {
      readonly kind: 'applied' | 'removed'
      readonly statusId: string
      readonly name: string
    }[]
    readonly owner: {
      readonly hpBefore: number
      readonly hpAfter: number
      readonly maxHp: number
      readonly mpBefore: number
      readonly mpAfter: number
      readonly maxMp: number
      readonly apBefore: number
      readonly apAfter: number
      readonly barrierBefore: number
      readonly barrierAfter: number
    }
  }
  readonly modifier?: {
    readonly activation: 'manual' | 'ongoing'
    readonly mode: 'modifier'
  }
  readonly referenceAction?: {
    readonly id: string
    readonly contentVersion: number
    readonly behaviorId?: string
  }
  readonly behaviorId?: string
  readonly issues?: readonly { readonly code: string; readonly message: string }[]
  readonly simulation?: {
    readonly preparation?: 'free-controlled-prime'
    readonly [key: string]: unknown
  }
  readonly groundAreas?: readonly PublicCombatGroundArea[]
  readonly legal?: boolean
  readonly costs?: {
    readonly actionEconomy?: number
    readonly mp?: number
    readonly hp?: number
  }
  readonly movement?: {
    readonly path: readonly { readonly x: number; readonly y: number }[]
    readonly terrainCost?: number
    readonly movementRemainingAfter?: number
  }
  readonly targeting?: {
    readonly affectedCombatantIds?: readonly string[]
  }
  readonly accuracy?: {
    readonly projectionsAssumeHits?: boolean
    readonly targetHitChances?: readonly {
      readonly targetCombatantId: string
      readonly hitChanceBasisPoints: number
    }[]
  }
  readonly projections?: {
    readonly effects?: readonly {
      readonly effectType?: string
      readonly [key: string]: unknown
    }[]
  }
  readonly [key: string]: unknown
}

export interface CombatContentReviewState {
  readonly validation: CombatContentValidationResult | null
  readonly diff: CombatContentSemanticDiff | null
  readonly preview: CombatContentPreviewSummary | null
}

export interface CombatContentVersionHistoryEntry {
  readonly contentVersion: number
  readonly source: 'static-baseline' | 'published'
  readonly current: boolean
  readonly publishedAt: string | null
}

export function emptyCombatContentReview(): CombatContentReviewState {
  return { validation: null, diff: null, preview: null }
}

export function invalidateCombatContentReview(
  current: CombatContentReviewState,
): CombatContentReviewState {
  void current
  return emptyCombatContentReview()
}

export function canPublishCombatContent(
  review: CombatContentReviewState,
  options: { readonly requireLegalPreview?: boolean } = {},
): boolean {
  return (
    review.validation?.valid === true &&
    review.diff !== null &&
    review.preview !== null &&
    (options.requireLegalPreview === false || review.preview.legal !== false)
  )
}

export function nextCombatContentVersion(
  currentVersion: number,
  history: readonly CombatContentVersionHistoryEntry[],
  versionFloor: number | null = null,
): number {
  if (!Number.isSafeInteger(currentVersion) || currentVersion < 1) {
    throw new RangeError('Current combat content version must be a positive safe integer.')
  }
  if (versionFloor !== null && (!Number.isSafeInteger(versionFloor) || versionFloor < 1))
    throw new RangeError('Publication version floor must be a positive safe integer.')

  const highest = history.reduce(
    (value, entry) => {
      if (!Number.isSafeInteger(entry.contentVersion) || entry.contentVersion < 1) {
        throw new RangeError('Combat content history contains an invalid version.')
      }
      return Math.max(value, entry.contentVersion)
    },
    Math.max(currentVersion, versionFloor ?? 0),
  )

  if (highest >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError('Combat content version has reached the safe integer limit.')
  }
  return highest + 1
}

function byVersion(
  left: CombatContentVersionHistoryEntry,
  right: CombatContentVersionHistoryEntry,
): number {
  return left.contentVersion - right.contentVersion
}

export function projectPublishedVersionHistory(
  history: readonly CombatContentVersionHistoryEntry[],
  published: { readonly contentVersion: number; readonly publishedAt: string | null },
): readonly CombatContentVersionHistoryEntry[] {
  if (!Number.isSafeInteger(published.contentVersion) || published.contentVersion < 1) {
    throw new RangeError('Published combat content version must be a positive safe integer.')
  }

  const next = history
    .filter((entry) => entry.contentVersion !== published.contentVersion)
    .map((entry) => ({ ...entry, current: false }))
  next.push({
    contentVersion: published.contentVersion,
    source: 'published',
    current: true,
    publishedAt: published.publishedAt,
  })
  return next.sort(byVersion)
}

export function projectRollbackVersionHistory(
  history: readonly CombatContentVersionHistoryEntry[],
  targetVersion: number,
): readonly CombatContentVersionHistoryEntry[] {
  if (!history.some((entry) => entry.contentVersion === targetVersion)) {
    throw new RangeError(`Rollback target v${targetVersion} is not present in version history.`)
  }
  return history.map((entry) => ({
    ...entry,
    current: entry.contentVersion === targetVersion,
  }))
}
