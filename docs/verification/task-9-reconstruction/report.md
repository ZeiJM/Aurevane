# Task 9 reconstructed Players and durable recovery

**Status: DONE_WITH_CONCERNS.** Local implementation and the equivalent full local quality gate are complete on frozen runtime `20486d28318eb6d6eced4ec7fca81b1b8947749e` (tree `57e375a7b106b5d93d62f3a7fa8daee45f586907`). Native concurrency, actual browser interaction and independent combined review remain open. This is newly reconstructed October 20 source, not restoration or certification of unavailable October 19 commits.

## Source and authority boundary

Implementation started at `2e2958423670edaac97871a97fba4989470e0af7`, retaining accepted Task8 Staff source and its original 33 actor/predecessor checks. PR950 implementation `7d39fc4177f610584c8595e535219c7735de38dc` and docs-only main `b7ba1e7b3e8b850c53f0d15842c96aecc50ae160` were merged cleanly. Root coordination `9b84e41364eab29ee0c4ab949c397ac3ff0fac95` is the combined review baseline and is merged through `0901206e0df4922cdfc594599f8b1a3eeec6201b`. Fresh-main fetch at 19:02 UTC still returned b7ba1e7b; ancestry, deployment lock and immutable predecessor migration checks pass in `final-source-integrity.log`. No PR950 runtime overlap was discarded or redesigned.

Immutable source checkpoints are `718e3e254a5e888a0be87b9a7f83a653c7a504e9` (initial reconstruction), `b161252e5ee39f8847cc851b6d19c5b0bb453066` (backend), and `f6e3cc5391b7a6f5b3383beaea6df584d63d6d7d` (UI/client/native harnesses). Root separately backed up their exact trees. Final checkpoint identity is supplied with this report's delivery. `changed-files.txt` enumerates the Task9 non-log diff from the combined review baseline.

The approved brief, reconstruction contract and Owner §§17–18 governed the implementation. This used the TDD, systematic-debugging and Supabase workflows, with one implementer and no extra helper/reviewer seats. No hosted writes, migrations, publication, deployment, remote-main mutation or external communication occurred in this seat. Deployment lock `apps/web/vercel.json` remains blob `b8a4e0e3c57b95a8da49c05d1fe5f60ba2181b5f`.

## Implemented behavior

Four new service-only RPCs expose bounded neutral search, existing-fact inspection, validated correction and confirmed whole-encounter recovery. They use actual Owner `staff.manage`/`assert_game_owner_v1` authority and trusted server-selected actor context. Original Staff inventory is retained; the four Players operations have a separate explicit inventory. Search returns at most 20 name matches, with verified-email/slot disambiguation. Inspection never initializes World, ticks presence, materializes training or invokes roster cleanup.

The Owner workspace shows existing source allocation/XP, calculated max HP/MP, actual build/earned/saved facts, World/training summaries and live battle state/recent actions. AP comes from validated `temporaryResources['pv1f.action-economy'].current`. Missing persistent resources, inventory and equipment are labeled truthfully. No identity, ownership, authentication, roles or invented economy controls are exposed. Four correction forms provide readable before/after review, explicit confirmation, stable retry keys and current fingerprint/CAS. Live/pending battle or deletion blocks corrections.

Source corrections use the actual cycle curve (levels 1–100) and current Primary allocation validator, including base/focus/cap/personal-pool rules. Primary/Secondary, exact earned Skill selections and support actions reuse current real domain commands. Missing Task10 authored Core/shared-earned eligibility is not invented or treated as an accepted producer. Every support correction advances the same numeric buildVersion and support generation. A private SHA256 freezes the exact level/XP/cycle/six source attributes used for preparation. Corrected-character admission requires both that proof and the current numeric buildVersion under actual account/character/build locks. Missing/malformed/fractional/string/stale captures reject atomically without orphan heads. Actual PvE, ordinary PvP, configured PvP and World preparation reject mixed CharacterRecord/build captures before create; public recursive projections strip the proof.

Recovery requires the exact complete named human participant set, expected head version and explicit confirmation. Shared engine state makes whole-encounter recovery necessary. The transaction writes the hash marker, session receipt, abandoned head, immutable snapshot/event and audit before actual queue/clock/staging/spectator cleanup. NoContest/NoRewards has dedicated presentation and log attribution. Summons, deferred effects, Ground, statuses, primes and maintenance clear; pinned definitions, policy captures, surviving HP/MP/AP and historical usage remain. No refunds, World progress rewrite, training changes or unrelated receipt/XP deletion occur.

