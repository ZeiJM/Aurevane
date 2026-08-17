export const BALANCED_PRACTICE_FOCUS = 'balanced' as const
export const PLANNED_PRACTICE_WINDOWS = ['short', 'overnight', 'extended'] as const

export type PlannedPracticeWindow = (typeof PLANNED_PRACTICE_WINDOWS)[number]
export type PracticeSource = 'automatic_balanced' | 'planned_balanced'

const SECONDS_PER_HOUR = 60 * 60

export interface BalancedPracticeConfig {
  readonly version: number
  readonly focus: typeof BALANCED_PRACTICE_FOCUS
  readonly minimumOfflineSeconds: number
  readonly fullRateEndSeconds: number
  readonly reducedRateEndSeconds: number
  readonly restedMomentumEndSeconds: number
  readonly fullRateXpPerHour: number
  readonly reducedRateXpPerHour: number
  readonly directXpCap: number
  readonly restedMomentumSecondsPerUnit: number
  readonly restedMomentumCap: number
}

export interface PlannedPracticeWindowConfig {
  readonly version: number
  readonly shortSeconds: number
  readonly overnightSeconds: number
  readonly extendedSeconds: number
}

export interface BalancedPracticeConfigIssue {
  field: keyof BalancedPracticeConfig
  message: string
}

export interface PlannedPracticeWindowConfigIssue {
  field: keyof PlannedPracticeWindowConfig
  message: string
}

export type BalancedPracticeThresholdState = 'below_minimum' | 'eligible'
export type BalancedPracticeCapState = 'not_reached' | 'reached'

export interface BalancedPracticeWindow {
  startMs: number
  endMs: number
  elapsedSeconds: number
}

export interface BalancedPracticeAccrual {
  focus: typeof BALANCED_PRACTICE_FOCUS
  configVersion: number
  window: BalancedPracticeWindow
  thresholdState: BalancedPracticeThresholdState
  creditedDirectSeconds: number
  fullRateSeconds: number
  reducedRateSeconds: number
  requestedCharacterXp: number
  directXpCapState: BalancedPracticeCapState
  restedMomentumSeconds: number
  restedMomentumGain: number
  restedMomentumCapState: BalancedPracticeCapState
}

export interface PracticeIntentResolution {
  source: PracticeSource
  plannedWindow: PlannedPracticeWindow | null
  plannedWindowConfigVersion: number | null
  plannedWindowSeconds: number | null
  plannedElapsedSeconds: number
  balancedFallbackSeconds: number
}

export const PHASE_1_BALANCED_PRACTICE_CONFIG: BalancedPracticeConfig = Object.freeze({
  version: 1,
  focus: BALANCED_PRACTICE_FOCUS,
  minimumOfflineSeconds: SECONDS_PER_HOUR,
  fullRateEndSeconds: 24 * SECONDS_PER_HOUR,
  reducedRateEndSeconds: 72 * SECONDS_PER_HOUR,
  restedMomentumEndSeconds: 14 * 24 * SECONDS_PER_HOUR,
  fullRateXpPerHour: 8,
  reducedRateXpPerHour: 4,
  directXpCap: 376,
  restedMomentumSecondsPerUnit: 2 * SECONDS_PER_HOUR,
  restedMomentumCap: 132,
})

export const PHASE_1_PLANNED_PRACTICE_WINDOW_CONFIG: PlannedPracticeWindowConfig = Object.freeze({
  version: 1,
  shortSeconds: 3 * SECONDS_PER_HOUR,
  overnightSeconds: 8 * SECONDS_PER_HOUR,
  extendedSeconds: 24 * SECONDS_PER_HOUR,
})

