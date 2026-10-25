# Task13 consolidated native fix round4/5

This is continuation of the accepted Master Panel implementation, not a restart. A prior implementer attempted this task three repair rounds; you own the next consolidated repair now. Read the original task brief and appended report for what was tried. Root has read the SDD fix-loop contract and is escalating this round to a fresh capable implementer. No helpers or worker-spawned reviewers.

Repository/worktree: `/workspace/scratch/e5db2ba73c1a/aurevane-master-complete-20261025`.
Original requirements, read first: `.superpowers/sdd/2026-10-10-unified-engine-recovery/task-13-brief.md`.
Append your report to `.superpowers/sdd/2026-10-10-unified-engine-recovery/task-13-report.md`.
Verbatim Global Constraints: `/workspace/scratch/e5db2ba73c1a/task13-fix3-binding-global-constraints.md`.
Read applicable AGENTS/domain instructions and the original brief's exact acceptance contracts. Never read another plan's workspace or start Task14/15 roster work.

## Frozen starting point

Local HEAD `a38acb715610063afe9d88204cc039768716bf78`, reviewed product HEAD `874115d1da999874b06862a22718ddf5b0ed6c22`. Full candidate tree `86061009e6b98f486013fc1c0d2928abc8ab6ab2` includes the single scoped review report.
Exact fetched remote candidate `77f8e0c0474f22274bbb09adbcb68ccd7bb84800`, on both `agent/master-resume-20261025` backup and PR972 head branch `agent/master-complete-20261022`.
Actual native synthetic checkout `7bd3eecee02a1fe1cca23ba440961c75630b968e` has the identical reviewed tree. Both central and Browser planners selected execute=true/full/battle=true/edge=true, not reuse or docs-only.
Actual main last independently fetched unchanged `ff4467ed7284b7c2497caf4df6dff6669043ca39`. Preserve released scoped CI, World receipt clocks/rendering and mobile Chronicle/rails/preview repairs and ancestry.

Round3 scoped verdict: SPEC compliant, QUALITY approved, zero Critical/Important, one new deferred Minor M2 (retained local transport color/sandbox noise; do not polish-rerun). Report `docs/verification/task-10-reconstruction/stage-13-fix3-review-20261025.md`. Inherited M1 System-derived restore authorship display remains for final whole-branch triage. Prior I1/F1/I2 source findings remain addressed and must not regress.

Ledger `docs/verification/task-10-reconstruction/verification.jsonl` is593047 bytes SHA256 `ef3e42d755c977aeacb0f1c017b34a5cc3bd5c95ad1ed73317cd475d0ffb224f`; preserve this full prefix as well as original470454 and dispatch560710. Round3 has39 new receipts. All old artifacts and migration bytes are immutable. Root's recent progress.md additions record round3 verdict/M2 and are coordinating notes; do not discard them.

## Actual native candidate2 feedback (matrix still running)

Latest collection:12 workflows successful,2 failed,6 still running. This is not the complete feedback list. Root will collect and append remaining actual failures into THIS round. Work on known failures now; request an immutable intermediate backup if useful. Do not call final wave frozen/review-ready until Root confirms the complete native matrix has finished and supplies late feedback.

### N8 Battle Session: later PvP admission failure

Workflow40221867756, job121254970094. Full safe decoded log `/workspace/scratch/e5db2ba73c1a/native-candidate-2-sanitized/job-121254970094.log`,89259 bytes, SHA256 `1ad9a6bc4c0e64eb99f2e7a7e71fcc1974e9d680ff2e656b1c49d5fa727c0105`.

The prior N2 captured startup proof now passes actual physical pgTAP:24 tests. Session persistence, concurrent ordering/history, service-only event reads, privacy journal and PV1 telemetry all pass. The first failure is step14 `bash .github/scripts/verify-pvp-authority.sh`:

```
ERROR: PLAYER_PREPARATION_STALE
CONTEXT: PL/pgSQL function guard_player_battle_admission_v1() line29 at RAISE
SQL statement insert into app_private.battle_participants (...)
PL/pgSQL function create_pvp_battle_session_v1(uuid,uuid,text,integer,integer,jsonb,jsonb) line136 at SQL statement
```

Diagnose actual authority/snapshot/version/selected-character boundary before deciding whether fixture or runtime is wrong. Preserve the correct current resolver and stale-admission guard. Do not waive guard, replace originals/current content with fabricated v1, silently admit stale sources, bypass transaction, or weaken zero-orphan/capture/privacy/history assertions. Root has not diagnosed the cause yet. Later map/unseat/spectator/CSR/API steps were skipped, not passed.

### N9 Discipline Build: later Essence authority failure

Workflow40221867896, job121254970762. Full safe decoded log `/workspace/scratch/e5db2ba73c1a/native-candidate-2-sanitized/job-121254970762.log`,88474 bytes, SHA256 `02dabdfba6af1221492ff35230d14e18c20e0064d5090fdb2a84386129b53576`.

Temporary zero-second policy proof, original-policy matrix setup, P31 Primary, P32 Secondary, P34 loadout and prior repaired P35 Resonance pass. First failure is step14 `source .github/scripts/verify-p36-essence.sh`; opaque parent trap prints `P3.6 verifier failed at line3` with exit1. Obtain exact inner query/assertion failure via bounded diagnosis, not guesses. Root has not diagnosed it. Preserve immutable selected versions, pure/mixed rules, capacity, all negative tests and ACLs. Support Action, saved loadout, restored policy, representative authority and rebalance steps were skipped, not passed.

## Workflow and evidence rules

Root coordinates remote/GitHub/hosted/release actions. You make no remote or hosted changes. No auth flow or deployment. User's routine/final live-release authorization already exists; do not ask for design/deploy approval.
Keep one consolidated repair diff for this wave. Actual current errors are the source of truth; implement RED reproduction/covering proof at the actual boundary, retain failures, then narrow corrections. No timeout inflation, arbitrary first locators, force clicks, retries masking application bugs, skipped gates, discovery-as-execution claims, or HTML/JSON-only substitutes for real native behavior. Keep real browser200 extension/readback/halved viewport/CSSzoom1, natural World cadence/expiry/paint and all negative/geometry budgets.
The local usable browser is Chromium153, with PGlite instead of physical Postgres/Docker. Report these honestly. Existing actual native proof is supplied by Root; no relabeling local tests as native. Pin Node24/corepack pnpm11.17.0 as repository specifies.
Do not rerun unchanged all-five matrices or whole suites without a changed source/failure/new risk. Cover amended code meaningfully, types/lint/format and relevant existing guards. Root runs final fresh exact-head native configured matrix.
Append actual command/cwd/source/timestamps/exit/raw+gzip hashes to the ledger; preserve old evidence, originals, player facts, roster pointers, all migrations and Vercel Git lock. Archive safe native diagnostics and source provenance; do not commit raw private traces/credentials. Refresh actual main immediately before final commit via Root. Self-review, commit intended files, confirm clean source, and return HEAD/tree, brief test result, remaining native/hosted boundaries and an immediate-backup request. Root supplies same-seat scoped review after final feedback is complete.
