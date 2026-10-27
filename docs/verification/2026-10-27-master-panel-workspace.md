# Master Panel workspace batch — implementation ledger

Status: **local implementation / integrated verification pending. Not live.**

Branch: `agent/master-panel-rework-20261027`, base main `d20bb6c079cc6d8210426d0bbcb482aae01eed71` (#983). No hosted migration, preview or production deployment has been made by this batch.

Authority: [approved specification](../superpowers/specs/2026-10-27-master-panel-workspace-design.md) and [implementation plan](../superpowers/plans/2026-10-27-master-panel-workspace.md). Detailed Owner screenshots/instructions in the conversation are binding. Root integrates six nonoverlapping workers; no duplicate implementation worker was launched.

## Requirement reconciliation

| Area | Source implemented | Verification / remaining gate |
| --- | --- | --- |
| Shared visual overhaul | Warm layered surfaces, ink/teal/brass, readable compact controls, responsive navigation | Native Rules/Events/Music/Content/Players fixtures pass; final integrated/browser authority gates pending |
| Music | Compact editor, actual file previews/playback, source rejection before saving unsupported YouTube video pages, editable legacy unsupported values | Focused tests and native desktop/mobile/CSS-zoom pass; no YouTube background audio support claimed |
| Staff pages | Owner-controlled named-page defaults, live server/SQL authority, one Events menu with subtabs | Focused authority/ACL and native Staff checks pass; final suite pending |
| Moderation | Search, timed/permanent bans, reasons, edit/lift, history, audit; canonical Auth ban authority checked before session actor | Focused SQL and old-token actor tests pass; native Staff/Moderation desktop/mobile fixtures pass |
| Player correction | Stable right pane, actual pinned base/cap/budget bounds and precise validation | Core38/web38; Players+Discipline SQL115; native predecessor/fix geometry pass |
| Allocation | Cap-capacity readiness/excess retention, refresh/remount after level/class changes, idempotent replay cannot rewrite newer personal points | Synthetic future cap-saturation and actual stale replay regression pass; current60/40 policy cannot saturate at Level100 pool135 |
| Content layout | Fixed category/list sidebar, automatic bounded pages into continuous list, search/sort/commit, no State/manual pagination; compact Details header | Native127-record matrix pass |
| Content recovery | Account-scoped session recovery of view/scroll/definitions, explicit stale revision review, no automatic commit; creation uses stable request identity | Native refresh/in-flight/rejected-save/child-draft matrix pass; focused pure invariants pass |
| Details / media | Text merged; real builtin class image preview, six desktop Core fields, remove misplaced help/Find helpers/internal rating controls | Native image decode/six-column geometry pass |
| Skills | Named list -> full native modal; image/sound previews, actual engine fields/text; mastery saves without publishing unrelated parent edits | Native image/WAV/commit/reopen pass; latest recovery/modal/identity-focused checks pass |
| Relationships | None(Essence)/named partner list -> modal, one-source override switch; off retains per-pair data | Exact parser/current/build/battle capture/SQL authority tests; source and capture propagation verified; final full gate running |
| Player grants | Verified account search/multi-grant/revoke; unlocks Primary/Secondary without fictional Mastery | Real SQL recipients/rename/idempotency/revocation and authority tests pass; grant-only testing entitlement and creation guard verified |
| History | Authoring History/rollback removed; legacy HTTP rollback paths rejected and no history payload offered |26 endpoint/retained-capture checks pass; immutable runtime definitions deliberately retained |
| Usage & Balance | Current roster/equips/pairs; qualified new production battle receipts and weekly PvP/AI W/L/D rates/actual skill use | Focused service/receipt checks pass; eight real reporting SQL cases and full-chain read smoke pass; combined gate running |

## Important boundaries and decisions

- YouTube watch pages are HTML, not audio files. YouTube requires a visible video player and prohibits hidden/background playback/audio separation. This implementation gives accurate rejection and preserves uploaded/direct audio; it does not extract audio or claim YouTube background support. References: [Developer policies](https://developers.google.com/youtube/terms/developer-policies), [implementation guidance](https://developers.google.com/youtube/terms/developer-policies-guide).
- Authoring history is retired. Existing exact-version runtime definitions remain because selected Skills, saved builds, battle captures, media and provenance refer to them. No physical history purge/backfill occurred; no claim that all older rows were removed. Unchanged-save protection remains active.
- Atlas band/power metadata has existing public grouping/presentation consumers. Redundant/internal editor controls are removed; retained metadata is preserved, not silently rewritten as gameplay changes.
- An override chooses the original authored power; original requirements/costs/timing still apply. Two overrides use deterministic stable-ID ordering, independent of Primary/Secondary order. [Domain evidence](2026-10-27-discipline-grants-relationships.md).
- Current policy cannot exhaust all attribute capacity by Level100; cap-saturation fixtures use an explicitly synthetic pinned policy. The real replay corruption reproduction and legal Level1/XP1 correction do use actual authority paths.
- Analytics never guesses historic test provenance. Historical weekly battle data is unavailable. Only qualified new production battles are admitted; unknown/preview/local/test/unfinished battles are excluded. AI recruits lack captured Discipline identities, so AI matchup-by-Discipline is unavailable. Passive/Essence/Resonance activation analytics are not mislabelled as Skill casts.
- Browser fixture transport/session data is local. It proves real production component rendering/interactions, not hosted Owner auth or actual network performance. CSS zoom/short viewport is not physical browser zoom.

## Final gate

- [x] Freeze/reconcile all domain changes and fresh main.
- [ ] Full format/lint/eight-package types/unit+DB/build gate on integrated source.
- [ ] Actual configured native auth/core battle/owner-authority workflows, not discovery counts.
- [x] Independent whole-branch review and meaningful findings resolved.
- [ ] Publish one PR; all actual exact-head required workflows finish successfully.
- [ ] Review canonical migration/history/integrity plan, then one scoped production release and real readiness/source/health smoke.
- [ ] Report residual limitations/Owner hands-on acceptance honestly.

## Independent review and repair pass

Read-only whole-tree review found no Critical authority vulnerability and three Important UI/persistence regressions plus the missing reporting CTE. All reported findings were repaired with focused verification; the combined gate is running:

- Restore controls stay disabled through both list and selected-record reads; persistence starts only after recovery settles. Native delayed-response regression was observed RED, then narrowed to search/sort and repaired.
- Creation preserves the original submitted definition with its request UUID in recovery. A lost-response retry replays the same fingerprint, adopts the assigned identity, commits the user's explicit latest submission and retains any still-newer edits. Native lost-response/edit/reload/retry proves exactly one created record.
- Relationship associations remain editable through each row's Change power modal, with exact source/pair filtering, removal and local parent settings; Edit still opens all power parameters. This replaces inaccessible association controls without restoring the old helper cloud.
- Analytics read now defines canonical current `selected_discipline`; eight real SQL cases and a complete-migration-chain smoke pass. The initial final SQL run exposed the missing CTE instead of approving a mocked dashboard.
- Reporting wording now describes manual and automatic qualifying Skill receipts accurately. Pending account deletions are excluded consistently with the UI statement; focused regression was observed RED.

Reviewer declined to certify hosted Owner auth, deployed-body migration compatibility, physical-device behavior, multiplayer and load performance; root retains those final-gate/Owner acceptance boundaries. A coordinated Master maintenance hold is required because old/new page-permission parsers and SQL are not independently compatible. No release has occurred.

## Integrated source verification, in progress

- Full workspace lint task passed; web route generation/typecheck passed after integration corrections. The final `VITEST_MAX_WORKERS=1 pnpm check` is running and includes fresh formatting, complete lint/types, all configured unit/database suites and the production build. No suite-wide completion or release is claimed yet.
- Reporting SQL regression: eight cases pass, including automatic Skill activation counts and exclusion of pending account deletion. Full-chain smoke caught and fixed the actual version-table column ambiguity.
- Recovery hydration, ambiguous creation retry and relationship association fixes pass actual component/browser fixtures. Unsaved recovery and dirty comparisons preserve runtime reference versions while ignoring only server-assigned top-level versions.
- Native authenticated Supabase/Playwright cases still require CI because Docker is unavailable here. Test discovery is not counted as execution.

## Final preflight findings and corrections

- The required legacy Staff SQL gate assumed every selected-actor RPC had a shorter predecessor. Its real full-chain execution failed on new Moderation. The gate now retains the legacy predecessor assertions and separately inventories all 14 new actor contracts (62 total), exact ACLs, private helpers/tables and forged/revoked actor denials; complete-chain proof passes.
- Four new intentional domain-conflict RAISEs incorrectly reused SQLSTATE40001, which can cause PostgREST14 to retry indefinitely. They now use PT409; both adapters accept PT409 and legacy40001. Actual catalogue regression observed four unsafe custom RAISEs before the change and zero afterward. Genuine PostgreSQL serialization handling is retained.
- Independent re-review caught an initially rejected creation retaining its invalid frozen payload. A native regression reproduced Core total32 -> rejection -> correct31 -> repeated rejection. Initial definitive INVALID_REQUEST now clears that unaccepted attempt; an uncertain prior response keeps its frozen fingerprint. The native corrected case passes with zero invalid records and exactly one accepted record using a fresh request.
- Read-only hosted preflight matched all30 expected full function-definition hashes against the baseline. No new canonical migration, production application or authored-data mutation has occurred.
- The first broad test run exceeded fixture budgets under concurrent package/auxiliary workloads. It is not a passing result; failed/timed-out checks require a controlled serial rerun without larger timeouts.

## Coordinated release preparation (not applied)

A regenerated atomic coordinator was tested locally against the complete predecessor chain with a real fixture account/character. It executes the four unchanged canonical sources in one transactional block, writes each original history source exactly once, verifies all30 predecessor full-definition hashes, checks53 changed/new function definitions and ACLs, and compares all selected durable data sets plus every unrelated function body/owner/ACL. The coordinator uses a consistent transaction snapshot and fails closed on any mismatch. All four original source digests match the local proof; the fixture character and saved game facts survive unchanged. Full catalogue inspection reports zero custom40001 RAISE assignments.

Release ordering: keep all Master page/API routes under maintenance through DDL/app cutover; ordinary old/new gameplay is additive-compatible before exceptional authoring. Retire the previous deployment's unique/git URLs and pinned requests; drain old executions before lifting the hold. The atomic coordinator prevents partial canonical application; if it fails, retain the hold, inspect all four history entries and deployed definitions before any forward repair/retry. Do not blindly reapply or roll back to a reader that cannot understand newly published overrides/captures. No exceptional catalogue publication, grant, ban, stat edit or other authored/player mutation is part of release verification.

Independent narrow re-review approved all corrected findings, including definitive rejection versus uncertain creation retry; no residual Critical/Important source finding. Hosted readiness/integrity and Owner acceptance remain separate.

The generated coordinator wrapper independently passed read-only source review with no Critical/Important findings (193616 bytes, SHA256 `4bff868d7b510ca5fad5600397e6fa04af1c09a43c8ad491d8ebf7903c759904`). Local proof preserves a seeded character and all protected row hashes, validates53 function/ACL contracts and records four exact canonical sources. It has not been submitted to production.

The legacy selected-character suite subsequently passed18tests with its original fixture budget; both PT409/legacy adapters passed11tests. Native invalid-first creation and uncertain-response adjacency both pass, with exactly one accepted created record in each applicable scenario. Production dependency audit reports no known vulnerabilities.

Reproducible release artifacts are versioned with this source: `scripts/release/prepare-master-workspace-coordinator.py` reads `master-panel-20261027/migration-contracts.json`; `master-panel-20261027/coordinator-local-proof.json` records the executed full-chain proof. Regeneration produced the exact independently reviewed SHA256 above. The generator produces SQL only and never connects to a database.

## First candidate CI and contract repair

PR [#984](https://github.com/ZeiJM/Aurevane/pull/984), first candidate `a1202580aa6918860e24f8e8e90ae500bab08918`, exact tree `93bd260f1b8036e221239d02dcc8edc2cbde5cd5`. All19 actual workflows finished:16success,3failure. These are workflow totals, not individual job/check rows. CI and Browser smoke each contain multiple jobs/steps.

Observed failures and repairs:
- Native palette workflows still expected old save/retention wording and History/restore controls. Tests now inspect retained AP input/state, explicitly reject all retired HTTP variants without mutation and commit current edits with truthful authorship; current and pinned readers remain verified.
- CI's private Music assertion expected service direct UPDATE. It now requires that privilege to be absent and separately checks exact server-only CAS RPC execution (`service/anon/auth = true/false/false`).
- An independent lifecycle test's fake platform Auth table lacked canonical ban columns; only those fixture columns were added. A historical SQLSTATE audit incorrectly compared its35functions after later legitimate migrations; it now captures at the audited migration's own boundary, retaining every65assignment/full-definition/owner/ACL assertion. Its2tests pass locally. Lifecycle's56cases still require a fresh complete run; prior combined attempts hit unchanged setup deadlines.

Updated native evidence: all5Basics across1366x768,1440x900,720x450 and390x844 (20 cases, keyboard/touch) pass against actual local handler/service/resolver/engine components. Desktop/mobile modular scenarios pass with12current/pinned reader contexts each. Results are retained beside the migration artifacts. Local execution uses an optional precompiled static fixture transport because cold development-module requests exceeded the existing navigation budget; feature assertions and browser deadlines are unchanged. This is not hosted authentication, genuine browser200%zoom or human gameplay evidence.

The actual authenticated200%browser-zoom workflow now includes Moderation and Activity Log, preserves invalid-edit retention/CAS and rejects retired requests without mutation. Its previous rollback journey is replaced by explicit current authoring. The Activity help text now describes delegated page access accurately. These native changes await exact-head CI.

The repair batch passes fresh web/database TypeScript checks and scoped source/format checks. The isolated lifecycle fixture still exceeded the unchanged60-second setup budget locally (26.55seconds compiling the executable fixture); its first CI attempt compiled in5.07seconds and reached the concrete missing-column error in12.31seconds. No timeout was increased. The corrected56-case lifecycle suite and new exact Music privilege tuples must execute in final exact-head CI. Local broad attempts are not recorded as passing.

## Second candidate integration pass

Candidate `5ff463ea7de52e8b031b5a82aeb11eb254562d6a` completed19workflows:17success,2failure. The genuine authenticated200%zoom/layout case passed twice across all ten panel destinations, including Moderation and Activity. Repeated authoring/authority passed14cases; two repeated Players cases stopped at a strict locator that matched both the correct application error and Next's route announcer. The locator now targets only the details pane; geometry and all subsequent recovery assertions remain.

CI's remaining failures also identified one unescaped apostrophe in the new Activity help (fixed) and Event gates expecting obsolete per-power exceptions. Current Event gates now revoke/restore the actual Owner-controlled Events page and positively check all six page powers. All existing actor, confirmation, concurrency, stale-CAS, audit and idempotency checks remain. Full-chain Event proof passes; targeted browser execution awaits final CI. New browser fixture guards refuse an unrelated enabled Owner at construction and transaction time, create/clean only their own temporary role, and preserve unrelated history/rollback state (2unit and3minimal real-SQL guard cases pass). No additional runtime migration was introduced.

Cutover is application-first under the Master hold. New ordinary gameplay accepts the old database and capability vocabulary. After the new application becomes canonical READY, retire old deployment hosts and pins and allow800seconds plus30seconds margin for old executions to drain. Only then apply the reviewed atomic four-source coordinator. This prevents old permission readers from observing the new page-policy data. Keep Master closed through database/API-cache/integrity verification; remove only the hold after success. No exceptional authoring/grants/bans are issued as release probes.

## Final Event and Players gate repairs

The Events policy intentionally grants every tool on an assigned page. Native shell/browser fixtures now use the real protected Owner defaults RPC to revoke and restore that page, rather than obsolete individual capability exceptions. A complete-chain proof exercises all six powers, regional/global publication, confirmation, stale-CAS, idempotency, revocation-before-replay/emergency-stop and exact reason-free audit counts. The browser fixture refuses any existing enabled Owner and rechecks transactionally; it creates and cleans only its own temporary role. Root reran its two refusal tests successfully; three minimal real-SQL guard cases cover races, unrelated history and rollback.

The final repeated-Players failure was selector ambiguity with Next's route announcer, not a missing application error. Its locator is scoped to the actual details pane; all alignment/recovery assertions remain. Fresh web/database types and package-context lint pass for the repairs. Optional fixture discovery is not browser execution. The next exact-head workflows remain the release gate.
