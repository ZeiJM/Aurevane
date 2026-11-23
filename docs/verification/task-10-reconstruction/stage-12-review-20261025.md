# Task 12 combined SPEC + QUALITY review — 2026-10-25

**SPEC: noncompliant. QUALITY: needs fixes. Findings: 0 Critical, 1 Important, 1 Minor.** The same two findings apply to both verdicts; they are not four independent findings. The important selection/confirmation defect must be fixed before Task 12 source acceptance. The source otherwise substantially implements the bounded Event workspace and lifecycle requirements. This is not whole-branch or release approval.

## Review identity and scope

Reviewed the complete Task 12 change from `9fdef01d705620d642f49fe696d0c2ab181b5a00` to frozen HEAD `dd62fd6aaa9579e3df145abc2dba524835123f4f`, tree `6d404f5ed60f2f7fe8efb9e2e5953325f2ddf20e`, in `/workspace/scratch/e5db2ba73c1a/aurevane-master-complete-20261025`. Independently read back HEAD/tree and clean worktree. Root reports the exact remote counterpart `161ff3eda1d9cccf4f1e6b360ff43f2d6ff8d8e1` with the same tree; this reviewer performed no remote operation.

Read the Task 12 brief, execution addendum and copied binding Global Constraints/Owner clause 19/bounded ended-to-emergency ruling before evaluating the implementation report. Used the handed-off whole-task contextual diff, 368332 bytes, independently verified SHA-256 `96c44389f42bc6fdbc5f05aae79921165d9225b4710b18cbbea9989f8cf9a102`. Reviewed changed production UI, handlers/services/stores/selected-character transport, core transition delta, migration, real SQL tests, browser fixtures/scripts, native script and workflow wiring. Focused predecessor reads established what the migration's dynamic edits actually affect; this was not a broad Master review. No helper/reviewer agents were used. No source, index, HEAD, ref, ledger or implementation-report mutation occurred.

## Findings

### I1 — Loading another event retains the previous event's live-action handle and approval

**Important; SPEC and QUALITY.** `apps/web/src/components/master/events/event-builder-client.tsx:230–253`, new saved-event selection at `:406–420`, cancellation at `:346–360`.

The new saved-event picker calls `loadWorkspace(eventKey)`, which replaces the definition and version state but never clears or rebinds `scheduledRun`, `productionConfirmed`, or `previewResult`. These values belong to the event being left. The UI can therefore display event B while enabling Unschedule for a run created under event A, using confirmation made before B was selected. Independently, confirming publication for A and choosing B leaves B's Publish action already confirmed. The ordinary field-edit path clears confirmation, but the new selection path bypasses it.

A focused actual-production-component browser probe reproduced the cross-event path, using the existing explicit HTTP fixture on Chromium 153.0.8010.0:

1. Load `event.ready`, generate its preview, and schedule it.
2. Check the consequential-action confirmation, then select `event.stale` from Saved events.
3. The displayed Event key is `event.stale`, confirmation is still checked, and Unschedule is enabled.
4. Clicking Unschedule emits `operation: cancel-scheduled`, `runId: 22222222-2222-4222-8222-222222222222`, `expectedStateVersion: 1`, `confirmed: true` — the prior `event.ready` run.
5. Opening Preview still shows the earlier preview without requesting a preview of B.

The fixture intentionally has no cancellation implementation; the emitted request and UI state prove the client defect, not a physical database cancellation. In production the normal server authority/CAS checks do not prevent this when the operator is authorized for A and its state remains 1: both target and expected version are valid, but they do not match the event the UI presents for confirmation.

**Required correction:** make event identity replacement reset confirmation and preview, and clear or explicitly bind the scheduled-run handle to its owning event. Apply the same rule to New Event and manual identity changes; do not allow a prior event's action handle to remain operable under a new identity. A focused regression should cover A→B after confirmation and after scheduling, and assert that no cancellation of A can be emitted from B's controls. If deliberately retaining a cross-event run handle, the UI must explicitly identify that run/event and require a fresh corresponding confirmation; silent retention is not acceptable.

