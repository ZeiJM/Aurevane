import assert from 'node:assert/strict'
import test from 'node:test'

import {
  formatPv1Summary,
  median,
  summarizePv1Sessions,
  validatePv1SessionRecord,
} from './pv1-report-lib.mjs'

function session(overrides = {}) {
  return {
    sessionId: 'pv1-session-001',
    battleSessionId: '00000000-0000-4000-8000-000000000001',
    testerCohort: 'internal',
    firstBattleOutcome: 'completed',
    firstConfidentActionSeconds: 20,
    battleDurationSeconds: 300,
    obviousMisclickCount: 0,
    targetingConfusionCount: 0,
    outcomeUnderstood: 'yes',
    replayDisposition: 'chosen',
    tacticalDecisionRecalled: 'yes',
    ratings: {
      pace: 4,
      clarity: 4,
      responsiveness: 4,
      audiovisualImpact: 4,
      replayDesire: 4,
    },
    qualitativeNotes: ['Player described using terrain to approach the Recruit.'],
    ...overrides,
  }
}

test('summarizes the required PV-1 evidence and replay warning deterministically', () => {
  const records = [
    session({
      sessionId: 'pv1-session-a',
      firstConfidentActionSeconds: 20,
      battleDurationSeconds: 300,
      obviousMisclickCount: 1,
      replayDisposition: 'chosen',
      ratings: {
        pace: 5,
        clarity: 4,
        responsiveness: 5,
        audiovisualImpact: 4,
        replayDesire: 5,
      },
    }),
    session({
      sessionId: 'pv1-session-b',
      testerCohort: 'trusted',
      firstConfidentActionSeconds: 40,
      battleDurationSeconds: 420,
      targetingConfusionCount: 2,
      replayDisposition: 'declined',
      ratings: {
        pace: 3,
        clarity: 3,
        responsiveness: 4,
        audiovisualImpact: 3,
        replayDesire: 2,
      },
    }),
    session({
      sessionId: 'pv1-session-c',
      testerCohort: 'external',
      firstBattleOutcome: 'abandoned',
      firstConfidentActionSeconds: 30,
      battleDurationSeconds: 350,
      outcomeUnderstood: 'no',
      replayDisposition: 'declined',
      tacticalDecisionRecalled: 'no',
      ratings: {
        pace: 2,
        clarity: 2,
        responsiveness: 3,
        audiovisualImpact: 4,
        replayDesire: 2,
      },
    }),
    session({
      sessionId: 'pv1-session-d',
      battleSessionId: null,
      firstBattleOutcome: 'technical_failure',
      firstConfidentActionSeconds: null,
      battleDurationSeconds: null,
      targetingConfusionCount: 1,
      outcomeUnderstood: 'not_observed',
      replayDisposition: 'excluded_technical',
      tacticalDecisionRecalled: 'not_observed',
      ratings: {
        pace: null,
        clarity: null,
        responsiveness: null,
        audiovisualImpact: null,
        replayDesire: null,
      },
      qualitativeNotes: ['Browser closed before the battle could become playable.'],
    }),
  ]

  const summary = summarizePv1Sessions(records)

  assert.equal(summary.sessions, 4)
  assert.deepEqual(summary.firstBattleOutcomes, {
    completed: 2,
    abandoned: 1,
    soft_lock: 0,
    technical_failure: 1,
  })
  assert.equal(summary.completionRate, 0.5)
  assert.equal(summary.abandonmentRate, 0.25)
  assert.equal(summary.technicalOrSoftLockRate, 0.25)
  assert.deepEqual(summary.timeToFirstConfidentAction, { sampleSize: 3, medianSeconds: 30 })
  assert.deepEqual(summary.battleDuration, { sampleSize: 3, medianSeconds: 350 })
  assert.deepEqual(summary.obviousMisclicks, { total: 1, sessionsWithAny: 1 })
  assert.deepEqual(summary.targetingConfusion, { total: 3, sessionsWithAny: 2 })
  assert.deepEqual(summary.outcomeUnderstanding, {
    observed: 3,
    yes: 2,
    no: 1,
    unclear: 0,
    yesRate: 2 / 3,
  })
  assert.deepEqual(summary.tacticalDecisionRecall, {
    observed: 3,
    yes: 2,
    no: 1,
    unclear: 0,
    yesRate: 2 / 3,
  })
  assert.deepEqual(summary.voluntaryReplay, {
    eligible: 3,
    chosen: 1,
    declined: 2,
    excludedTime: 0,
    excludedTechnical: 1,
    notOffered: 0,
    chosenRate: 1 / 3,
    provisionalWarning: true,
  })
  assert.deepEqual(summary.ratings.pace, { sampleSize: 3, median: 3 })

  const formatted = formatPv1Summary(summary)
  assert.match(formatted, /provisional replay warning .*: YES/)
  assert.match(formatted, /not an automatic PV-1 pass\/fail verdict/)
})

test('excludes time and technical blocks from the voluntary replay denominator', () => {
  const summary = summarizePv1Sessions([
    session({ sessionId: 'chosen', replayDisposition: 'chosen' }),
    session({ sessionId: 'time', replayDisposition: 'excluded_time' }),
    session({
      sessionId: 'technical',
      firstBattleOutcome: 'soft_lock',
      replayDisposition: 'excluded_technical',
    }),
  ])

  assert.equal(summary.voluntaryReplay.eligible, 1)
  assert.equal(summary.voluntaryReplay.chosenRate, 1)
  assert.equal(summary.voluntaryReplay.provisionalWarning, false)
  assert.equal(summary.voluntaryReplay.excludedTime, 1)
  assert.equal(summary.voluntaryReplay.excludedTechnical, 1)
})

test('median is stable for odd, even and empty samples', () => {
  assert.equal(median([40, 10, 30]), 30)
  assert.equal(median([10, 20, 40, 50]), 30)
  assert.equal(median([]), null)
})

test('rejects unknown fields and likely email addresses in local qualitative notes', () => {
  assert.throws(
    () => validatePv1SessionRecord(session({ email: 'tester@example.com' })),
    /unsupported fields: email/,
  )
  assert.throws(
    () =>
      validatePv1SessionRecord(
        session({ qualitativeNotes: ['Contact tester@example.com if this needs clarification.'] }),
      ),
    /appears to contain an email address/,
  )
})

test('rejects contradictory technical replay exclusions', () => {
  assert.throws(
    () =>
      validatePv1SessionRecord(
        session({ firstBattleOutcome: 'completed', replayDisposition: 'excluded_technical' }),
      ),
    /excluded_technical only for a technical failure or soft lock/,
  )
})

test('requires battle duration when the first battle completed', () => {
  assert.throws(
    () => validatePv1SessionRecord(session({ battleDurationSeconds: null })),
    /battleDurationSeconds is required when the first battle completed/,
  )
})
