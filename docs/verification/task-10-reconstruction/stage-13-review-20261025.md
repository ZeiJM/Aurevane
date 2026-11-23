# Task13 combined SPEC + QUALITY review — 2026-10-25

**Spec compliance: ❌ Issues found.** The required System-original workflow loses its restore affordance after mutation, and the new true-200% acceptance source does not exercise the required operational states/interactions at that zoom. **Task quality: Needs fixes. Counts: 0 Critical, 2 Important, 1 Minor.**

Review range: `393fa9654a56ea739f544aa150fd8c2ecbbd6a12` → `8060c4fddf5037fbf8c9b512717b1a72b7544e10`, frozen tree `a500b5795729e946b38bb2dae913d2f269bff2c2`. This is the sole combined task review, not the later whole-branch or release gate. Root reports exact remote tree/readback equality. All repository paths below are relative to `/workspace/scratch/e5db2ba73c1a/aurevane-master-complete-20261025`.

## Strengths and verified scope

- The original restore path has the right authority boundary: HTTP accepts identity/version/source intent, rejects an injected definition, and the server resolves an exact executable source. The migration retains the existing selected-actor, catalogue-lock and revision machinery, creates a draft rather than fake v1 history, and publishes a distinct new immutable version. See `apps/web/src/server/master/combat-content-record-command.ts:58`, `apps/web/src/server/master/combat-content-builtin-index.ts:90`, `apps/web/src/server/master/supabase-combat-content-authoring-store.ts:484`, and `supabase/migrations/20261025080018_combat_content_builtin_restore_source.sql:20`.
- The all-five test genuinely uses actual handler/store/SQL/catalogue/execution boundaries, rather than a parser-only substitute. It starts without physical Basic history, first publishes edited v2, restores original v1 into a draft, publishes v3, checks actual AP/mechanics and public Basic reader data, and retains old captures and exact v2. See `apps/web/src/server/master/combat-content-tag-lifecycle.test.ts:307`. The SQL transport and session identity are controlled test boundaries, disclosed in its fixture; this is not physical concurrency or full authentication.
- The shared lifecycle SQL finalizes real bytes, checks unpublished privacy, canonical Tag binding, forged media/Tag rejection, stale-token draft retention, deep immutable definitions/media and pointer attribution. The physical race source extends the whole-state snapshot with publications/media/references and adds both Tag/Skill and original/publication lock orders plus rollback. See `.github/scripts/verify-master-content-lifecycle.sql:12`, `.github/scripts/verify-combat-catalogue-concurrency.sh:26`, and `:209`. Existing producer races remain. Actual native execution remains pending.
- The dynamic migration checks its main predecessor fragments before replacing them, operates on the current function definitions rather than replacing the entire migration history, and adds no browser/service table grants. Existing function ACLs survive CREATE OR REPLACE; the expanded actual-SQL actor inventory checks 45 contracts. See migration `:11`, `.github/scripts/verify-master-panel-staff-authority.sql:129`, and `packages/db/src/combat-content-record-lifecycle.test.ts:639`.
- The fixture repairs retain meaningful semantics: P34 changes only the retained count; startup adds committed authority and an explicit stale-source denial; rebalance uses an isolated historical predecessor inside rollback; semantic reader tests retain strong/tag-label structure and ten-field assertions. No force click, blanket shim, suppression, dependency change or gameplay downgrade appears in this Task13 source range. The `.mts` conversion is a bounded ESM configuration fix.
- Nexus measurements establish eight cards per row, 64px artwork, and zero recorded row overflow at both desktop sizes. Mobile preservation receipts remain distinct. The contrast repair retains approved `#79551c`, uses an actual paper preview surface, and measures the computed background/gradient endpoints at the unchanged 4.5 threshold. See `character-skill-build-panel.module.css:1652`, `game-content-workspace.module.css:150`, and `skill-parameter-palette-browser-regression.mjs:445`.
- The World cadence test saves the real one-minute settings, observes natural `/api/world` responses and the mounted panel/canvas, requires Day/Night, a Master weather period and expiry to live weather, and records actual paint changes. It does not substitute time, refreshes or expiry. See `apps/web/e2e/master-world-environment-cadence.pw.ts:91–177`. Its assertions are substantive source coverage, although actual native timing/renderer behavior remains unproved here.
- Operational/eligibility/Event scripts are wired to execute in native browser CI. The real200 mechanism uses the extension API, automatic per-tab zoom, getZoom readback and changed CSS viewport, not CSS scale or deviceScaleFactor. These are useful foundations; the interaction gap below remains. See `.github/workflows/browser-smoke.yml:72`, `apps/web/e2e/master-complete-layout.pw.ts:101–153`.

