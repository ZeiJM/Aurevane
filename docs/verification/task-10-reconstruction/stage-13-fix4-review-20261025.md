# Task 13 — same-seat scoped fix round 4/5 review, 2026-10-25

**SPEC: COMPLIANT for the scoped source repair. QUALITY: APPROVED with one nonblocking new Minor. Counts: 0 Critical / 0 Important / 1 new Minor.** N8, N9, masked P38, N10 and N11 are addressed. Native acceptance for the new head remains pending. Inherited M1/M2 remain deferred to the agreed whole-branch triage and are excluded from these counts.

## Boundary and method

Reviewed the supplied `task13-fix4-scoped-review-package-20261025.txt` from previously reviewed `a38acb715610063afe9d88204cc039768716bf78` through candidate `929fb7c0d37ab3c87a8b80a192abd29bb2e8b494`, tree `890db63ddd088a6aaa8f5d7fb75a6e76375aeee2`, including both intermediate and final repair commits. Root supplies immutable remote `3f8418d37ee7aca3fa6773acdf108007419d41a4` with the exact tree; Root owns fetched readback. I independently checked local HEAD/tree and clean worktree at review entry and immediately before writing this report. A subsequent report-only commit is outside the reviewed product candidate.

This is the sole same-seat combined spec/quality fix review. Read the initial and late round4 briefs and appended report, and applied the already-read original Task13 brief, task-reviewer method and verbatim Global Constraints. Product/test hunks were read in bounded sections; large evidence files were inspected at their named source paths rather than treated as executable results merely because they appear in a diff. No helpers, suite reruns, browser runs, product edits, remote writes or hosted operations were performed by this reviewer.

The scope preserves originals, physical history/current pointers, roster/player facts, selected-character authority/live CAS, saved/publication/restore boundaries, genuine200/natural-time/negative/geometry budgets and released `ff4467ed7284b7c2497caf4df6dff6669043ca39` CI/World/mobile behavior. No runtime authority function or migration is changed. The only production behavior change is the scoped Master CSS scroll margin.

## Dispositions

### N8 — prepared PvP authority captures: ADDRESSED

`.github/scripts/verify-pvp-authority.sh:138` obtains both current committed v2 captures under their respective user/selected-character identities and adds the actual character/combatant identities. The jq snapshot includes these captures at `:152`. It does not invent a source hash, selected version or obsolete v1 definition. Admission still performs its own current-authority comparison inside the existing transaction.

At `:208`, the native verifier independently makes each participant's sourceHash stale and requires the actual `PLAYER_PREPARATION_STALE` rejection before valid admission. `:215` requires zero matching sessions, zero participants for the two characters and the same ready lobby. The successful native admission and replay checks remain after those negatives. No stale guard, private role restriction or existing history/privacy assertion is removed.

The added actual-migration test at `packages/db/src/combat-content-record-lifecycle.test.ts:1333` consumes the verifier's character/capture SQL and actual jq payload. At `:1410` it independently corrupts sourceHash, buildVersion, catalogueToken and selected character for each of two captures, checking denial and the zero-session/zero-participant/ready-lobby result after every rejection. At `:1426` it requires legitimate admission, replayed session identity and exact stored captures. The existing `denied` helper uses a savepoint and rollback, keeping negative attempts independent. The retained N8 RED shows the original missing-capture payload rejected with `PLAYER_PREPARATION_STALE`; the repaired proof passes on the actual migration chain.

Limit: the PGlite adapter uses bound admission parameters and is not the complete native shell/physical PostgreSQL journey. The current getter returns structured identity/version/hash references rather than free-form rendered definitions; focused source inspection found no new quote-bearing definition payload in this fixture's SQL interpolation. The physical script and later same-workflow unseat/spectator/CSR/API steps remain Root's native gate. No local result is presented as those steps having executed.

### N9 — selected Essence version: ADDRESSED

`.github/scripts/verify-p36-essence.sh:67` changes the selected Vanguard Essence and selected Skill expectation from v1 to actual immutable v4. The diagnostic RED explicitly reports the full expected-v1/received-v4 scalar, establishing the reason for the change. Historical v1 existence checks, pure/mixed/remove-Secondary behavior, mastery/capacity and private-access assertions remain. The safe line-number trap at `:3` makes another failure identifiable without printing credentials. There is no resolver, current pointer, publication or retained-row edit.