Probe retained outside the checkout: `/workspace/scratch/e5db2ba73c1a/task12-review-selection-probe.mjs`. Its command exited 0 and printed the reproduced incorrect state/request. This was a new focused check, not a rerun of the reported suite.

### M1 — The supported audience reference still displays a raw key, and region suggestions are offered for every scope kind

**Minor; SPEC and QUALITY.** `apps/web/src/components/master/events/event-builder-client.tsx:591–611` and audience display near `:501–509`; live-list scope presentation at `apps/web/src/components/master/events/event-operations-client.tsx:363`.

The new scope field supplies a region datalist but remains an unrestricted raw-key input. After selection, the field and audience summary display `verdant-expanse`, rather than the available readable region name. Moreover, `list="event-region-refs"` applies to node and cohort scopes too, so those audiences are offered region identifiers with no distinction. The frozen desktop screenshot confirms the ordinary authoring flow shows the raw key. This falls short of Owner 19's readable reference pickers and clear affected audience, although it does not itself establish an authorization bypass.

**Required correction:** use the known region labels in the selected control and audience summaries, preserving the key internally. Only offer references appropriate to the selected scope type. For node/cohort references without a real resolver/catalogue, explicitly identify the custom/unresolved draft reference and its supported limits instead of presenting region suggestions as those audiences. Do not invent reference data or an executor.

## Root-supplied UI observations assessed

The frozen screenshots do contain `State v7`, a shortened run UUID, `Published v3`, Recent versions, Template key, and the raw scope key. The supported scope issue is M1 above. Published versions and recent publication history can help distinguish drafts, current publications and pinned runs, and the copied global contract explicitly calls for current plus two prior published versions; they are not automatically prohibited policy-management UI. The state-version/UUID and Template key exposure largely retain pre-existing controls/markup rather than newly introducing a Task 12 technical control. The state counter is internal CAS information with little ordinary operator value and would be better moved to secondary diagnostics; that is an inherited presentation observation for Task 13, not an additional newly introduced Task 12 defect. A custom template/reference field without an existing catalogue should not be replaced with invented options.

## Substantive source assessment

- Both existing routes render the combined workspace, with focused authoring/live sections. Mounted views retain draft input. Catalogue/run reads use actual persisted definitions; run titles come from their pinned definition rather than the latest publication. Draft loading now retains its original base version. The live dashboard request sequence suppresses older successful selection responses, and run controls cannot change the selected run during a mutation.
- The selected-character wrapper includes both new read RPCs. The catalogue asserts selected Event author authority, and run listing delegates to the existing selected-authority/scope-filtered list. Service-only execute grants are explicit. Existing selected overloads retain the actual authority calls; the migration changes function bodies rather than reverting them to account-wide grants. The recorded SQL tests exercise alternate selected character denial and separate global/emergency grants.
- The new runtime guard is installed in actual publication and scheduling implementation bodies, including generated selected-character overloads, not solely in UI validation. Effects/cleanup effects, aftermath, objectives without navigation, navigation-dependent objective-threshold transitions, and reward recipes have specific production blockers. Useful drafts/previews and supported clock/manual/navigation definitions remain available. The service-only historical contribution, reservation and real XP execution paths are retained. No app/worker gameplay producer or event battle join is claimed.
- Reason fields are removed from the relevant UI and TypeScript intent, with null passed through the legacy-compatible SQL argument slots. The migration makes applicable audit/receipt reason columns nullable, removes reason validation/comparison, and normalizes new reasons/notes to null while retaining confirmations, actor attribution, CAS and existing receipts. Cron's synthetic explanation literals are also removed. Server scheduling fingerprints are derived from normalized request values rather than accepted from the browser.
- Reward execution now takes the run lock before its reservation lock. The operation run read takes the run lock too; the existing inner claim re-read/deduplication and grant path remain. The fresh-award eligibility predicate requires genuine completion and rejects cancellation/emergency history even after archival. Completed same-key and new-key-deduplicated receipts are returned before the fresh eligibility check, preserving original awards. No destructive claim deletion, XP reversal or unrelated progression reset was introduced.
- The bounded ended→emergency-stopped transition is added consistently to SQL/core, while ordinary Stop still maps to resolving and cannot acquire terminal cancellation powers. The actual existing transition update preserves the previous `ended_at` when moving to emergency-stopped, and retains transition history. Existing scope/emergency authority and live version CAS remain on the exposed operator path.
- Existing pause/resume uses the persistent phase-clock trigger. Cron recovery takes run locks before phase work and excludes terminal states. The new native script checks both physical contention orders, terminal/archive late sweeps, completed replay/dedupe and transactional rollback, using the real XP grant dependency. This is good verification preparation, but its physical success is still unknown.
- Cleanup remains an explicit manual acknowledgement and archival prerequisite; it is no longer described as gameplay execution. Current source/report do not substitute ready/shutdown worker tests for an executor.

