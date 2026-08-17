const TESTER_COHORTS = new Set(['internal', 'trusted', 'external'])
const FIRST_BATTLE_OUTCOMES = new Set(['completed', 'abandoned', 'soft_lock', 'technical_failure'])
const OBSERVATION_ANSWERS = new Set(['yes', 'no', 'unclear', 'not_observed'])
const REPLAY_DISPOSITIONS = new Set([
  'chosen',
  'declined',
  'not_offered',
  'excluded_time',
  'excluded_technical',
])
const RATING_KEYS = ['pace', 'clarity', 'responsiveness', 'audiovisualImpact', 'replayDesire']
const ALLOWED_RECORD_KEYS = new Set([
  'sessionId',
  'battleSessionId',
  'testerCohort',
  'firstBattleOutcome',
  'firstConfidentActionSeconds',
  'battleDurationSeconds',
  'obviousMisclickCount',
  'targetingConfusionCount',
  'outcomeUnderstood',
  'replayDisposition',
  'tacticalDecisionRecalled',
  'ratings',
  'qualitativeNotes',
])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SESSION_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,80}$/
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
}

function assertEnum(value, allowed, label) {
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw new Error(`${label} has an unsupported value.`)
  }
}

function assertNullableNonNegativeNumber(value, label) {
  if (value === null) return
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be null or a non-negative finite number.`)
  }
}

function assertNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`)
  }
}

function validateRatings(ratings, recordLabel) {
  assertPlainObject(ratings, `${recordLabel}.ratings`)

  const keys = Object.keys(ratings)
  const unexpected = keys.filter((key) => !RATING_KEYS.includes(key))
  if (unexpected.length > 0) {
    throw new Error(`${recordLabel}.ratings contains unsupported fields: ${unexpected.join(', ')}.`)
  }

  for (const key of RATING_KEYS) {
    const value = ratings[key]
    if (value === null) continue
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new Error(`${recordLabel}.ratings.${key} must be null or an integer from 1 to 5.`)
    }
  }
}

function validateQualitativeNotes(notes, recordLabel) {
  if (notes === undefined) return
  if (!Array.isArray(notes) || notes.length > 8) {
    throw new Error(`${recordLabel}.qualitativeNotes must be an array with at most 8 entries.`)
  }

  for (const [index, note] of notes.entries()) {
    if (typeof note !== 'string' || note.length === 0 || note.length > 500) {
      throw new Error(
        `${recordLabel}.qualitativeNotes[${index}] must be a non-empty string of at most 500 characters.`,
      )
    }
    if (EMAIL_PATTERN.test(note)) {
      throw new Error(
        `${recordLabel}.qualitativeNotes[${index}] appears to contain an email address. Remove unnecessary personal information.`,
      )
    }
  }
}

export function validatePv1SessionRecord(record, index = 0) {
  const recordLabel = `records[${index}]`
  assertPlainObject(record, recordLabel)

  const unexpected = Object.keys(record).filter((key) => !ALLOWED_RECORD_KEYS.has(key))
  if (unexpected.length > 0) {
    throw new Error(`${recordLabel} contains unsupported fields: ${unexpected.join(', ')}.`)
  }

  if (typeof record.sessionId !== 'string' || !SESSION_ID_PATTERN.test(record.sessionId)) {
    throw new Error(
      `${recordLabel}.sessionId must be a pseudonymous 1–80 character identifier using letters, numbers, dot, colon, underscore or hyphen.`,
    )
  }

  if (
    record.battleSessionId !== null &&
    (typeof record.battleSessionId !== 'string' || !UUID_PATTERN.test(record.battleSessionId))
  ) {
    throw new Error(`${recordLabel}.battleSessionId must be null or a UUID.`)
  }

  assertEnum(record.testerCohort, TESTER_COHORTS, `${recordLabel}.testerCohort`)
  assertEnum(record.firstBattleOutcome, FIRST_BATTLE_OUTCOMES, `${recordLabel}.firstBattleOutcome`)
  assertNullableNonNegativeNumber(
    record.firstConfidentActionSeconds,
    `${recordLabel}.firstConfidentActionSeconds`,
  )
  assertNullableNonNegativeNumber(
    record.battleDurationSeconds,
    `${recordLabel}.battleDurationSeconds`,
  )
  assertNonNegativeInteger(record.obviousMisclickCount, `${recordLabel}.obviousMisclickCount`)
  assertNonNegativeInteger(record.targetingConfusionCount, `${recordLabel}.targetingConfusionCount`)
  assertEnum(record.outcomeUnderstood, OBSERVATION_ANSWERS, `${recordLabel}.outcomeUnderstood`)
  assertEnum(record.replayDisposition, REPLAY_DISPOSITIONS, `${recordLabel}.replayDisposition`)
  assertEnum(
    record.tacticalDecisionRecalled,
    OBSERVATION_ANSWERS,
    `${recordLabel}.tacticalDecisionRecalled`,
  )
  validateRatings(record.ratings, recordLabel)
  validateQualitativeNotes(record.qualitativeNotes, recordLabel)

  if (record.firstBattleOutcome === 'completed' && record.battleDurationSeconds === null) {
    throw new Error(
      `${recordLabel}.battleDurationSeconds is required when the first battle completed.`,
    )
  }

  if (
    record.replayDisposition === 'excluded_technical' &&
    !['technical_failure', 'soft_lock'].includes(record.firstBattleOutcome)
  ) {
    throw new Error(
      `${recordLabel}.replayDisposition can be excluded_technical only for a technical failure or soft lock.`,
    )
  }

  return record
}