The expanded verifier adapter at `combat-content-record-lifecycle.test.ts:1228` executes P35–P38 SQL on real migrations, handles escaped query strings and native payloads, checks each scalar expectation, and verifies that every parsed scalar assertion was reached. It preserves expected locked/atomic/illegal-capacity errors at `:1277`; these do not become permissive successful paths. The existing transaction-per-test boundary rolls back fixture policy and content changes.

### Concretely masked P38 retention assertion: ADDRESSED

`.github/scripts/verify-p38-representative-buildcraft.sh:152`–`:157` renames the obsolete two-retained expectation and requires three retained selections, consistent with accepted three-per-source/four-total authority. The actual mixed payload at `:159` still selects two Vanguard plus two Lifebinder Skills, and the snapshot requires four selections from two sources. The illegal four-from-one-source call at `:196` still must fail with `DISCIPLINE_SKILL_SOURCE_CAPACITY_EXCEEDED`.

This is a narrowly demonstrated blocked-downstream fixture mismatch, not a roster/capacity redesign. The retained direct-SQL RED exposes two-versus-three; the downstream GREEN executes eight focused cases covering P35–P38 scalar expectations and relevant native transaction SQL. The adapter also retains unlock/replay checks and P37 locked/atomic negatives. Separate Support two-process races, authenticated shell/HTTP and physical scripts are not inferred from the in-process SQL execution.

### N10 — exact selected editor identity: ADDRESSED

`apps/web/e2e/master-combat-content-authoring.pw.ts:376` factors the already accepted workspace/exact-name/level2/count-one heading check and uses it for Forceful Strike, Gash (`:597`) and Flame Burst (`:652`). No arbitrary first match, removed sample, timeout increase or mechanics assertion deletion. A focused same-file heading audit finds remaining page-title headings and the explicitly scoped elevation editor heading; it found no other equivalent selected-record collision.

`apps/web/scripts/skill-parameter-palette-browser-regression.mjs:1290` actually renames the local Basic record through the mounted editor to Gash and Flame Burst, runs the real local sample producer and retains both the selected h2 and Chronicle h4. Saved desktop/mobile evidence shows broad count two, selected h2 count one and Chronicle visible for all three tested names. This proves the semantic collision and its fix; it does not claim that a renamed Basic executes Gash/Flame mechanics. The unchanged native test still selects the actual Gash/Flame builtin IDs and retains saved publication, exact mechanics/pinning and history/restore assertions.

### N11 — genuine200 control hidden behind dock: ADDRESSED

`apps/web/src/components/master/master-panel-shell.module.css:99` adds only mobile-width Master interactive-element `scroll-margin-block-end`, using the existing measured dock-height variable plus 0.25rem. The `<=760px` media condition matches the existing mobile dock condition. Focus/scroll can reserve the fixed dock without resizing or removing header, rail, dock or content. The existing `MobileShellInsets` measures that dock height; its fallback remains bounded to the existing dock reserve. Ordinary desktop CSS and runtime navigation are unchanged.

`master-zoom-workflows.ts:20` retains the actual visible/scrollIntoViewIfNeeded/full-viewport, center hit and ancestor-clipping checks. The diff adds safe hit-element/dock attribution and attaches the measured evidence on failure before rethrowing; the thresholds remain unchanged. The activate sequence still uses actual focus, Shift+Tab, Tab, visible-focus assertion and Enter. Genuine extension setZoom/getZoom2, half CSS viewport/CSSzoom1, every eight-route workflow/state interaction and the 180000ms budget are untouched.

Native diagnosis binds both traces to artifact12610461605 and its recorded hash. Both prove readback2, inner1366×681 to683×340, DPR1 to2, visualScale1/CSSzoom1, followed by failed Search center-hit. I inspected the safe native screenshot: Search is visibly behind the six-destination dock. Those native traces did not contain the target hit rectangle, and the report correctly labels numeric hit rectangles as local measurements.

