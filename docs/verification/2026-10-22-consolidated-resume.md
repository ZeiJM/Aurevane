# Consolidated continuation — October 22, 2026

Owner priority: map stability and Master Panel first; release live for testing is authorized. Do not drop preserved Content and broader backlog; their completion is not claimed. Original eight unpublished files remain preserved. Do not merge PR933/960 on ordinary CI success.

## Exact sources and current status

- Fresh main: a31029c04c0ef7be9fd08092c6a70f6f086b48b6, unchanged in final fetch.
- Production alias aurevane.vercel.app still READY at dpl_BQgHdRJQDYndXDRtexL5AZ8uLihh, source874a14ce5b7f9aabed8df11140a9017fbfa4f71e. No deployment or merge occurred in this resumed turn.
- PR968 https://github.com/ZeiJM/Aurevane/pull/968, headb0911c35a873bf7adda4eca1f056adf7a9bc1e42, tree75f4c62b9c5d678c0d8c60189008697cd18ee15e. Exact local7dbf3eacb has identical tree. Review preserved before this turn. CI39839946736 SUCCESS including production audit, quality/builds and native database Staff/Players races. SkillEngine39839946798, Controlled39839946671, DisciplineDB39839946613, modularReaders39839946603 and representativeBuildcraft39839946834 SUCCESS. Browser39839946961 still in progress at checkpoint. Do not merge/deploy before final gates.
- PR969 https://github.com/ZeiJM/Aurevane/pull/969, head45cb082e44c8bca0cd2a121ee1159e8a1af4ea34, tree170c798a673fad8faa66788c181f2e83d30b54ea, equals local6f8b5c17e121489925a68caedaa187b479bee568. Stacked on968. Ready for review, source approved without Critical/Important findings. CI39842298232 and browser39842298309 running. No live claim.
- PR970 https://github.com/ZeiJM/Aurevane/pull/970, draft, head270d391fc45d8c5aa7b26ce2f4660839bde4a42f, tree6902706f7bfaeefe8fcf655dcd62e1a26faadbb4, equals local8707d0a717e97d6f3ad3c21a04427f4c6a57c6df. Stacked on968. Source approved for diagnostics, no movement fix claim. Repeat39842544592/job120047128104 running; exact40cases with unchanged limits/no retries. Atlas39842544270, browser39842544361, CI39842544285 running/queued. Keep PR933 and960 unmerged.

## Hosted migration blocker

Supabase project luazfeupwfgnilohfsya. Staff source identity20261019003429_selected_character_staff_access is applied. Players20261020181057_master_players_recovery.sql is NOT applied. SHA256d003119d4a24a26b4f810a2d1d9ca35ef0fe3d80fe7f568abbed1e5ee8832599; original exact source is in968. Current native gate passes this immutable migration and recovery races.

Preflight: all four Players tables absent; no source/name migration history; exactly one Owner; snapshot/create/replay predecessor guards all true. Affected predecessor bodyMD5: snapshot e2cea607b36e47c7b5846611f015edfc, create43a15221eade02b98fc5ec15fd06df96, replaydc4f9a976274c719e9fd85e36d51389c. All service-only ACLs remain {postgres=X/postgres,service_role=X/postgres}; snapshot/replay STABLE.

The one resumed apply_migration attempt with exact34296-byte reviewed SQL returned 'McpServerError: Invalid or expired requestState' / invalid_request_state, consistent with earlier failures. Readback confirms revisions/audit/no_contests tables and migration history are still null. Do not blindly reapply or claim success; do not use execute_sql to bypass the DDL endpoint rule. A browser fallback would require user approval under the browser plugin-failure boundary before opening Supabase dashboard. Migration itself and deployment are already authorized; this is a transport fallback gate. No approval request has yet been answered in this resumed turn.

Existing source-history normalization procedure: apply exact original source once, inspect returned generated history row and preserve all metadata/statements; normalize only that exact newly created row to original20261020181057 with full version/name/statement fingerprint CAS. Never rewrite/reapply previous migrations. Complete RLS/private/service/browser-denial/ordinary-reader/body-preservation postflight, then exact-source staged deployment and smoke checks. No catalogue publication belongs to this release.

## Overview runtime evidence

Current eight-card page reproduced escaped copy/links and content scroll at ordinary laptop sizes. Four-column compact cards with side artwork and container-based2/1-column reflow fix the observed containment. Runtime probe mounts actual async Master page, media registry, CSS and simplified local access/frame mocks; no hosted user writes.