export function median(values) {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle]
  return (sorted[middle - 1] + sorted[middle]) / 2
}

function countBy(records, key, values) {
  return Object.fromEntries(
    values.map((value) => [value, records.filter((record) => record[key] === value).length]),
  )
}

function observedAnswerSummary(records, key) {
  const observed = records.filter((record) => record[key] !== 'not_observed')
  const yes = observed.filter((record) => record[key] === 'yes').length
  const no = observed.filter((record) => record[key] === 'no').length
  const unclear = observed.filter((record) => record[key] === 'unclear').length
  return {
    observed: observed.length,
    yes,
    no,
    unclear,
    yesRate: observed.length === 0 ? null : yes / observed.length,
  }
}

function ratingSummary(records, key) {
  const values = records
    .map((record) => record.ratings[key])
    .filter((value) => typeof value === 'number')
  return { sampleSize: values.length, median: median(values) }
}

export function summarizePv1Sessions(rawRecords) {
  if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
    throw new Error('PV-1 report input must be a non-empty JSON array of session records.')
  }

  const records = rawRecords.map((record, index) => validatePv1SessionRecord(record, index))
  const sessionIds = new Set()
  for (const record of records) {
    if (sessionIds.has(record.sessionId)) {
      throw new Error(`Duplicate sessionId: ${record.sessionId}.`)
    }
    sessionIds.add(record.sessionId)
  }

  const outcomes = countBy(records, 'firstBattleOutcome', [...FIRST_BATTLE_OUTCOMES])
  const confidentActionSamples = records
    .map((record) => record.firstConfidentActionSeconds)
    .filter((value) => typeof value === 'number')
  const durationSamples = records
    .map((record) => record.battleDurationSeconds)
    .filter((value) => typeof value === 'number')
  const replayEligible = records.filter((record) =>
    ['chosen', 'declined'].includes(record.replayDisposition),
  )
  const replayChosen = replayEligible.filter(
    (record) => record.replayDisposition === 'chosen',
  ).length
  const replayRate = replayEligible.length === 0 ? null : replayChosen / replayEligible.length
  const technicalOrSoftLock = outcomes.technical_failure + outcomes.soft_lock

  return {
    sessions: records.length,
    cohorts: countBy(records, 'testerCohort', [...TESTER_COHORTS]),
    firstBattleOutcomes: outcomes,
    completionRate: outcomes.completed / records.length,
    abandonmentRate: outcomes.abandoned / records.length,
    technicalOrSoftLockRate: technicalOrSoftLock / records.length,
    timeToFirstConfidentAction: {
      sampleSize: confidentActionSamples.length,
      medianSeconds: median(confidentActionSamples),
    },
    battleDuration: {
      sampleSize: durationSamples.length,
      medianSeconds: median(durationSamples),
    },
    obviousMisclicks: {
      total: records.reduce((sum, record) => sum + record.obviousMisclickCount, 0),
      sessionsWithAny: records.filter((record) => record.obviousMisclickCount > 0).length,
    },
    targetingConfusion: {
      total: records.reduce((sum, record) => sum + record.targetingConfusionCount, 0),
      sessionsWithAny: records.filter((record) => record.targetingConfusionCount > 0).length,
    },
    outcomeUnderstanding: observedAnswerSummary(records, 'outcomeUnderstood'),
    tacticalDecisionRecall: observedAnswerSummary(records, 'tacticalDecisionRecalled'),
    voluntaryReplay: {
      eligible: replayEligible.length,
      chosen: replayChosen,
      declined: replayEligible.length - replayChosen,
      excludedTime: records.filter((record) => record.replayDisposition === 'excluded_time').length,
      excludedTechnical: records.filter(
        (record) => record.replayDisposition === 'excluded_technical',
      ).length,
      notOffered: records.filter((record) => record.replayDisposition === 'not_offered').length,
      chosenRate: replayRate,
      provisionalWarning: replayRate !== null && replayRate < 0.5,
    },
    ratings: Object.fromEntries(RATING_KEYS.map((key) => [key, ratingSummary(records, key)])),
  }
}