export function validateBalancedPracticeConfig(
  config: BalancedPracticeConfig,
): readonly BalancedPracticeConfigIssue[] {
  const issues: BalancedPracticeConfigIssue[] = []

  validatePositiveInteger(config.version, 'version', issues)
  validateNonNegativeInteger(config.minimumOfflineSeconds, 'minimumOfflineSeconds', issues)
  validatePositiveInteger(config.fullRateEndSeconds, 'fullRateEndSeconds', issues)
  validatePositiveInteger(config.reducedRateEndSeconds, 'reducedRateEndSeconds', issues)
  validatePositiveInteger(config.restedMomentumEndSeconds, 'restedMomentumEndSeconds', issues)
  validatePositiveInteger(config.fullRateXpPerHour, 'fullRateXpPerHour', issues)
  validatePositiveInteger(config.reducedRateXpPerHour, 'reducedRateXpPerHour', issues)
  validatePositiveInteger(config.directXpCap, 'directXpCap', issues)
  validatePositiveInteger(
    config.restedMomentumSecondsPerUnit,
    'restedMomentumSecondsPerUnit',
    issues,
  )
  validatePositiveInteger(config.restedMomentumCap, 'restedMomentumCap', issues)

  if (config.focus !== BALANCED_PRACTICE_FOCUS) {
    issues.push({ field: 'focus', message: 'Phase 1 supports Balanced Practice only.' })
  }

  if (config.fullRateEndSeconds <= config.minimumOfflineSeconds) {
    issues.push({
      field: 'fullRateEndSeconds',
      message: 'The full-rate window must end after the minimum offline threshold.',
    })
  }

  if (config.reducedRateEndSeconds <= config.fullRateEndSeconds) {
    issues.push({
      field: 'reducedRateEndSeconds',
      message: 'The reduced-rate window must end after the full-rate window.',
    })
  }

  if (config.restedMomentumEndSeconds <= config.reducedRateEndSeconds) {
    issues.push({
      field: 'restedMomentumEndSeconds',
      message: 'The Rested Momentum window must end after direct Practice accrual.',
    })
  }

  if (config.reducedRateXpPerHour > config.fullRateXpPerHour) {
    issues.push({
      field: 'reducedRateXpPerHour',
      message: 'The reduced direct-Practice rate cannot exceed the full rate.',
    })
  }

  return issues
}

export function validatePlannedPracticeWindowConfig(
  config: PlannedPracticeWindowConfig,
): readonly PlannedPracticeWindowConfigIssue[] {
  const issues: PlannedPracticeWindowConfigIssue[] = []
  for (const field of ['version', 'shortSeconds', 'overnightSeconds', 'extendedSeconds'] as const) {
    if (!Number.isSafeInteger(config[field]) || config[field] <= 0) {
      issues.push({ field, message: 'Value must be a positive safe integer.' })
    }
  }

  if (config.shortSeconds >= config.overnightSeconds) {
    issues.push({ field: 'overnightSeconds', message: 'Overnight must be longer than Short.' })
  }
  if (config.overnightSeconds >= config.extendedSeconds) {
    issues.push({ field: 'extendedSeconds', message: 'Extended must be longer than Overnight.' })
  }
  return issues
}

export function getPlannedPracticeWindowSeconds(
  window: PlannedPracticeWindow,
  config: PlannedPracticeWindowConfig = PHASE_1_PLANNED_PRACTICE_WINDOW_CONFIG,
): number {
  assertValidWindowConfig(config)
  switch (window) {
    case 'short':
      return config.shortSeconds
    case 'overnight':
      return config.overnightSeconds
    case 'extended':
      return config.extendedSeconds
  }
}

export function resolvePhase1PracticeIntent(input: {
  elapsedSeconds: number
  plannedWindow: PlannedPracticeWindow | null
  config?: PlannedPracticeWindowConfig
}): PracticeIntentResolution {
  if (!Number.isSafeInteger(input.elapsedSeconds) || input.elapsedSeconds < 0) {
    throw new RangeError('elapsedSeconds must be a non-negative safe integer.')
  }

  if (input.plannedWindow === null) {
    return {
      source: 'automatic_balanced',
      plannedWindow: null,
      plannedWindowConfigVersion: null,
      plannedWindowSeconds: null,
      plannedElapsedSeconds: 0,
      balancedFallbackSeconds: input.elapsedSeconds,
    }
  }

  const config = input.config ?? PHASE_1_PLANNED_PRACTICE_WINDOW_CONFIG
  const plannedWindowSeconds = getPlannedPracticeWindowSeconds(input.plannedWindow, config)
  return {
    source: 'planned_balanced',
    plannedWindow: input.plannedWindow,
    plannedWindowConfigVersion: config.version,
    plannedWindowSeconds,
    plannedElapsedSeconds: Math.min(input.elapsedSeconds, plannedWindowSeconds),
    balancedFallbackSeconds: Math.max(0, input.elapsedSeconds - plannedWindowSeconds),
  }
}