RED:1440x900 content overflow6px,1366x76849px,1280x720121px, all with escaped text;200% also escaped text. GREEN: no escaped text in8configurations; zero content/main vertical overflow at1920x1080,1440x900,1366x768,1280x720.1024x768 retains35px natural scrolling;mobile390/320 andCSS200% retain readable reflow/scrolling. The probe does not certify real signed-in composition/physical zoom. Real seven-viewport/200% helper now runs inside existing disposable Owner Staff journey and restores settings. Unit11pass, Webtsc exit0, scoped e2e ESLint exit0, formatting and discovery pass. Initial root ESLint ignored files and is retained as warning; corrected app-level --no-ignore run inspected them. No claim all other pages are fixed.

## World evidence

PR960 strict repeat36pass/4fail; prior contamination timeouts and arrival failures did not recur, but hard jumps remain. New opt-in phase diagnostics retain original clocks, authority, thresholds and observation schedule. Fresh307focused tests in8files pass, Webtsc exit0. Diagnostic overhead caveat B1: full bounded timing-history serialization after completedAt may itself contribute to later callback lateness. Native profiles must consider that before product changes. A diagnostic pass cannot certify broad loading/direction-change/traversal stability.

## Follow-up source review

# Follow-up source review — 2026-10-22

Read-only, one source-review pass per isolated candidate. No checkout, HEAD, source, hosted state, branch, merge or deployment was changed. Only this requested report was written. Read root AGENTS, engineering and concurrency guidance; inspected exact diffs, relevant real source and existing local receipts. No broad suites or new runtime probes were run. Both worktrees were clean at inspection. Local origin/main was `a31029c04c0ef7be9fd08092c6a70f6f086b48b6`; I did not fetch or certify current remote-main compatibility. Coordinator retains the fresh-main and native gates.

## Candidate A — Master overview sizing

- Worktree: `/workspace/scratch/e5db2ba73c1a/aurevane-master-release-20261022`
- Base: `7dbf3eacbefbc7e3a081f8e6f0c9ee27089877e7`
- Head: `6f8b5c17e121489925a68caedaa187b479bee568`
- Tree: `170c798a673fad8faa66788c181f2e83d30b54ea`
- Scope: shell CSS, new Playwright layout helper, one Staff native-test call.

**Critical:** none found. **Important:** none found. **Minor:** none requiring a source change.

The four-column desktop grid and narrow image column address the oversized artwork without suppressing card text. Text retains intrinsic minimum height, wraps, and stays in the second column; imagery occupies the explicit four text rows. Container breakpoints permit two columns and then one column with natural height. Content retains vertical overflow where desktop height is insufficient; mobile retains natural page flow. Image fallback roots carry the same art class and are correctly excluded from text placement by `data-media-status`. No access filtering, page authorization, link target, navigation, or keyboard focus style is removed. The new helper invokes the real `/master` after the disposable Game Owner grant, checks all eight cards, actual text ranges and visibility, horizontal overflow and desktop no-scroll requirements, and restores zoom/viewport before Staff checks continue.

Reviewed the supplied source-runtime probe and RED/GREEN JSON. GREEN reports eight cards, no escaped text, zero overview/main vertical overflow at 1280×720, 1366×768, 1440×900 and 1920×1080; 1024×768 needs 35px overview scrolling. Mobile/320px and CSS zoom 2 retain all text with reflow. RED exhibits the reported desktop text escape/scrolling, so this is relevant behavioral evidence. GREEN JSON SHA256: `6022a520bd0c4300c43ffba205171358d562ba4bed4b0488cb6dd9ddc1e9a39a`; RED: `ef283ed10c2771abd02753335a9912006305803774638915de232a8568a62c3d`.

Existing focused log reports 2 files/11 passing tests. Type and scoped-lint log files are empty, which alone does not independently establish their exit status; coordinator-supplied pass status remains reported evidence. My exact base/head `git diff --check` passed. The native helper includes 1280/1366/1920 normal, 1024, mobile/320 and 200% cases; normal 1440 is covered by the supplied probe rather than a separate native-helper entry.

**Declined to judge:** final signed-in composition, screenshot quality, physical/browser 200% zoom, all other Master page sizing, or completion/live acceptance. The supplied probe uses the actual async overview and CSS but mocks auth/access/frame wrappers and Next media/link components. Its `documentWidth` subtraction under CSS zoom can be negative and must not be treated as a proof of native zoom behavior. The native helper instead compares document scroll/client widths and must still run. This patch does not establish that unrelated Master workspaces now meet every sizing requirement.