All retained commit v1/v2-inner/v2/v3 paths, direct head mutation, direct old replay lookup, exact create retry and real trial claim respect terminal truth. Real normal-completion-first trial claims and repeats survive. Cleanup failure rolls back terminal state and marker. Recovery repeats are idempotent. Actual World read/block no longer finds an active battle after recovery, while `world_encounters` origin/history and character World state remain unchanged.

PvE refetch uses the existing version/inflight/commit/abort guards at 2 seconds; existing faster PvP cadence remains. Abandoned heads return through canonical World/hall metadata. Spectator 400/403 revocation ejects; 409/503/network errors stay retryable. Existing shared battle presentation and ordinary abandonment behavior remain.

## New findings and self-review

- Actual retained create/replay paths returned old pre-recovery authority; fresh behavior REDs drove terminal resynchronization.
- Interleaved source/build reads and corrected PvP guest preparation needed both private source and buildVersion proof. Actual producer and migration-chain tests cover rejection, rollback and fresh success.
- Existing atlas admission triggers could acquire blocking locks before the new guard. Head/participant guards now execute first and use bounded retry; native two-session execution is still required.
- Deleting the initiating Owner originally removed the session receipt. Actor linkage now belongs to privacy-deletable audit; the identity-free session receipt survives actor deletion.
- Deleting an unselected PvP participant originally left its UUID in recovery audit facts. The audit now references its battle session with deletion cascade. Real character and account finalizers on an independent peer account remove audit/session payloads, retain the hash marker, and leave no peer IDs in the remaining player's neutral read.
- Deleting the initiating selected character originally left its audit actor UUID. A real-finalizer RED demonstrated it; actor-character audit linkage now cascades on deletion without erasing the independent recovery receipt.

Audit is immutable to updates, with actual privacy deletion cascades. Hash-only anti-reopen markers retain no raw capture, character UUID, account linkage or audit payload. Existing migrations are immutable; the new additive migration was created via pinned Supabase CLI help then `migration new`.

## Verification and limitations

Every verification attempt has exact cwd/command/start/end/exit and raw output under this directory and an appended Task9 entry in `verification.jsonl`. Early fixture/setup failures are retained and distinguished from behavioral REDs. The actual migration-chain fixture retains real authorization, lifecycle, producer, reward and deletion function bodies. Platform auth/cron/storage/realtime shims and storage-only LZ4→PGLZ substitution permit PGlite execution; they do not certify native PostgreSQL concurrency or LZ4 support. Native CI retains the unmodified full migration chain.

The final affected database suite passes **33 tests**, including counterpart character/account and actor selected-character deletion (`actor-counterpart-deletion-green.log`). Prior covering suites include actual producers 65, backend services/handlers/actor/recovery 29, Controlled cleanup 4, source/projection 9, populated Owner SSR 2, client return/retry 24 and log/presentation 51. These overlap the full suite and must not be added as independent total coverage. Corresponding raw logs preserve the commands and exact test file boundaries.

The first canonical `pnpm check` stopped during lint when automatic approval review rejected unidentified outbound Vercel telemetry. `frozen-full-check.log` retains the interrupted output and does not claim completion. The equivalent ordered phases run with `TURBO_TELEMETRY_DISABLED=1`, `NEXT_TELEMETRY_DISABLED=1`, `DO_NOT_TRACK=1` and explicit Turbo `--env-mode=loose` so child processes inherit the opt-outs. This does not suppress test/build warnings. The complete ordered command exited **0** at 19:07:19 UTC (`telemetry-disabled-full-gate.log`, 16,521 bytes, retained as raw text). Format, lint, eight-package typecheck, all tests and worker/Web production builds passed. Final actor privacy SQL/test changes landed during lint before typecheck/test; `final-privacy-test-style.log` separately verifies that final test's format/lint. Runtime source then froze as 20486d28; the final evidence commit changes documentation/logs only. No broad test retry was needed on this reconstruction.