## Issues

### Critical

None.

### Important

**I1 — Mutation responses drop the server-derived System-original capability, breaking the required immediate edit → publish → restore workflow.**

`apps/web/src/server/master/supabase-combat-content-authoring-store.ts:357,516,561`; `apps/web/src/components/master/combat-content/combat-content-authoring-workspace.tsx:185,525`; `apps/web/e2e/master-combat-content-authoring.pw.ts:1074–1083`.

Only `readRecord()` adds `builtinRestoreVersion`. `writeRecord()` and `publishSaved()` return the raw parsed SQL projection, which has no such field. `mutate()` installs that response directly with `accept(result.record, ...)`; its subsequent refresh lists records and does not reread the selected complete record. The History section renders the System-original button only when `record.builtinRestoreVersion` exists. Thus saving or publishing an edited builtin removes the button and instead reports that its indexed source is unavailable until the operator explicitly reselects/reloads it. The newly added native all-five test publishes, opens History and attempts this missing button, so it should fail at that first restore rather than prove the intended chain.

Apply the same server-derived enrichment to all complete-record responses, including save, restore and publication, without an extra authority-changing publication step. Add a regression that consumes real mutation response shapes through the mounted editor and performs edit → save → publish → original restore without reselecting the record. The current UI test supplies the capability in its fixture and the SQL-chain test calls restore directly; neither covers this loss.

**I2 — The new true200 gate checks initial route visibility, not the required finished workflows and states at 200%.**

`apps/web/e2e/master-complete-layout.pw.ts:166–200`, especially `:190–194`; Task13 brief scope item 5 and execution addendum native/browser requirements.

After genuine zoom, each route only checks its navigation/title, root document horizontal overflow, a single Tab leaving `document.body`, and a screenshot. That Tab can focus the shared header; it proves neither reachable Master controls nor focus visibility. The true200 loop never edits, saves, opens a disclosure/history, triggers validation, creates a dirty state, or exercises a long/empty/error state. A clipped or overlapping workspace with inaccessible form actions can pass all those assertions. The later touch action only navigates to Players, outside true200. A focused search of the Master native tests found no other real browser zoom coverage to supply these missing interactions.

Extend the real200 session with representative actual Master form/reader interactions and the required long/empty/error/dirty states, meaningful keyboard activation/focus assertions, and relevant control/container visibility/overflow checks. Reuse existing authenticated operations where possible; retain the real zoom/readback and current strictness. This is a source coverage omission, not a finding merely because Root has yet to run native CI.

### Minor

**M1 — Restoring a stored publication derived from System loses its known System authorship label.**

`supabase/migrations/20261025080018_combat_content_builtin_restore_source.sql:36,46–47`; `apps/web/src/components/master/combat-content/combat-content-authoring-workspace.tsx:579–582`.

Direct original restoration publishes a version with null human author/time and `restoredSource='builtin'`, which the reader correctly labels System. If the operator subsequently uses ordinary History restore on that physical version, the stored-version branch explicitly clears `restored_source`; publication retains its null original author/time through the existing attribution lookup. The new version therefore renders “Authored by Unknown” despite a known System-origin chain. The physical source version and mechanics remain intact, so this is an attribution presentation gap rather than a lost snapshot.

Preserve System authorship origin independently of the immediate restore source, or derive the author label from the retained attribution chain. Do not simply call the immediate physical v3 source “System original v3.” Cover original → publish v3 → stored-v3 restore → publish v4, retaining honest immediate-source and authorship labels.

## Nexus geometry clarification

The final report's “side-by-side group” wording is inaccurate for the Techniques chooser, but the artifact does **not** demonstrate a newly broken layout. The exact Owner specification `docs/superpowers/specs/2026-10-01-techniques-support-action.md:3` requires an eight-Skill Primary desktop row, another eight-Skill Secondary row and a third Support row. Production `.techniqueArea` is one column (`character-skill-build-panel.module.css:271–275`) and each `.skillGrid` is eight columns (`:324`).