**Ready for native gates:** yes, from source review. Run the actual signed-in Staff/overview acceptance on the reviewed release state and preserve the separate whole-release CI and fresh-main gates. No source/UI-complete or live-release claim is supported by this review.

## Candidate B — opt-in World render timing diagnostics

- Worktree: `/workspace/scratch/e5db2ba73c1a/aurevane`
- Base: `9760567127b26d21a423f557c681a36a681e0fc1`
- Head: `8707d0a717e97d6f3ad3c21a04427f4c6a57c6df`
- Tree: `6902706f7bfaeefe8fcf655dcd62e1a26faadbb4`
- Scope: renderer instrumentation, native capture integration, focused tests, diagnostic documentation.

**Critical:** none found. **Important:** none found.

**Minor B1 — account for the capture's own work when interpreting timing:** `apps/web/e2e/world-render-diagnostics.ts:38-50` serializes the retained timing history into a DOM attribute after each identity frame, growing to 1500 records. This added work occurs in a microtask after renderer `completedAt` and therefore is outside the reported in-draw phases. The existing moving sampler already serializes its own history, but the new richer buffer adds further main-thread work. This does not block a bounded diagnostic native run; do not infer that callback lateness with low draw costs proves unrelated application work without considering profiler serialization. Measure/compare that overhead before using instrumented timings alone to justify a product change. No assertion relaxation is warranted.

Normal rendering adds guarded dataset/branch checks but no new per-stage clock reads or history. The existing remote interpolation clock is captured in a local variable at the same operation boundary, then passed unchanged to `remoteMotion.update`. RAF/sample clocks, motion calculations, route authority and rendering order remain unchanged. Enabled updates aggregate numeric counters until the next actual draw. Draw phases partition work from existing draw start through identity completion; cache/index submetrics measure the actual operations rather than invented delays. Pause/no-draw boundaries do not publish pretend frames.

The native installer is placed before the existing both-moving sampler and checked walks. Its wrapper forwards the original `fillText` arguments, schedules at most one microtask, and reads after the renderer publishes complete identity cost. The later movement wrapper still records at its original pre-draw point. Timing and movement records join by unchanged `frameAt`. Long-task and timing data are read together in the existing awaited slot; no extra awaited capture is added between observers' progress polls. Final failure-boundary capture also retains timings, including a second observer whose standalone assertion may never be reached.

Privacy and retention are explicit: the producer publishes only numeric fields, the capture copies only 19 finite allowlisted numeric values, malformed/incomplete records are discarded, text/IDs/URLs/coordinates are not retained by this new buffer, and the buffer is capped at 1500 records. Existing sample/long-task caps and cleanup paths are preserved. Existing strict normal 0.75/hard 0.95 limits, backwards −0.1 bound, >8 positive changes, monotonic sample times, arrival/approval and WASD checks remain in source.

Tests exercise the real renderer and exported installer: dormant clock reads, cold/warm ground builds, injected actual index/text cost, unchanged RAF timestamp, pause/resume, disable cleanup, argument forwarding, post-frame capture, redaction, malformed data and retention. They are meaningful diagnostic guards, not a reproduction/fix for the movement defect. Existing frozen receipts report 8 files/307 tests passing, plus scoped tsc/ESLint/Prettier/diff checks passing. I verified raw hashes against receipts: focused `a7ab35834a67d8b0677edab65397a186cfc77aea019550bd5ea4de5f17d5c8d3`; static `c4110dc3d9a1237b3aa08969bdc4c9f74bce09e11e158e0bf7867f7e742fe7be`. Discovery lists the 40 cases but is not execution. My exact base/head `git diff --check` passed.

**Declined to judge:** the root cause of PR960's four remaining failed cases, movement repair, native repeat success, actual profiling overhead, broader map/loading/direction-change stability, physical-device/multiplayer/load acceptance, combined release compatibility or hosted status. No product-motion fix is present or established. The new tests and diagnostics do not supersede the strict acceptance failures.

**Ready for native gates:** yes, as an explicitly opt-in evidence-gathering candidate. Preserve existing strict gates and inspect full boundary artifacts as well as standalone samples. A green diagnostic run alone would not certify a complete World movement fix. No merge/deploy/publication recommendation beyond completing coordinator-owned gates is made.