| Suite | Files | Tests passed |
|---|---:|---:|
| Game-core | 193 | 5,360 |
| Database | 25 | 200 |
| Web | 400 | 6,248 |
| Audio | 3 | 17 |
| Validation | 9 | 106 |
| Realtime | 1 | 3 |
| Worker | 1 | 2 |
| Total Vitest | 632 | 11,936 |
| Node checks | — | 7 |

The existing Vite CommonJS/native-config warning is retained. Build generated 66 static pages and includes `/master/players` and its API. This is equivalent ordered phase coverage, **not** a claim that the interrupted literal `pnpm check` exited 0. Historical worker-fork problems were not observed on this source.

Native two-session harness `.github/scripts/verify-master-players-recovery.py` covers completion/recovery orders, real concurrent trial claims, account/guest admission retry, edit-first stale preparation rollback, fresh admission and live-edit rejection. Native browser harness `apps/web/e2e/master-players-recovery.pw.ts` covers real Owner correction→fresh PvE, both PvP participants plus spectator, transient503 retry, API denials, unchanged XP/no trial benefits, complete confirmation, desktop/laptop/mobile/narrow/CSS2x and keyboard focus/confirmation. Screenshots copy immediately to unique repeat-index paths before later runs can clean test-results; CI uploads screenshots and compact failure contexts.

Docker/psql are absent locally. The native race attempt fails on missing Docker. Browser discovery lists one desktop test; this is discovery only. Chromium1234 is absent and pinned installation failed with invalid/truncated ZIP downloads. The actual post-build Playwright execution at 19:07 UTC failed at browser launch on the missing executable (`native-browser-execution.log`, copied `native-browser-error-context.md`); the test body never ran. Its NO_COLOR/FORCE_COLOR warning is retained. No actual native browser screenshots, interaction, physical zoom/device, hosted observation, concurrency success or human acceptance is claimed. CSS2x coverage in the harness is distinct from physical browser zoom. Root owns fresh native CI and the single combined review; imported historical Staff native archives are preserved and do not certify new Players source.


## Fix round 1/5 — Important I1/I2 and native integration N1

FIX_BASE is `96c4f20d6805abfdd7a6c0c3afe5b1816d21b5b5`. This appendix supersedes the original implementation assessment for these bounded repairs; the original broad gate above remains tied to runtime20486. No unrelated broad suite was rerun. The sole combined review required fixes for normal Discipline corrections and the native Owner fixture. Deferred Minor eligibility wording and disclosed Vite/color warnings remain unchanged.

**I1:** Extracted the form's exact command construction into `player-discipline-correction.ts`, called by the actual form submit path. It compares current Primary/Secondary to submitted FormData, emits only changed fields, preserves explicit Secondary removal as null, and explicitly rejects a no-op. The form displays that error instead of opening review. The review now retains omitted Secondary rather than displaying None. The underlying SQL, current caps, eligibility, attunement and domain authority are unchanged.

Seven meaningful form/review tests first failed with the original both-field implementation: four command-presence cases, two no-ops and omitted-Secondary review. Four actual full-migration SQL cases then failed with PRIMARY_DISCIPLINE_ALREADY_ACTIVE / SECONDARY_DISCIPLINE_ALREADY_ACTIVE using that same form helper. After the repair, the two focused Web files pass9 tests, and the complete Players DB file passes37 (original33 plus Secondary-only add/remove and Primary-only with None/retained Secondary). The removal fixture models elapsed attunement time by expiring only the disposable character's previously-created deadline; no policy or authorization function is replaced.

The real native Players E2E now performs all four Discipline patterns, checks the actual outgoing protected command fields, successful authoritative results, buildVersion advancement and unchanged XP, captures four named review screenshots, and asserts no-op feedback plus retained Secondary display. Between independent removal/second-Primary cases it expires only that disposable character's attunement timestamp to model elapsed time; production policy and command validation remain intact. Discovery finds the one expanded test; no local native interaction pass is claimed.

**I2:** The Docker-local native harness discovers the existing sole enabled Owner, validates it joins auth.users, and reuses it without deleting its account or prior Staff evidence. Standalone use bootstraps one Owner only if none exists. Setup now runs inside try/finally, all created accounts are explicitly tracked, and cleanup finalizes only those accounts. A borrowed-Owner survival assertion follows cleanup. The unique Owner invariant and actual RPC authorization remain unchanged. The original native setup failure is retained by the controller; local Python syntax passes, but actual ordered Staff→Players races still require Docker CI.

