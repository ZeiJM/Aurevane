# Captured Ability restoration through PostgreSQL JSONB — October 14

Draft combat continuation; no production deployment or completed overhaul claim.

## Failure and root cause

Exact admission head `e841707a2b7e3f1ec408f7011106d88abce7efdd` passed CI and seven supporting scopes, but Representative Buildcraft, UI layout, Browser smoke and Living Atlas failed battle entry. The actual UI error context says **The stored battle state is invalid.** Browser and Atlas failures occur at authenticated battle creation/entry, including proximity PvP.

`readPersistedEncounter` validates then refreezes captured definitions. PostgreSQL JSONB reorders object properties; `reconcileCombatAbilitySources` reconstructed an envelope then compared JSON serialization strings. Identical definitions were consequently rejected as `captured-source-cannot-change-in-place`. New Basic admission reliably supplies captures, exposing this existing generic comparison defect. Simple JSON stringify/parse tests preserve key order and did not exercise the database boundary.

## Correction

One shared capture comparison checks all primitive values, exact object keys and ordered array elements recursively. Object-property order has no mechanical meaning. Reconciliation, command participant authority and the duplicate Basic Ability binding reuse this comparison. Validation, exact IDs/versions, capture freezing, array/effect order and immutable mechanics remain enforced. No schema, migration, hosted database mutation, authorization relaxation or extra Move cost is introduced.

## Regression evidence

- Actual PGlite PostgreSQL JSONB reproduced Basic and Discipline restore failures with `captured-source-cannot-change-in-place` before the fix.
- A reordered nested definition reproduced the reconciliation failure; a differently ordered duplicate Basic Ability reproduced `invalid-captured-basic-definition` before the shared comparison was applied there.
- Tests now exercise zero-event startup via the actual `create_battle_session_v2` migrations, validation, refreeze, subsequent authoritative action execution and tamper rejection for Basic/Discipline captures.
- Core tests cover unchanged reordered definitions executing, changed AP costs rejected, changed tag-array order rejected, and contradictory Basic Ability duplicates rejected.

## Verification boundary

Format, lint and all eight package type checks pass. All repository tests pass with sequential package scheduling: core 3,044/158, web 2,489/295, DB 96/15, validation 92/9, audio 17/3, realtime 3/1 and worker 2/1, plus seven Node checks. The first `pnpm check` run stopped on the unchanged supernatural-story-state migration setup hook exceeding 10 seconds while packages ran concurrently; the complete sequential test run passes without changing timeouts or product code. Production build passes. Current main remains `064389db37afcdf5693caa4d9dba46a7f737df0f` at the final freshness check; no reconciliation is needed. Exact-head equipped native battle-entry gates must be rerun after the durable checkpoint. Earlier hosted failures remain recorded until those gates pass; local reproduction alone is not native or human acceptance.

Move controller/AI, complete captured Basic displays/editors, Controlled readiness and the creative balanced all-tag roster remain outstanding before the authorized combat release.
