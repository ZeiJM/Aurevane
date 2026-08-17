# AUREVANE — PV-1 Tactical Combat Playtest Protocol

**Status:** Internal validation procedure supporting `docs/ROADMAP_PRODUCT_VALIDATION.md` PV-1.

**Purpose:** collect comparable human evidence about whether the Phase 2 tactical combat slice is understandable and worth replaying before substantial Phase 3 expansion.

This protocol does **not** change the PV-1 gate. It makes the required evidence repeatable. Real human observation remains mandatory.

---

## 1. Privacy and record handling

Use a pseudonymous session identifier such as `pv1-internal-001`. Do not record tester names, email addresses, IP addresses, account handles, or other unnecessary identity information.

Keep working session files under the repository's ignored `.local-validation/` directory, for example:

```text
.local-validation/pv1-sessions.json
```

The production telemetry boundary stores only the server-derived events defined by PV-1A. Qualitative research notes remain local unless a later reviewed privacy/data-retention design explicitly changes that rule.

A committed synthetic example is available at:

```text
docs/examples/pv1-tactical-playtest.example.json
```

---

## 2. Test conditions

Record the tester cohort as one of:

- `internal` — project owner/developer/internal QA;
- `trusted` — invited trusted tester who is not part of the implementation team;
- `external` — representative external tester when the slice is ready for the broader PV-1 cohort.

Before the session:

1. use the representative Tactical Hall/combat build rather than a debug-only rules harness;
2. confirm the build loads and account/character setup is not the intended subject of this session;
3. do not explain the optimal move, target, facing choice, or intended tactical lesson;
4. tell the tester they may ask what a control means, but first observe whether the interface answers the question itself;
5. have a timer available for the first-confident-action and battle-duration fields.

Do not coach a player into saying they made a tactical decision before the decision-recall question is measured.

---

## 3. During the first battle

### Start timing

Start the **first confident action** timer when the battle becomes interactable. Stop it when the tester deliberately commits an action and can explain what they expect it to do without facilitator correction.

If that never happens, record `null` rather than inventing a time.

Start the **battle duration** timer when the battle becomes interactable. Stop it when the first battle reaches its terminal state. A completed first battle requires a duration value; a technical failure may use `null`.

### Count visible friction

Increment `obviousMisclickCount` when the tester clearly activates the wrong control/board element and immediately recognizes it as unintended.

Increment `targetingConfusionCount` when the tester visibly cannot determine what may be targeted, which target is selected, why a target is illegal, or what Confirm will commit.

Do not count a deliberate bad tactical choice as a UI misclick merely because it loses value.

### First-battle outcome

Use exactly one:

- `completed` — the battle reached a normal terminal result;
- `abandoned` — the player intentionally left/aborted the battle without a technical blocker;
- `soft_lock` — the player could not make meaningful progress because the experience appeared stuck or unrecoverable;
- `technical_failure` — a crash, server/browser failure, broken load or equivalent technical issue prevented the intended test.

---

## 4. Post-battle questions

Ask these after the first battle without telling the tester what answer is desired.

### Outcome understanding

Ask a neutral question such as:

> What do you think caused that outcome?

Record:

- `yes` — explanation materially matches what happened;
- `no` — explanation is materially wrong;
- `unclear` — mixed/partial understanding;
- `not_observed` — the question could not reasonably be measured.

### Tactical decision recall

Ask:

> Can you name one decision you made in that battle that you think mattered?

Record the same `yes` / `no` / `unclear` / `not_observed` scale. Do not supply examples until after this field is recorded.

### Voluntary replay

When practical, make another battle/retry genuinely available without sales language or pressure. Record one:

- `chosen` — tester voluntarily starts/chooses another available fight;
- `declined` — tester is eligible and chooses not to;
- `not_offered` — no meaningful replay choice was presented;
- `excluded_time` — tester could not choose because the agreed session time ended or another external time constraint intervened;
- `excluded_technical` — a technical failure/soft lock prevented a fair replay choice.

The report excludes `excluded_time` and `excluded_technical` from the replay denominator. `excluded_technical` is valid only when the first-battle outcome was `technical_failure` or `soft_lock`.

---

## 5. Ratings and qualitative notes

Use integer ratings from 1 (poor) to 5 (strong), or `null` if not observed:

- `pace`;
- `clarity`;
- `responsiveness`;
- `audiovisualImpact`;
- `replayDesire`.

Keep optional `qualitativeNotes` concise and behavioral where possible. Examples:

- useful: `Tester repeatedly checked Turn Economy before committing the second move.`
- useful: `Tester chose a longer route to avoid rough ground and described why.`
- weak: `Combat is awesome.`

Do not put names, emails, handles or unrelated personal detail in qualitative notes. The report tool rejects obvious email-address content and unexpected record fields as a basic guardrail.

---

## 6. Record format

Each JSON record must contain:

```json
{
  "sessionId": "pv1-internal-001",
  "battleSessionId": "00000000-0000-4000-8000-000000000001",
  "testerCohort": "internal",
  "firstBattleOutcome": "completed",
  "firstConfidentActionSeconds": 34,
  "battleDurationSeconds": 428,
  "obviousMisclickCount": 1,
  "targetingConfusionCount": 0,
  "outcomeUnderstood": "yes",
  "replayDisposition": "chosen",
  "tacticalDecisionRecalled": "yes",
  "ratings": {
    "pace": 4,
    "clarity": 4,
    "responsiveness": 5,
    "audiovisualImpact": 3,
    "replayDesire": 4
  },
  "qualitativeNotes": ["Short local research observation."]
}
```

`battleSessionId` may be `null` if a technical failure prevents a battle session from existing. It is a stable correlation identifier, not a player identity.

---

## 7. Generate the decision-support report

From the repository root:

```bash
pnpm validation:pv1-report .local-validation/pv1-sessions.json
```

For machine-readable output:

```bash
pnpm validation:pv1-report .local-validation/pv1-sessions.json --json
```

The command validates the records before reporting. Invalid enum values, duplicate session IDs, missing required completed-battle durations, contradictory technical exclusions, unexpected fields and obvious email-address content fail closed.

The human-readable report summarizes:

- first-battle completion, abandonment and technical/soft-lock rates;
- median first-confident-action time;
- median battle duration;
- misclick and targeting-confusion frequency;
- outcome-understanding and tactical-decision-recall observations;
- eligible voluntary-replay rate with exclusions reported separately;
- median 1–5 ratings;
- the roadmap's provisional replay warning when fewer than 50% of eligible observed testers voluntarily choose another fight.

---

## 8. Gate review

Do **not** declare PV-1 passed because a single percentage is green.

Review together:

- the generated metrics;
- qualitative notes and recurring behavior;
- technical failures and soft locks;
- sample size and tester cohort composition;
- whether facilitators had to explain controls;
- whether testers discuss tactical choices rather than mainly fighting the interface;
- whether replay desire is voluntary and repeatable.

The binding decision standard remains:

> PV-1 passes when evidence shows repeatable voluntary replay desire and testers are discussing tactical choices rather than mainly fighting the interface.

If the gate fails, open the smallest corrective Phase 2/PV-1 ticket around input feel, targeting clarity, pacing, encounter design, terrain, enemy behavior, turn feedback, audiovisual timing or information density. Do not use more classes, regions or metagame systems to hide a weak combat loop.