No additional concrete Task 12 settlement, privilege, historical-receipt preservation or migration-grant defect was established by this review. This statement is bounded by the unexecuted physical gates below.

## Evidence inspected and checks actually performed

1. Independently checked complete diff byte count/hash, frozen HEAD/tree and clean status.
2. Independently checked the ledger's original 410347-byte prefix SHA-256 `9e7de744dbbd0357fe57e4aa52e4ea64eaafe4fc0b57ce50ad14ced1b1bfcc8d` and all 52 Task 12 raw/gzip receipt hashes; all match. Independently compared every pre-Task-12 migration file with BASE bytes; none changed.
3. Read original CLI help/create receipts and ledger argv/source metadata. The new migration was created with `corepack pnpm exec supabase migration new event_workspace_lifecycle_safety` following the help command. The new migration remains unapplied to hosted production.
4. Read final SQL/service/core/worker/browser receipts, relevant RED/counterfactual receipt, integrity receipt, and final type/lint/format/native syntax/discovery ledger entries. Recorded focused results are 12 actual migrated-SQL/PGlite cases, 35 handler/service/transport/factory cases, 4 core and 2 worker cases: 53. Type/lint/format checks report exit 0. These suites were not rerun by this reviewer.
5. Compared the retained counterfactual source with the final SQL test source. Its only addition restores the original historical claim RPC after loading the final migrations. Its recorded two selected failures really returned 25 applied XP; this supports the archived/emergency eligibility repair. The ten other tests were deliberately not selected in that counterfactual run, not silently omitted from final GREEN.
6. Read the native script/workflow source and recorded syntax results. The script observes first-session PgSleep and second-session lock waits, then checks both outcomes, original completion timestamp, replay/dedupe, archive outcome, late recovery and whole transaction rollback. Syntax-only success is not concurrency success.
7. Inspected frozen actual-component screenshots `author-1366-1.png`, `events-390-1.png`, and `preview-1366-2.png`. Text wraps, the mobile selected run is readable, and focused section controls are evident. Read the recorded three-layout browser command/output and the actual script assertions. HTTP/session/shell transport fixtures remain explicit.
8. Ran only the focused A→B selection probe described under I1. No force-clicks, raised timeouts, test skips, source modifications or backend simulation changes were needed to reproduce the product-component state error.

## Cannot-verify groups and acceptance boundaries

- **Physical database/concurrency:** no local two-connection PostgreSQL execution, migration-chain execution, pg_cron installation/physical timing or CI result was established. PGlite validates real function behavior in serial transaction orders, not physical lock contention. New native script syntax/wiring does not close this gate.
- **Authenticated/full application:** the recorded authenticated Playwright run is discovery only. Local fixture browser checks do not establish selected-session integration, full app navigation, real API/database communication or full authenticated lifecycle execution.
- **Browser/device:** inspected/rerun local component work uses Chromium 153.0.8010.0. Pinned 151, true browser 200%, physical device/keyboard/touch and complete production shell verification remain open. CSS zoom 2 must not be reported as browser 200%.
- **Hosted/release/whole branch:** no hosted mutation, migration apply, cron enablement, final exact-head full check, deployment, whole-branch review or Task 13 acceptance was performed here. Existing Task 10/11 acceptance boundaries and other final Task 13 obligations are unchanged.

These disclosed pending gates are not counted as newly introduced findings, because the binding handoff explicitly places them with root/Task 13. They must remain open. Repair I1 and M1, retain the source freeze/evidence discipline, and return the bounded delta to this same combined reviewer before Task 12 source acceptance.
