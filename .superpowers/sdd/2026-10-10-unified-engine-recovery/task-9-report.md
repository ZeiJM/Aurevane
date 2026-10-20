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