**N1:** Added only the demonstrated `./combat-content-authoring-server` alias inside the Basic-service acceptance harness's existing conditional alias map. It maps the actual relative import to the already-existing deliberate factory boundary. Real HTTP handler/service/in-memory repository behavior and production selected-character authority remain untouched. The original script failure reproduced under Node24.19, so no Node/dependency downgrade or broad React/Vite change was justified. The exact repaired Basic HTTP/service probe passes five v2 records and v1 Guard restore. Prior diagnosis/probes and sanitized native transcripts are retained by the controller's coordinating checkpoint7be73ac6; the raw native DB transcript containing a Docker-local key was neither copied nor committed here.

| Verification | Result | Raw output |
|---|---|---|
| Form/review original behavior | 7 expected assertion failures | fix1-discipline-form-red.log |
| Actual SQL with original form command | 4 expected ALREADY_ACTIVE failures | fix1-discipline-sql-red.log |
| Focused form/workspace + complete Players DB | 9 +37 passed | fix1-discipline-green.log |
| Exact Basic HTTP/service probe | exit0 | fix1-basic-service-green.log |
| Touched-file formatting | exit0 | fix1-format.log |
| Touched Web/DB lint and both package typechecks | exit0 | fix1-touched-types-lint.log |
| Native harness Python syntax | exit0; not native execution | fix1-native-syntax.log |
| Expanded native E2E discovery | 1 test; not interaction | fix1-native-discovery.log |
| Fresh-main/lock/immutable migration boundary | mainb7 ancestor; lock exact; no migration diff | fix1-main-lock-integrity.log |

Fresh main at19:21 UTC is still `b7ba1e7b3e8b850c53f0d15842c96aecc50ae160`. Deployment lock is still `b8a4e0e3c57b95a8da49c05d1fe5f60ba2181b5f`. The repair checkpoint contains only the form/helper/review tests, actual DB regression cases, native fixture/E2E, exact acceptance alias and evidence. Root will obtain the same reviewer's FIX_BASE..HEAD re-review and exact-source native runs. No hosted mutation, deployment, physical-device/zoom acceptance or native concurrency/browser success is implied. Status remains DONE_WITH_CONCERNS pending those gates.


## Fix round 2/5 — independent native guest creation fixture

FIX_BASE is `175e106bfb1e4777e4233afef1b1bb327c76a407`. Native database run39483455387/job118837698385 passed migrations, Staff and Owner fixture reuse, then stopped at guest construction before the guest admission race. The guest INSERT copied the host after the source correction deliberately reduced Might12→11 and after successful trial XP. That existing character legitimately has unspent personal points, but new-character provisioning invokes the real allocation validator with require_full=true. Copying those mutable facts into a new creation therefore correctly raises CHARACTER_ATTRIBUTE_RESET_MUST_SPEND_FULL_POOL. This is an invalid fixture, not a product authority defect.

The minimal repair replaces only that guest SELECT-from-host with independent level1/XP0/cycle1 Vanguard VALUES using the same valid full starting allocation as the initial host: attributes12/4/7/4/3/6, total36 (base31 plus personal5). No trigger, policy, gameplay function, migration or application code changes. A comment explains why the corrected/rewarded host is not a creation template.

The regression extracts and executes the actual Python harness multiline SQL statements against the existing real full migration-chain fixture. It checks both character constructions under this risk: the initial host and guest after an actual source correction plus real50XP grant. With original source, initial host passed and guest failed the exact native error (fix2-native-fixture-red.log). With repaired source, both pass and independently establish level1/XP0/full personal5. The target's total35 before guest creation is asserted, so the test cannot silently lose the triggering unspent-point state. The prior37 Players cases were not rerun; focused output is2passed/37skipped, not a39-test pass.

Covering evidence: fix2-native-fixture-green.log (2selected real-chain cases), fix2-format.log, fix2-focused-integrity.log (DB typecheck, touched ESLint and native Python AST syntax), fix2-main-lock-integrity.log (fresh main ancestry, exact deployment lock and bounded source paths). All exit0. The RED remains verbatim. No unrelated passing suite was repeated. Main remains b7ba1e7b3e8b850c53f0d15842c96aecc50ae160; deployment lock remains b8a4e0e3c57b95a8da49c05d1fe5f60ba2181b5f. Native transcripts remain controller-owned sanitized evidence; raw transcripts were not copied here.

