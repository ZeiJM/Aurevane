# Isola first movement approval latency

Status: LIVE for testing through PR #908, merge `5135e35e73a88a4d8aa9aaaf0218852df06a7f51`, Production `dpl_8Ws132vHEPJ4riaB2sqMhBxYx46g`, READY at `2026-10-14T20:57:56.518Z` (16:57:56.518 Trinidad). Human movement acceptance remains open.

## Reproduction and correction

The initial World request serializes active-session verification, selected-character roster lookup, canonical World read and movement commit. The roster lookup is redundant for this route: the mandatory World read already rejects foreign characters and pending deletion before world-state initialization or updates.

A real handler/repository/controller/motion regression delays each resource boundary by175ms. Original source acknowledges at700ms, exhausting the unchanged600ms preview and failing the moving assertion at600ms. The candidate removes the roster lookup, acknowledges at525ms, advances at600/650ms without an approval correction jump, and reaches the exact destination. These are injected timings, not production request measurements.

The unchanged authenticated actor still verifies JWT claims and fresh active-session ownership first. The selected cookie supplies only a canonical UUID address. Every GET/normal command/Attack path enters the existing World ownership and deletion checks before a World response or mutation. Production SQL definitions were inspected read-only and match this contract. No SQL, grant, RLS, migration, session cache or actor implementation changes.

An earlier parallel roster-read prototype was rejected before publication: `get_character_slots_v2` finalizes overdue deletions and can abandon battles, so it must not run before session approval. The final candidate makes no pre-session roster call and leaves `actor.ts` exactly unchanged.

Numeric `Server-Timing` records identity, command and total durations on validated commands. Slow approvals/conflicts emit an intent/status/duration-only warning at most once per30seconds per instance; no tokens, user/character identities, locations, targets or bodies are logged. The existing native held-walk case attaches request/response timings without changing any assertion, skip or workflow limit.

## Verification

The cookie-aware original handler fails the pause regression before the change. The final candidate passes the regression and negative cases for incomplete claims, pending/revoked session, missing/noncanonical selection and canonical ownership/deletion denial. Full `corepack pnpm check` exits0: formatting, lint, all package types,5,681 Vitest tests, seven Node checks and production builds. Log: `/tmp/isola-start-pause-final-quality.log`. Diff whitespace checks pass.

Independent review finds no critical or important issue in the final narrow candidate;88 tests across five files and whitespace checks pass independently. The rejected pre-session prototype is absent. Malformed commands and cookie/body mismatches may now reject400/409 before ownership denial403, exposing no private state. World requests stop finalizing overdue roster deletions; remaining roster entry points retain cleanup. These are accepted boundary/cleanup differences rather than new authority.

Exact-head CI, Living Atlas and complete responsive browser workflows, source-tree equality, merge and production release checks pass; receipts follow. Existing preview/step/settlement bounds, peer delivery, legal Attack dispatch, private scenery, art and layout remain unchanged. Signed-in production movement/request timings could not be measured because the cloud browser transport timed out. Human gameplay acceptance remains open; no claim of zero network latency or full hosted acceptance follows from the injected regression.

## Verified release receipt

Candidate `5bf73f83e5f92f0fa1ca8986e06b39b86663131c` and tested merge ref `1f09c3bd728f2ee7c58055b900a7bbee5f4ff908` share tree `08d7ea009d54a450287c119276ced0576bec2557`. Fresh main remained `81fd91dd0964de9a1fbe181392d285a10a4fc339` before merge. All triggered exact-head workflows succeed:

- [CI](https://github.com/ZeiJM/Aurevane/actions/runs/38624644418):5,681 Vitest tests, seven Node checks, all quality/build gates and31 pgTAP.
- [Living Atlas](https://github.com/ZeiJM/Aurevane/actions/runs/38624644723):50 passed,82 existing project skips. Held movement, delayed alternate-route confirmation, seam/distant travel, private peer interpolation and legal Attack cases pass. The disposable native peer delivery sample is388ms; both-moving maximum advances are0.442231/0.500523 tile under unchanged0.75/-0.1 bounds. This is not hosted multiplayer evidence.
- [Complete Browser](https://github.com/ZeiJM/Aurevane/actions/runs/38624644805):348 Chromium passed with267 existing skips;10 Edge passed with two existing skips. Earlier4/6/3 checks and focused73 passed with21 existing skips; supporting regression gates pass. No narrowed workflow or assertion relaxation.

PR #908 merges as `5135e35e73a88a4d8aa9aaaf0218852df06a7f51`; the merged tree exactly matches the tested tree. The one authorized manual production deployment `dpl_8Ws132vHEPJ4riaB2sqMhBxYx46g` is READY at `2026-10-14T20:57:56.518Z`, and the canonical domain resolves to that exact ID/source. Rollback retained: `dpl_9ihjPb7X6Qb88wcczLYQKXkVGAR1` / `36fbe14cdd44e2f4562e5cc4235e3cd484cbdb89`.

Vercel fetches for Home and World return200 after normal redirects and show the unauthenticated sign-in gateway (Email/Password); no app session is supplied. The first exact-deployment warning/error/fatal scan returns no logs. Public web fetch and native executor are unavailable at this checkpoint, so authenticated production continuity, production RTT and hosted peer/load testing remain unverified. Existing cloud browser transport attempts timed out. No real player is attacked/messaged/surrendered; no human acceptance is claimed.
