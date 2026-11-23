# Independent November 6 release SQL review

Result: no blocking findings in the prepared, unexecuted transaction. No SQL edits or hosted writes were performed by this reviewer.

Reviewed `/tmp/nov6-release-ops/prepare.py`, the generated SQL, fresh `/tmp/nov6-item-baselines.json`, tracked `docs/verification/2026-11-06-item-technique-successors.json`, current source-index/Commit/publication functions, the media migration and the disposable test/log.

Reviewed SQL: 40,743 bytes; SHA-256 `d3214f7b8583b879559b7d60b55a2a04723fe35e3b6a274dc19e4a93468aac9a`.

## Scope and payload verification

- The four unique target IDs and complete source8 payloads exactly match the tracked audit. Every fresh source6 baseline exactly matches the corresponding audited predecessor. Removing only `actions.support.media` and restoring version6 reconstructs each complete source predecessor.
- Each of the three publication payloads clones its current hosted publication body. Removing only the new support media and restoring its prior content version reconstructs the complete publication predecessor. Stormcaller and Twinfang each retain all three explicit Instant effect fields; no effects, costs, durations, requirements, stock or other mechanics are replaced from the newer source fallback.
- Emberbrand revision10/floor7/publication7 and Stormcaller/Twinfang revision5/floor6/publication3 are guarded. Source registration advances their revisions once and sets floor/builtin8; ordinary Commit receives those fresh revisions and floor8, producing publication9. Exact publication bodies/version9 are read back.
- Tower Shield revision2/floor6 is registered as source8 only. Its null publication payload is not committed, and its publication pointer is included in preservation checks, retaining source fallback.

## Guards and preservation

- The catalogue lock and twelve Share Row Exclusive table locks enclose the baseline checks, writes, exact readback and before/after preservation comparison in one transaction.
- Production SQL retains the hard `2026-11-06T18:58:15.965590Z` deadline and rejects other client transactions started before `2026-11-06T18:25:45.965590Z`.
- Target Owner drafts, source/publication version >=8 collisions, changed current bodies, changed immutable source6 bodies, record kind/lifecycle/revision/floor/builtin changes and a changed Owner count abort before registration.
- Before/after digest definitions are identical. Their exclusions are limited to the four target records, their exact new source8 rows, the three intended publication pointers and their exact new version9 rows. All earlier immutable versions, all other source rows and records, all drafts, Tower's publication state, inventory/stacks/grants, characters/builds/battles and timing-policy rows remain covered.
- No direct historical, inventory, stock or Owner-draft rewrite appears in the transaction. Canonical Commit's transient draft is permitted only after the explicit no-existing-target-draft guard, and the whole drafts table is checked afterward. No parser or variable/column ambiguity was identified.

## Validation evidence and limits

Mechanical JSON comparisons, target uniqueness/counts, source/publication change scope, SQL checksum and identical digest predicates passed during this review. `/tmp/nov6-release-ops/disposable.log` records both cases passing at the unchanged 60-second test limit: ordinary four-source/three-publication success and stale Emberbrand revision rollback with zero new source8/version9 rows. The test uses the real migration helper and changes only its in-memory copy's deadline to year2000; the production SQL deadline remains intact. These tests were run by the release owner; this reviewer inspected their code and completed log without rerunning them.

The two separately reviewed additive migrations remain a release-owner step after the mandatory drain; they are not executed by this SQL artifact. No hosted registration, publication, migration, drain completion or final postflight is claimed by this review. The release owner must retain the hold and verify the deadline/zero-older-transaction condition before those controlled steps.