PGlite proves the actual fixture statements and allocation trigger boundary, not two-session concurrency. The full ordered native Staff→Players sequence and guest admission race still require exact-source CI completion. Root owns scoped175e106b..repair re-review and native rerun. Status remains DONE_WITH_CONCERNS for that unexecuted native boundary; deferred Minors and production authority are unchanged.


## Fix round 3/5 — native browser identity and strict Owner isolation; bounded N4 diagnosis

FIX_BASE: `d2fef237ce6a81833314c16bb15e5f0e64503483`. Scope is browser-fixture repair N3 plus read-only/focused verification of unchanged timing failure N4. No production source, migration, gameplay policy, timeout or workflow configuration changes.

### N3 cause and repair

Native PR952 run39483455793/job118838889171 and staged PR953 job118843148330 each passed six earlier Master/Staff cases, then both Players repetitions failed setup inserting an empty UUID. The Players fixture generated mixed-case addresses (`players-Owner`, `players-Player`, etc.); Supabase stores normalized lowercase email. The existing provisioning helper successfully created/signed in each account but discarded the returned auth identity. Case-sensitive SQL against the original input email therefore found no Owner (and would also miss the Player). The passing Staff fixture uses lowercase addresses.

`pv1f-test-helpers.ts` now returns the immutable `data.user.id` from the actual successful admin createUser response after the existing sign-in/character-creation flow. Existing callers can continue ignoring the return. Players captures these returned IDs, uses the Owner ID directly and looks up the character by the Player's user_id; no email lookup remains. Missing createUser identity is an explicit error. The character lookup is asserted to produce a UUID before use.

`players-local-fixture.ts` validates the candidate UUID and its actual auth.users row before role SQL, then explicitly refuses an already-enabled Owner. It inserts one fixture grant only if there is none. The acquired grant is recorded only after successful insertion; finally removes only that exact created user/role, and nested finally closes browser contexts even if cleanup fails. Existing grants/accounts are never disabled or deleted by the refusal path. The real single-Owner unique constraint, FK, protected Owner RPC authorization and selected-character policy remain unchanged.

Controller ruling for this repair: strict browser isolation, not borrowed-Owner magic-link sign-in. Actual browser execution uses one worker; preceding Master authoring and Staff finally blocks disable their own grants. An unrelated enabled Owner must remain intact and cause an explicit setup failure. The separate native DB harness retains its already-reviewed borrowed-Owner support. No new production authentication path or fixture password mutation was added.

### Meaningful regressions and boundaries

Initial focused reproduction used the original extracted case-sensitive email/role SQL and produced empty identity, duplicate protected Owner, and blank-UUID failures (`fix3-browser-fixture-red.log`). One exploratory test expected borrowing; the controller then explicitly selected strict browser isolation instead. This exploratory expectation is not an acceptance criterion or retained implementation.

The final strict-isolation regressions first failed with the unguarded role INSERT: duplicate Owner, blank UUID, and nonexistent-user FK errors instead of the intended explicit setup guards. The owned-grant happy path already passed. After repair the actual shared browser-fixture functions execute against the real migration-chain fixture and pass four selected cases: preserved unrelated Owner with successful real Owner read; own bootstrap/read/cleanup after Staff-style disabling with subsequent real authority denial; blank UUID refusal; nonexistent UUID refusal. Output is 4passed/39skipped, not a43-case whole-file pass. No authorization/lifecycle stub is introduced. Existing PGlite environmental shims and storage-only LZ4→PGLZ limitation remain; these tests are not native concurrency or browser interaction evidence.

The shared helper return and E2E wiring pass Web typecheck and actual Playwright discovery for both repetitions. Local Docker remains absent, so this checkpoint does not claim a successful native account provisioning/interaction run. Root owns the exact-source native rerun and review. The prior complete native database job118843150721 remains root-held success on the prior reviewed fixture source, not a newly executed local sequence.

### N4 unchanged timeout diagnosis

Root-owned native-fix2-quality-failure.log reports one failed Web test at modular-correction-publication.test.ts:138: the edgedancer–wildwarden corrected-earned-build natural-turn case exceeded30000ms. Its two primary orientations took27984ms and30916ms natively; the rest of Web passed6254 cases/400files. Prior a0 native tests passed on the identical apps subtree as d2 (`3dd25bba8c58eea387ecdf2979bf3bf96a49a8f7`).

