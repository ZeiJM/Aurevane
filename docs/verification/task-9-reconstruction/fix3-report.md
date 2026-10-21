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