function formatPercent(value) {
  return value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`
}

function formatSeconds(value) {
  return value === null ? 'n/a' : `${Number(value.toFixed(1))}s`
}

function formatRating(summary) {
  return summary.median === null
    ? 'n/a'
    : `${Number(summary.median.toFixed(1))}/5 (n=${summary.sampleSize})`
}

export function formatPv1Summary(summary) {
  const outcome = summary.firstBattleOutcomes
  const replay = summary.voluntaryReplay
  const lines = [
    'PV-1 Tactical Combat Evidence Summary',
    `Sessions: ${summary.sessions}`,
    '',
    'First battle outcomes',
    `- completed: ${outcome.completed} (${formatPercent(summary.completionRate)})`,
    `- abandoned: ${outcome.abandoned} (${formatPercent(summary.abandonmentRate)})`,
    `- soft lock: ${outcome.soft_lock}`,
    `- technical failure: ${outcome.technical_failure}`,
    `- technical + soft-lock rate: ${formatPercent(summary.technicalOrSoftLockRate)}`,
    '',
    'Interaction clarity',
    `- median time to first confident action: ${formatSeconds(summary.timeToFirstConfidentAction.medianSeconds)} (n=${summary.timeToFirstConfidentAction.sampleSize})`,
    `- median battle duration: ${formatSeconds(summary.battleDuration.medianSeconds)} (n=${summary.battleDuration.sampleSize})`,
    `- sessions with obvious misclicks: ${summary.obviousMisclicks.sessionsWithAny}/${summary.sessions}; total ${summary.obviousMisclicks.total}`,
    `- sessions with targeting confusion: ${summary.targetingConfusion.sessionsWithAny}/${summary.sessions}; total ${summary.targetingConfusion.total}`,
    `- outcome understood: ${summary.outcomeUnderstanding.yes}/${summary.outcomeUnderstanding.observed} observed (${formatPercent(summary.outcomeUnderstanding.yesRate)})`,
    `- tactical decision recalled: ${summary.tacticalDecisionRecall.yes}/${summary.tacticalDecisionRecall.observed} observed (${formatPercent(summary.tacticalDecisionRecall.yesRate)})`,
    '',
    'Voluntary replay',
    `- chosen: ${replay.chosen}/${replay.eligible} eligible (${formatPercent(replay.chosenRate)})`,
    `- declined: ${replay.declined}`,
    `- excluded for time: ${replay.excludedTime}`,
    `- excluded for technical reason: ${replay.excludedTechnical}`,
    `- not offered: ${replay.notOffered}`,
    `- provisional replay warning (<50% eligible chose another fight): ${replay.provisionalWarning ? 'YES' : 'NO'}`,
    '',
    'Median 1–5 ratings',
    `- pace: ${formatRating(summary.ratings.pace)}`,
    `- clarity: ${formatRating(summary.ratings.clarity)}`,
    `- responsiveness: ${formatRating(summary.ratings.responsiveness)}`,
    `- audiovisual impact: ${formatRating(summary.ratings.audiovisualImpact)}`,
    `- replay desire: ${formatRating(summary.ratings.replayDesire)}`,
    '',
    'Decision note: this report is decision support, not an automatic PV-1 pass/fail verdict.',
    'Review qualitative notes, technical failures, sample quality, cohort composition and confounders before deciding whether the gate passes.',
  ]

  return lines.join('\n')
}