The actual path publishes the correction roster through the real authoring service, admits earned current builds, captures authoritative sources, and executes deterministic AI choices/commands with seed12345 through three rounds or an actual terminal result. It has a finite120-command guard; the native error is the test timeout, not that guard or a combat assertion. No gameplay/source changes were justified by this log.

One narrow rerun selected only both edgedancer–wildwarden orientations: 2passed/322skipped, test time27.82s/run29.35s, original30000ms limit unchanged. This confirms the failure was not reproduced in that isolated run; timing sensitivity is supported, but runner-load causation is not established. The native failure is retained and does not become green from this local result. Vite's existing native-config/CommonJS warning remains visible without suppression. No timeout increase, workflow edit or repeated broad suite was performed. The later native generic cancellation has separate job-budget timing evidence held by root; its precise cause is not proven here.

### Verification and self-review

All commands record exact cwd, argv, UTC start/end/exit and raw output in the following files; SHA256 manifests accompany this appendix:

| Evidence | Actual result |
|---|---|
| fix3-browser-fixture-red.log | 3 expected original-fixture failures; exploratory borrowing superseded by ruling |
| fix3-browser-isolation-red.log | 3 expected explicit-guard failures, 1pass, 39skipped |
| fix3-browser-fixture-green.log | 4passed, 39skipped; real migration-chain fixture functions |
| fix3-touched-format.log | touched four files formatted; exit0 |
| fix3-web-lint.log / fix3-web-types.log | touched E2E lint and Web types exit0 |
| fix3-db-lint-types.log | touched DB lint and DB types exit0 |
| fix3-browser-discovery.log | two requested repetitions discovered; no browser executed |
| fix3-n4-selected-timing.log | 2passed/322skipped; Vite warning retained |
| fix3-final-main-lock.log | fresh main ancestor, unchanged lock, no production/migration/workflow diff |

Self-review: all Owner grant mutations are isolated to a successfully acquired local fixture identity; rejection never assigns the cleanup handle. The account helper is still local browser test code, and its return does not alter existing callers' flow. No Task9 product function, current Main mechanic, broad refactor or deferred Minor was changed. Fresh main at19:58UTC remains `b7ba1e7b3e8b850c53f0d15842c96aecc50ae160`, already an ancestor; lock remains `b8a4e0e3c57b95a8da49c05d1fe5f60ba2181b5f`. No hosted action, deployment or external publication. Status DONE_WITH_CONCERNS pending scoped re-review and native browser/quality outcomes; no full Task9 native acceptance claimed.


## Fix round 4/5 — bounded native selector hypothesis and failure-preserving cleanup

FIX_BASE is `3a791c060efda502f8f5cb03dc052a5aefaefb9c`, tree `61d2718f84c35e4f32c86ee4abe5c50985de7ff9`. Status remains **DONE_WITH_CONCERNS** pending the existing reviewer's scoped gate and a new exact-source native browser run. This round does not establish that N5 is fixed or close Task9.

### Actual failure and limits of diagnosis

Root's completed native browser run39488302754/job118854414411 on remote `aa971de38eae662caf95c2bb12309e1068298c87` maps to this FIX_BASE. Both Players repetitions exceeded the unchanged300000ms test limit; six other early Master/Staff/combat-keyboard cases passed. Each Players error also reports `browserContext.close: Target page, context or browser has been closed` in the nested finally, masking the first blocked call. The sanitized native log is retained by root as `native-fix3-browser-failure.log`.

The downloaded compact artifact12296227434 has SHA256 `49a2ce632b71333726115efd08d8fa11ad2458066efad53e4afefa0b362f3303`. It contains all five initial Players layouts for both repetitions and two error contexts. Both final snapshots show1XP, the successful Correction saved status, and the Core Stats & XP group still selected. Thus the first actual XP edit succeeded; subsequent Discipline/recovery/PvP success is not established.

The next source boundaries are the XP SQL assertion, protected API read, Discipline choice derivation and the first group selector. The original native first blocking action cannot be proved from these snapshots. The actual trace is unavailable: root reports the796459888-byte diagnostics artifact exceeds the connector's512MiB download cap, and the alternate artifact also exceeds that cap. No trace was inspected, no first API-read success is inferred, and cleanup is not presented as the stall's cause.