export function calculateBalancedPractice(input: {
  windowStartMs: number
  windowEndMs: number
  config?: BalancedPracticeConfig
}): BalancedPracticeAccrual {
  const config = input.config ?? PHASE_1_BALANCED_PRACTICE_CONFIG
  assertValidConfig(config)
  assertValidTimestamp(input.windowStartMs, 'windowStartMs')
  assertValidTimestamp(input.windowEndMs, 'windowEndMs')

  if (input.windowEndMs < input.windowStartMs) {
    throw new RangeError('windowEndMs must not be earlier than windowStartMs.')
  }

  const elapsedSeconds = Math.floor((input.windowEndMs - input.windowStartMs) / 1000)
  const thresholdState: BalancedPracticeThresholdState =
    elapsedSeconds <= config.minimumOfflineSeconds ? 'below_minimum' : 'eligible'

  const fullRateSeconds = boundedWindowSeconds(
    elapsedSeconds,
    config.minimumOfflineSeconds,
    config.fullRateEndSeconds,
  )
  const reducedRateSeconds = boundedWindowSeconds(
    elapsedSeconds,
    config.fullRateEndSeconds,
    config.reducedRateEndSeconds,
  )
  const creditedDirectSeconds = fullRateSeconds + reducedRateSeconds

  const uncappedCharacterXp =
    scaledHourlyFloor(fullRateSeconds, config.fullRateXpPerHour) +
    scaledHourlyFloor(reducedRateSeconds, config.reducedRateXpPerHour)
  const requestedCharacterXp = Math.min(uncappedCharacterXp, config.directXpCap)

  const restedMomentumSeconds = boundedWindowSeconds(
    elapsedSeconds,
    config.reducedRateEndSeconds,
    config.restedMomentumEndSeconds,
  )
  const uncappedRestedMomentum = Math.floor(
    restedMomentumSeconds / config.restedMomentumSecondsPerUnit,
  )
  const restedMomentumGain = Math.min(uncappedRestedMomentum, config.restedMomentumCap)

  return {
    focus: BALANCED_PRACTICE_FOCUS,
    configVersion: config.version,
    window: {
      startMs: input.windowStartMs,
      endMs: input.windowEndMs,
      elapsedSeconds,
    },
    thresholdState,
    creditedDirectSeconds,
    fullRateSeconds,
    reducedRateSeconds,
    requestedCharacterXp,
    directXpCapState: uncappedCharacterXp >= config.directXpCap ? 'reached' : 'not_reached',
    restedMomentumSeconds,
    restedMomentumGain,
    restedMomentumCapState:
      uncappedRestedMomentum >= config.restedMomentumCap ? 'reached' : 'not_reached',
  }
}

function boundedWindowSeconds(
  elapsedSeconds: number,
  startSeconds: number,
  endSeconds: number,
): number {
  if (elapsedSeconds <= startSeconds) {
    return 0
  }

  return Math.max(0, Math.min(elapsedSeconds, endSeconds) - startSeconds)
}

function scaledHourlyFloor(seconds: number, amountPerHour: number): number {
  const amount = (BigInt(seconds) * BigInt(amountPerHour)) / BigInt(SECONDS_PER_HOUR)
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Practice accrual exceeds the safe integer range.')
  }

  return Number(amount)
}

function assertValidConfig(config: BalancedPracticeConfig): void {
  const issues = validateBalancedPracticeConfig(config)
  if (issues.length > 0) {
    throw new Error(`Invalid Balanced Practice config: ${issues[0].field}: ${issues[0].message}`)
  }
}

function assertValidWindowConfig(config: PlannedPracticeWindowConfig): void {
  const issues = validatePlannedPracticeWindowConfig(config)
  if (issues.length > 0) {
    throw new Error(`Invalid planned Practice config: ${issues[0].field}: ${issues[0].message}`)
  }
}

function assertValidTimestamp(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative safe integer timestamp in milliseconds.`)
  }
}

function validatePositiveInteger(
  value: number,
  field: keyof BalancedPracticeConfig,
  issues: BalancedPracticeConfigIssue[],
): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    issues.push({ field, message: 'Value must be a positive safe integer.' })
  }
}

function validateNonNegativeInteger(
  value: number,
  field: keyof BalancedPracticeConfig,
  issues: BalancedPracticeConfigIssue[],
): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    issues.push({ field, message: 'Value must be a non-negative safe integer.' })
  }
}
