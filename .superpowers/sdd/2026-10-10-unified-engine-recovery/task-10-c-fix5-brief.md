# Task10 cumulative repair round5 — Stage C source findings

This is the fifth and final cumulative Task10 repair round, not a new counter per stage. A prior implementer completed C and earlier Task10 repairs consumed rounds1–4; you own the bounded C repair now with a fresh context. Read task-10-c-brief.md first — it is the requirements with exact values — then task-10-c-report.md and the full independent findings at /workspace/scratch/e5db2ba73c1a/master-stage-c-review-20261022.md. Do not read the entire plan or history.

FixBASE a580fd7263ac253570440d488fcf08b98267ba6c, tree f1a3dcafd4629807657f0d2b27b016b66228c15f. Same existing worktree, sole implementer, no helpers/reviewers. Root owns source publication, freshness, native and hosted operations. Stage D discovery is stopped. No concurrent product editor.

## Required bounded repairs

Implement the three Important findings I1/I2/I3 exactly as described by reviewer, preserving real existing producer and retained interfaces:

- I1: retained historical Tag envelopes remain readable/correctable (4000-character original description envelope and stable noncanonical record identity), while new canonical presentation/publication constraints remain enforced at their correct boundary. Do not weaken canonical published snapshots or drop old rows.
- I2: actual create record/API producer must bootstrap canonical implemented Tag identity, preserving selected-actor capability, stable identity/CAS/idempotency/retry. Unsupported canonical Tag duplication must be specific and truthful. Test the actual command/store path and subsequent publication/current/exact contracts; direct SQL alone missed the defect.
- I3: discriminate supported Barrier percentage and relative-power bases in typed reference extraction. Both positive and wrong-reference rejection controls are required. Prose remains presentation; no mechanics/balance/unit changes.

Minor M1 (HP percentage recovery actual-healing choice) is recorded deferred to D/final integration; it does not trigger this fix loop. Inherited Vite warning M2 stays unsuppressed. Do not expand into shell, Tag Library UI, native fixture repairs or a new physical harness.

## Verification/report

Meaningful RED/GREEN covering tests only. Starting named covering files: packages/game-core/src/content/authored-content.test.ts; packages/game-core/src/combat/battle-narration.test.ts; apps/web/src/server/master/combat-content-record-command.test.ts; packages/db/src/combat-content-media.test.ts if changed producer/persistence contracts require actual lifecycle proof. Add precise nearby real integration controls as necessary, not mirror mocks. Keep existing assertions. Native quality has already corroborated I1 (5507pass/1fail in authored-content test); preserve that context rather than interpreting old test as obsolete automatically.

Preserve verification.jsonl byte prefix and previous immutable compressed logs; append exact command/cwd/start/end/exit/log-path/SHA256. Frozen corepack pnpm, affected types/lint/format/diff only. No package-wide test, pnpm check, timeout relaxation or assertion suppression. Finalize with root current-main check, coherent local commit and clean tree; root backs remote.

Append fix5 report with findings addressed, exact commands and observed outputs to task-10-c-report.md. Also write short task-10-c-fix5-report.md if useful for handoff; keep the original report and evidence intact. Return status, FixBASE/HEAD/tree, one-line verification and concerns; stop for same combined reviewer's scoped re-review. No Stage D/11/12/13 work or hosted actions.

## Independent native gate remains open

C Database foundation120129353597 passed the full migration/43actor/privateACL/Players/Event/physical-lock chain. C frozen install/audit/format/lint/types succeeded before quality stopped on I1. Modular reader job120129354088 passed current/pinned readers, Basic Restore and Primed6 but standalone simple-Requirements Vite harness timed out at browser-simple-requirements-regression.mjs90 awaiting window.simpleRequirements (0cases). Root's local Chromium attempt cannot launch due runtime socket/ptrace restrictions; no source cause established. Do not guess a product fix, retry blindly, or claim this gate passes. It remains required for focused native diagnosis/final integration; no new broad browser work in this repair dispatch.