The bounded hypothesis is the exact wrapping-label selector. The actual Players form nests option text inside its labels; all three selects use exact `getByLabel`, which compares that text. The passing Staff native harness already uses exact combobox role/name for the same wrapping-select pattern and documents why. The final snapshot independently identifies a combobox named Correction group. This supports changing the selector but does not prove that it caused this native timeout. The controller authorized this minimal hypothesis test without new dependencies or browser fallbacks.

### Scoped change

Players uses exact combobox role/name for Correction group, Primary and Secondary. Each selection asserts one match and its resulting value. The first group also retains an explicit initial-source assertion. Named Playwright steps distinguish the XP SQL assertion, each protected read, and group selection. All four Discipline correction cases, command payload checks, buildVersion/XP checks, denials, actual PvE and two-participant/spectator recovery assertions remain. The300000ms limit is unchanged.

The local fixture cleanup now attempts the acquired Owner release and awaits every owned-context close. With an existing failure it reports cleanup errors and allows the exact original exception to propagate. Without a primary failure it throws an AggregateError containing every cleanup error; cleanup cannot turn a failed proof into success. No acquired grant means no role mutation. The strict existing Owner isolation, returned actual auth IDs, original33+4 authority inventory, backend, migrations and gameplay remain unchanged.

The existing `combat-release-reader-screens` artifact includes only the Players `trace.zip` glob in addition to its existing files. No new workflow, test slice, timeout, retry, serialization, dependency or product route was added. If the next native run fails, its first action should remain visible and the scoped traces should be retrievable without the entire diagnostic archive.

### Verification and handoff

The cleanup RED extracted the original nested-finally cleanup into the testable fixture boundary before changing it. Two tests failed for the observed exception masking and lost Owner-release error; two normal/never-acquired cleanup cases passed. After the fix, all four pass. These are fixture lifecycle tests with explicit failing close/SQL callbacks, not actual browser or PostgreSQL execution. The native failed E2E remains the selector RED; no local selector GREEN is claimed.

Exact cwd, argv, UTC start/end, exit and raw output are in `fix4-*.log`, with hashes in `fix4-evidence-manifest.json` and appended verification records. Touched lint, Web types, formatting and two-repetition Playwright discovery all exited0. Discovery is not browser execution. Local pinned Chromium, Docker and psql remain absent; no download retry or substitute browser was attempted. The existing Vite CommonJS/native-config warning is retained.

Root separately reports exact aa971de3 native quality and database success (11953Vitest/633files plus7Node, types/lint/two builds and physical Players races) and UI-layout success. Those results remain tied to their original head and are not newly executed evidence for this repair. No passing broad suite was repeated. Root owns source publication and the fresh native gate; this implementer performed no hosted action, push, merge or deployment and did not unpause Task10.

Self-review found only the four intended source/test/workflow paths plus scoped evidence. Fresh-main diagnosis/edit checks returned `b7ba1e7b3e8b850c53f0d15842c96aecc50ae160`, already an ancestor. Final freshness at20:40UTC returned the same main, and the recorded deployment lock remains `b8a4e0e3c57b95a8da49c05d1fe5f60ba2181b5f`. Deferred Minors remain unchanged. The next acceptance boundary is actual native progression beyond the named API/selector steps through every retained recovery assertion.


## Fix round 5/5 — scope the observed no-op alert; retain the open native quality gate

FIX_BASE is `88f85ab98efd26dcb1a155de94a0cc8e884b180a`, tree `86cc25c88ed780baa7220d84e13cb09491c435ea`. This is the final bounded repair round. **DONE_WITH_CONCERNS:** the exact alert failure is addressed in source, but fresh native browser acceptance and native quality N4 remain OPEN. Neither is waived by the local diagnostics.

### Observed browser failure and surgical change

Native remote `05aba4f4`, Browser39494343945/job118875348742, passed six other early cases and failed both Players repetitions at the no-op text assertion. The locator `getByRole('alert')` matched both the intended `<p role="alert">Choose a different Primary or Secondary.</p>` and Next's empty `__next-route-announcer__` div. The product's actual no-op message was correct. This is a concrete harness selector collision, not a backend failure.

