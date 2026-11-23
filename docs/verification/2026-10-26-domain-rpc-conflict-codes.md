# Domain RPC conflict SQLSTATE audit — October 26, 2026

Prepared locally; this broader migration has not been applied by this subtask.

The proven World/PostgREST 14 retry defect also applies to intentional domain conflicts elsewhere. A read-only hosted catalogue audit found 33 remaining functions with 63 explicit `errcode='40001'` assignments after the focused World repair. The pending local atomic content commit and role-default functions add two functions and two assignments. This is distinct from genuine PostgreSQL serialization failures.

`20261026072745_domain_rpc_conflict_codes.sql` lists the 35 exact signatures and expected replacement counts. It changes only those 65 explicit SQLSTATE assignments to `PT409`, refuses predecessor drift, and rejects any unreviewed remaining intentional assignment in the application schemas. Every exception message, CAS comparison, lock, authorization guard, state mutation, function owner and ACL is preserved. Native serialization failures are untouched. Existing World `commit_world_state_v1` already uses PT409 and is not changed by this migration.

Coverage includes protected Master content records/publication/catalogue locks, Staff and role defaults, Players corrections/recovery, Events, battle/current-content admission, character/build/idempotency operations and World encounter admission. Compatibility legacy functions with retained manual assignments are included because their service/internal callers remain live.

Five TypeScript adapters classify conflicts by SQLSTATE: battle sessions, Master Players, Staff, Events authoring and Events operations. They now accept both 40001 and PT409. Message-based adapters retain their existing mapping. Deploy the compatible application before the broader database migration; older running adapters would otherwise classify some PT409 conflicts as persistence failures. This is not a request to apply this migration out of canonical order or independently of its preceding pending functions.

## Verification

RED before repair:

- Actual physical catalogue CAS returned 40001, and the full function body still contained the old assignment.
- Actual PT409 Staff adapter input produced `PERSISTENCE_UNAVAILABLE` instead of HTTP409.

GREEN:

- `domain-rpc-conflict-codes.test.ts` and `world-stale-rpc-conflict-code.test.ts`: four physical tests, applying the complete real migration chain. Every affected full function body, owner and ACL is compared with its predecessor; only the intentional SQLSTATE assignments differ. Current catalogue and complete-record CAS return PT409 with unchanged messages and no record/version/draft/request changes. Invalid commands retain 22023. The focused World no-write/valid commit/idempotent replay proof still passes.
- Seven web suites, 70 tests, include all five code-based adapters for both error codes, actual HTTP409 translation, preserved current battle version and unchanged timeout classification.
- DB TypeScript and focused web ESLint pass. Final web TypeScript/format checks are recorded in the parent handoff.

The first wider physical run revealed expected old-SQLSTATE assumptions in native fixtures: Staff catches `serialization_failure`; content lifecycle catches the same; catalogue concurrency checks `40001:`; captured startup and World presence pgTAP expect 40001. Those assertions require PT409 while retaining their exact rejection messages and rollback/authority assertions. That run also lost one worker while multiple heavy database checks overlapped. The focused physical repair was rerun serially and passed; the earlier wider run is not claimed as green.

The previous urgent test's replay query now supplies its explicit PGlite result type, repairing the DB TypeScript failure reported by the parent quality gate.

Final targeted verification: the five native fixture paths now assert PT409 while retaining every exact message, authority and rollback expectation. A serial four-file physical run passes all 112 tests: complete-record lifecycle (including native Staff, finalized media/Tag and captured startup proofs), Discipline producers, domain conflict conversion and focused World repair. Seven web suites/70 tests pass. Full web and DB TypeScript, scoped lint, Prettier and diff whitespace checks pass. The native concurrency shell received SQLSTATE-only expectation updates; its separate hosted/native concurrency execution remains part of the parent integration gate.
