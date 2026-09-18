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

export interface CombatContentPreviewSummary {
  readonly legal?: boolean
  readonly costs?: {
    readonly actionEconomy?: number
    readonly mp?: number
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

export function canPublishCombatContent(review: CombatContentReviewState): boolean {
  return (
    review.validation?.valid === true &&
    review.diff !== null &&
    review.preview !== null &&
    review.preview.legal !== false
  )
}

export function nextCombatContentVersion(
  currentVersion: number,
  history: readonly CombatContentVersionHistoryEntry[],
): number {
  if (!Number.isSafeInteger(currentVersion) || currentVersion < 1) {
    throw new RangeError('Current combat content version must be a positive safe integer.')
  }

  const highest = history.reduce((value, entry) => {
    if (!Number.isSafeInteger(entry.contentVersion) || entry.contentVersion < 1) {
      throw new RangeError('Combat content history contains an invalid version.')
    }
    return Math.max(value, entry.contentVersion)
  }, currentVersion)

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