The new local opt-in probe extracts the actual native `control`/`activate` bodies (`skill-parameter-palette-browser-regression.mjs:185`) and mounts actual MasterPanelShell and AuthenticatedShellPresentation. With only the new CSS removed, retained RED records Search top299.734375/bottom339.734375, hit SPAN inside dock, clippedBy[], and the same unobscured=false assertion. With CSS restored, GREEN records top243.734375/bottom283.734375, hit BUTTON and no clipping. I inspected its screenshot and all final JSON rows: 24 controls over eight footprints are unobscured with CSSzoom1, and every mobile target fully clears the real dock. Whole-control clearance at `:1262` is additional to the unchanged native checks, not a replacement.

Coverage limits are honest: the local fixture provides controlled Owner access/local Basic service, no authenticated character and no real browser zoom; only683×340 matches the measured native zoom footprint. The other seven sizes broaden local reachability coverage. This is compelling source-level covering proof, but the next native all-eight-route acceptance remains required.

## Evidence, previous findings and focused context

Read retained logs show 340/340 DB tests in30 files, setup acquisition2110.06ms and shared lifecycle SQL580.12ms under the original per-test budget; eight focused downstream SQL cases; six N10 collision states;24 N11 controls;17 affected Master component tests; Web typecheck and zero-warning lint. The12 affected native cases were collected across three projects, not executed. The final integrity receipt records old artifacts/migrations/deployment lock unchanged,174 late evidence hashes and preserved ledger prefixes; Root owns independent complete hash/readback verification.

The two automatically rejected optional shell probes are transparently archived in `task13-fix4-probe-rejections.json`: outbound PostHog request, unknown payload/no disclosure authorization, and a rejected subsequent attempt. They have no completed acceptance receipt and were not retried by this reviewer. The retained alternative executes downstream SQL in-process; the rejected probe source is archival `.txt`, not executable tests or CI. Telemetry origin remains unconfirmed. No acceptance credit is given to rejected work.

Prior I1/F1/I2 fixes are preserved: mutation-response/builtin-original authority and the unique Players reader are untouched, the all-five original UI chain remains, and genuine200 workflow assertions are retained. N1–N7 repairs are not reopened. Inherited M1/M2 remain explicitly deferred, not silently closed.

Focused out-of-hunk checks addressed concrete joins only: (1) the v2 getter and its later authority patch to understand capture contents and stale checks; (2) existing dock CSS and MobileShellInsets for media/height compatibility; (3) complete native control/activate function because the diff cuts across its assertion boundary; (4) the remaining P38 mixed/illegal blocks and DB savepoint helper to verify parser/negative coverage; (5) same-file authoring headings for the specifically requested collision audit. No broad source review or passing-suite rerun was performed.

## Quality findings

Strengths: exact current captures and error assertions repair the authority fixture without weakening production; immutable version expectations follow measured output; source-extracted native controls avoid a divergent copied reachability test; the real dock obstruction has matching RED evidence and stricter whole-control GREEN coverage; reports keep local, collected and physical/native results distinct.

**Critical: none. Important: none.**

**New Minor M3 — experimental API warning in local proof.** `apps/web/scripts/skill-parameter-palette-browser-regression.mjs:197` introduces `stripTypeScriptTypes`, and `task13-fix4-n11-native-controls-final.log.gz` decoded line1 reports its ExperimentalWarning. The probe passes on pinned Node24 and this opt-in adapter is not production behavior, so this is nonblocking. For future maintenance, prefer the repository's existing stable TypeScript transpilation facility or explicitly classify this new warning in the proof report; do not blanket-suppress warnings or rerun the passing probe merely to polish the log. This is separate from inherited M2's color/sandbox diagnostics and does not require another product repair wave.

## Pending native gate

Candidate2 completed17 successful and3 failed workflows. Repeated authority actually ran16 cases:12 passed and4 failed (Gash and200, each twice). Natural World cadence and the all-five original saved/publication/restore/new-publication chains passed both repeats; central quality and physical Staff/Players/Event/catalogue/media/Tag/original lock-order/rollback gates also passed on that candidate. Full Chromium's660-case discovery set and Edge did not execute after the authority-phase failure.

Root must run all required fresh exact-head native gates after this review, including prepared PvP and downstream same-workflow scripts, selected Essence/P38, actual Gash/Flame publication flow, genuine200 all-route controls, repeated authority, full unfiltered Chromium and Edge. This source approval supplies no new-head native-green, hosted reconciliation, whole-branch acceptance or live-release claim.
