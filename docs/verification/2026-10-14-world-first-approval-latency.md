# Isola first movement approval latency

Status: implemented locally and under verification; not merged or live. The Owner's October14 report after #906 remains unresolved for hosted gameplay acceptance. Production remains `dpl_9ihjPb7X6Qb88wcczLYQKXkVGAR1`, source `36fbe14cdd44e2f4562e5cc4235e3cd484cbdb89`. This correction starts from fresh main `81fd91dd0964de9a1fbe181392d285a10a4fc339`.

## Reproduction and correction

The initial World request serializes active-session verification, selected-character roster lookup, canonical World read and movement commit. The roster lookup is redundant for this route: the mandatory World read already rejects foreign characters and pending deletion before world-state initialization or updates.

A real handler/repository/controller/motion regression delays each resource boundary by175ms. Original source acknowledges at700ms, exhausting the unchanged600ms preview and failing the moving assertion at600ms. The candidate removes the roster lookup, acknowledges at525ms, advances at600/650ms without an approval correction jump, and reaches the exact destination. These are injected timings, not production request measurements.

The unchanged authenticated actor still verifies JWT claims and fresh active-session ownership first. The selected cookie supplies only a canonical UUID address. Every GET/normal command/Attack path enters the existing World ownership and deletion checks before a World response or mutation. Production SQL definitions were inspected read-only and match this contract. No SQL, grant, RLS, migration, session cache or actor implementation changes.

An earlier parallel roster-read prototype was rejected before publication: `get_character_slots_v2` finalizes overdue deletions and can abandon battles, so it must not run before session approval. The final candidate makes no pre-session roster call and leaves `actor.ts` exactly unchanged.

Numeric `Server-Timing` records identity, command and total durations on validated commands. Slow approvals/conflicts emit an intent/status/duration-only warning at most once per30seconds per instance; no tokens, user/character identities, locations, targets or bodies are logged. The existing native held-walk case attaches request/response timings without changing any assertion, skip or workflow limit.

## Verification

The cookie-aware original handler fails the pause regression before the change. The final candidate passes the regression and negative cases for incomplete claims, pending/revoked session, missing/noncanonical selection and canonical ownership/deletion denial. Full `corepack pnpm check` exits0: formatting, lint, all package types,5,681 Vitest tests, seven Node checks and production builds. Log: `/tmp/isola-start-pause-final-quality.log`. Diff whitespace checks pass.

Independent review finds no critical or important issue in the final narrow candidate;88 tests across five files and whitespace checks pass independently. The rejected pre-session prototype is absent. Malformed commands and cookie/body mismatches may now reject400/409 before ownership denial403, exposing no private state. World requests stop finalizing overdue roster deletions; remaining roster entry points retain cleanup. These are accepted boundary/cleanup differences rather than new authority.

Exact-head CI, Living Atlas and complete responsive browser workflows, source-tree equality, merge and production release receipts are pending. Existing preview/step/settlement bounds, peer delivery, legal Attack dispatch, private scenery, art and layout remain unchanged. Signed-in production movement/request timings could not be measured because the cloud browser transport timed out. Human gameplay acceptance remains open; no claim of zero network latency or full hosted acceptance follows from the injected regression.