Both compact native traces were inspected for action/error metadata only. The XP SQL assertions completed in126.21/156.51ms, protected API reads in96.27/50.68ms and Discipline group selections in69.59/47.58ms. Thus the prior300000ms stall was not present in this run; cleanup did not mask the new assertion. Trace summaries and hashes are retained without private request/response payloads or raw browser traces. Root retains the compact artifact12298477046, SHA256 `c4444b0019189ad66c9d277e71930253e8755e0e3cda39881f2e2b9aa928bcb0`.

The E2E now locates the form containing the exact Correction group control, requires exactly one alert within that form, and asserts the same complete no-op text. It does not select the first arbitrary alert, filter by the desired text, or remove the no-op guard. Inspection of every retained assertion found no other unscoped alert lookup in this E2E. Next's announcer has role alert, so no evidence justified changing the separate status assertions. All four Discipline corrections, outgoing command/buildVersion/XP checks, protected denials, PvE recovery and two-participant/spectator PvP recovery remain untouched. No timeout, retry, workflow, product, migration or authority change is included.

The completed native two-match failures are the actual RED. Local browser execution remains unavailable; discovery is not selector GREEN. Root owns the new exact-source native run and the existing reviewer's scoped gate.

### N4 recurrence and focused CPU evidence

Native quality39494344271/job118875350136 failed the unchanged Edgedancer/Wildwarden corrected-earned-build natural-turn test at30428ms against its30000ms limit; the opposite orientation passed at23122ms. Web reported6258 passed/1 failed, including all four cleanup tests. Types/lint/style passed; Node checks and builds were not reached. The earlier complete aa971de3 native quality pass on unchanged combat source remains historical evidence, not a pass for this failed run.

One narrow run selected only these two orientations with Node's CPU profiler. The actual publication/admission/AI/command path passed2 tests with322 skipped, tests28.70s/run30.36s, with the original timeout, seed12345, three-round/real-terminal rule and120-command guard intact. Temporary phase-timing probes were used during diagnosis and then restored byte-for-byte; their console counters were not present in the captured output, so no wall-clock phase conclusions are claimed from them. The conclusions below use the retained CPU profile's sampled call ancestry.

Of30329.37ms sampled runtime, `playLegalRosterDuel` accounted for27914.29ms inclusive and `chooseBuildAwareRecruitAiDecision` for26692.72ms. `createLegalRosterDuel` accounted for39.47ms. Nested authoritative work included22282.13ms in `validateCombatAbilityState` and17065.74ms in `parseAbilityDefinition`. Inclusive figures overlap and cannot be added; profiling can affect timing, and these are local samples rather than native runner measurements. The dominant cost is actual AI candidate simulation/validation, not fixture construction. Publication is already memoized. Raw CPU profile SHA256 is `a985296d271da660965d73398efde7f030eaac6c1a88e09dcb0631390b6a4802`; the compressed profile and derived summary are retained.

No narrow fixture-performance repair was justified. The controller accepted this conclusion: do not widen validation/caching scope, alter gameplay, increase timeout, or repeat a broad suite. Both instrumented files match FIX_BASE again, and the final source diff contains no combat changes. The native quality gate stays OPEN for the final frozen run; an isolated local pass does not establish native reliability or erase the failure.

### Verification, self-review and handoff

Exact argv/cwd/UTC start/end/exit/output records and hashes accompany the evidence. Touched E2E lint and Web types passed. The initial formatting check found the new chained locator needed wrapping and stopped before discovery; that failed log is retained. Formatting was corrected, the follow-up check passed, and Playwright discovered both full native repetitions. No local Chromium, native PostgreSQL or broad quality run is claimed. The existing Vite native-config/CommonJS warning remains visible.

Self-review confirms only one E2E assertion scope changed, plus bounded evidence/reports. Fresh-main preflight returned `b7ba1e7b3e8b850c53f0d15842c96aecc50ae160`, already an ancestor; the final21:09UTC fetch returned the same main and the deployment lock remains `b8a4e0e3c57b95a8da49c05d1fe5f60ba2181b5f`. No helpers, hosted action, source push, merge or deployment occurred. Deferred Minors, all33+4 authority checks, strict acquired-Owner cleanup and Task10 pause are preserved. Root owns remaining native acceptance and explicit adjudication of any residual failure after this final repair round.
