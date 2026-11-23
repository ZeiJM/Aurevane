# World stale-command retry storm — October 26, 2026

## Demonstrated cause

The production World conflict storm is a PostgREST 14 transaction retry loop. It is not evidence of tens of thousands of browser requests. `commit_world_state_v1` intentionally raises `WORLD_STALE_VERSION` using SQLSTATE `40001` when its supplied expected version is stale. Replaying that same call cannot repair the caller's version. PostgREST 14 treats the error as retryable and can execute it indefinitely.

Official primary sources:

- [Supabase Knowledge Base: SQLSTATE 40001 in an RPC causes infinite retries](https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions)
- [PostgREST issue 3673](https://github.com/PostgREST/postgrest/issues/3673)

The Supabase article explicitly identifies the PostgREST 14 bug, recommends `PT409` for intended HTTP conflicts, and states that an already looping backend must be stopped separately after the function repair. The issue records the upstream transaction retry behavior and its removal. The running deployment reports `PostgREST 14.5`.

## Read-only production evidence

- 06:40–06:50 UTC: 57,370 `40001` errors all originated from the same PostgREST/authenticator backend, one query shape, with 57,370 distinct transaction IDs.
- 06:43–06:50 UTC: that same backend generated 41,998 errors. Each complete minute was approximately 6,000 errors.
- 06:43–06:44 UTC: 6,000 PostgreSQL error entries, versus 15 edge log events and four PostgREST log events across the project.
- Confirmed backend PID `2210247`, start `2026-10-12 06:05:31.301934Z`. At database observation `2026-10-26T06:53:08Z`, this exact PID was actively executing `commit_world_state_v1`, with no wait event; query hash `bfc41d0315bb45155b444acb8e04d60d`. The logs and active-backend identity match.
- All three configured cron jobs were inspected at aggregate/function level; none directly invokes `commit_world_state_v1`.
- In the 06:40–06:50 edge window, selection reads had seven 500 responses averaging 12,409.9 ms, and complete-catalogue reads had five 500 responses averaging 14,259 ms. These confirm overlapping user-facing read failure; they do not prove this process caused every timeout.

No tokens, query parameters, player identities, locations or game content were printed. Only operational backend IDs, function names, hashes, counts and timings were retrieved.

## Client and server trace

`WorldController.drain` catches a conflict, obtains a fresh authoritative read and retries the command once. A second failure reaches the outer rejection path. It does not recursively replay the original command indefinitely. World workspace scheduling serializes commands, checks pending state and visibility, and clamps the timer to at least 100 ms (usual active sync 600 ms). The SQL API is the demonstrated repeating boundary.

The existing application maps the preserved `WORLD_STALE_VERSION` message to `STALE_VERSION`; its HTTP response remains 409 even when SQLSTATE changes to `PT409`. No timing, movement, authority, routing, client retry or gameplay threshold was changed.

## Focused repair

Generated migration `20261026065354_world_stale_rpc_conflict_code.sql` replaces exactly one complete literal raise statement in the current `commit_world_state_v1` body. It changes only intentional SQLSTATE `40001` to `PT409`, preserves the message, and refuses to run if the predecessor differs or the exact occurrence count is not one. It recreates the existing function from `pg_get_functiondef`, leaving all locks, ownership checks, CAS, idempotency, mutation logic and ACL unchanged.

Physical regression `packages/db/src/world-stale-rpc-conflict-code.test.ts` applies the complete real migration chain. RED demonstrated the original 40001 and exact expected-body mismatch. GREEN (two tests) proves the full body differs only at the SQLSTATE, identical ACL, unchanged row after stale rejection, preserved message, valid commit to version two, and successful idempotent replay. Independent reviewer approved the exact SQL. Scoped ESLint passes.

This subtask did not apply the migration or cancel/terminate any backend. Parent owns the narrowly scoped operational action, live verification and canonical migration receipt. Other intended 40001 business conflicts exist elsewhere and need a separate compatibility review; this urgent repair deliberately changes only the proven World loop guard.

## Parent operational update

Parent reports the focused World hotfix was applied at 07:25 UTC with canonical source verification. The previously confirmed looping PID disappeared without a termination command. The initial transition contains the former approximately 6,000 40001 errors per minute followed by one PT409. Parent owns the completed post-mitigation observation window and final incident status; this subtask does not claim that window was already clear.