At 1366px, the RED groups both span x=26.78125 to 793.71875, with y=109.0625 and 310.140625. GREEN uses the same horizontal bounds and y=109.0625 and 322.140625; artwork is 64px. The 1440px GREEN likewise has vertically separated rows. The Task13 hunks change artwork sizing/color and the eligibility label, not the groups' vertical relationship. The inspected screenshot agrees. Preserve this exact Owner row arrangement; correct the report's loose “side-by-side” phrase rather than inventing a new layout change. The broader Nexus Discipline-selector arrangement is outside this Task13 change.

## Cannot verify from this source review / Root gates

- Physical PostgreSQL blocking and complete rollback in both lock orders, native byte/Tag lifecycle, all selected-authority checks, corrected startup/P34/staged fixtures. PGlite shared SQL execution is credible serial evidence and cannot establish physical contention.
- Pinned Chromium151/full authenticated browser execution, the actual extension worker/200% measurements and screenshots, genuine device keyboard/touch behavior, repeated media decode/uploads and real-time World cadence. Source compilation/discovery and local Chromium153 receipts do not close these gates. I1/I2 must be corrected before treating their relevant gates as acceptance evidence.
- Fresh actual main/production/hosted catalogue/exact retained history/player facts/security advisors, necessary migration inventory/application by original identity, canonical READY deployment/runtime, and human gameplay/multiplayer/load acceptance. No hosted or release action was performed in this review.
- The report's 20-section/addenda map largely reuses accepted Tasks8–12 and unchanged engine/readers. This task review examined their changed integration boundaries; it is not an independent re-audit of every unchanged Owner feature. The separate whole-branch review remains required. Task11's older migration-CLI evidence gap remains historical; the new Task13 original receipt does not resolve it.

## Checks actually performed

- Read the handoff, Task13 brief/addendum, binding constraints, report and task-reviewer skill template. Read every changed source/test/CI/migration hunk in the supplied whole-range package in bounded chunks. Output-truncated sections were recovered; repetitive raw artifact inventory/ledger data was parsed instead of repeatedly printed. No git diff or ref/source/index mutation, helpers, remote action, hosted action or test-suite rerun.
- Confirmed package size 372738 bytes and SHA256 `8b494328919e87e0e71d57fb53d9df2b2e8f43d8629b7a40de43fec1bd477739`. Confirmed the 470454-byte ledger prefix SHA256 `f8a0c43acbc1a29ef1a42b9ee2af4e2911a5d961bf008b33cfa5cb6cef78a3e7`.
- Parsed all 62 Task13 receipts and verified every referenced gzip and decompressed raw SHA. Parsed all 528 diagnostic inventory paths (none missing), and verified size/SHA for all 465 browser-manifest artifacts. Inspected selected raw RED/GREEN, CLI-create, final-focused and integrity logs. Failures remain failures, including green-labelled attempts.
- Inspected full-check log summary/version and warning diagnostics: pinned11.17.0; core5663, DB331, Web6797, validation106, audio17, realtime3, worker2; 12919 Vitest plus7 Node tests; format/lint/types/build passing. The matching full-check raw/gzip hashes were verified through its receipt. No warning diagnostic was found; the named passing warning test is not a diagnostic. Six unchanged type tasks were cached, as disclosed. These results do not cover new native test execution.
- Inspected actual Nexus 1366 screenshot, both final Nexus metrics and the final1366 MP Recovery paper-preview screenshot. Checked preserved failure controls and actual gradient RED evidence.
- Focused outside-diff/context reads were limited to named risks: mutation capability retention (cut-off store returns, command dispatch and editor accept/mutate); chained original attribution and dynamic-function replacement (existing SQL definitions); true200 complementary coverage and fixture serialization (Master test references/config/Owner helper); World observer fidelity (actual environment, panel and renderer); precise Nexus Owner row relationship (Owner row spec, production layout and reused harness). These reads resolved concrete integration questions; no broader engine or unrelated accepted-feature crawl was performed.

**Assessment:** Most integration repairs and evidence handling are disciplined and substantive. I1 breaks the central new user workflow, and I2 leaves a mandated acceptance boundary unexercised; fix both before source approval, retaining the explicit pending native/hosted/release gates.
