# Task 10 — bounded native fix round 3 review

## Verdict

- **Scoped spec: PASS.**
- **Scoped code quality: APPROVED.**
- **Native compatibility finding: ADDRESSED in source and retained focused evidence.**
- **No new Critical or Important findings within this diff.**

The failed native full-quality run remains failed. This verdict does not claim a successful native rerun, browser acceptance, Stage B approval, release readiness, or complete Task 10 acceptance.

## Scope and method

Reviewed only `a404fe050246a415c2ae7a6b8a86744d97cd9e11..21926f00dc1a4388e88641ddb05499cf5f04f4a2`, using the complete supplied log/stat/diff package, original Task 10 brief, final “Bounded fix round 3” report section, and retained diagnosis probe source. The range changes exactly three tracked files: the compatibility test, report, and append-only verification ledger. There are no production, migration, authority, configuration, mechanic, or timeout changes.

Applied the same combined SDD spec/quality review method. Focused unchanged-source inspection covered only the test fixture's RPC behavior, the actual Status definition used by the fixture, the publication guard order, and the existing HTTP error mapping, to substantiate the changed assertions and report. No broad Stage B audit, helper review, product mutation, or passing-test rerun was performed.

## Findings and evidence

**The original kind-change behavior remains tested.** At `apps/web/src/server/master/combat-publication-compatibility.test.ts:279–300`, the original named case now supplies a complete `PHASE4_STATUSES[0]` definition with the intended custom identity and publication version. That actual Status definition includes the required finite semantics; this is not an identity-only object cast to bypass validation. The original `INVALID_REQUEST` assertion and empty-write assertion remain. The added RPC assertion requires exactly one `read_combat_content_catalogue_v1` call.

The unchanged publication flow validates the catalogue snapshot before checking whether the current identity has another kind. With the valid retained Status, the existing different-kind guard is reachable and rejects the prospective Skill before publication. The changed fixture therefore restores the original test's intended boundary without weakening or reordering production validation.

**Malformed retained data still fails closed.** At test lines 301–317, the former identity-only Status body is retained in a separate test. It asserts `PERSISTENCE_UNAVAILABLE`, zero writes, and precisely the same single catalogue read. The shared fixture records all RPC calls and classifies non-read calls as writes; together, these assertions exclude both publication and alternate RPC paths. No assertion was weakened to accept either error indiscriminately.

**Evidence claims are appropriately bounded.** The tests and temporary controls invoke the actual store with a mocked RPC boundary. They establish service-level error codes and call sequencing, not database execution or HTTP requests. The existing mapping in `apps/web/src/server/http/error-response.ts:12,21` maps `INVALID_REQUEST` to 400 and `PERSISTENCE_UNAVAILABLE` to 503. The report explicitly distinguishes that mapping from observed HTTP traffic; its shorthand 503 description does not claim an extra route-level test.

Independently verified that all 147 preceding ledger rows are byte-unchanged and all eight new raw-log SHA-256 hashes match. The retained probe source is exactly 3,599 bytes with SHA-256 `9ca4237c3e0fbdeb296df3da9ab2dfd1b40dc20c06de4c8b5ca506b33811aab5`. Inspected results show:

- Original unchanged case: one failure and 12 skipped, with expected `INVALID_REQUEST` versus actual `PERSISTENCE_UNAVAILABLE`.
- Temporary valid/malformed controls: two passed, with the asserted single read and zero writes.
- Final compatibility/catalogue/standalone coverage: **74 tests across three files passed**, including both retained permanent cases.
- Web type generation/TypeScript and touched-file lint passed; formatting was applied successfully.

The scoped commit diff also passes whitespace validation. No unchanged suite was repeated during review.

## Preserved rulings and limits

Original Stage A I1 remains closed by the previously accepted repairs. M1 remains deferred to Task 13; M2 remains assigned to backend Stage B and editor Stage D. This review neither reopens those rulings nor approves the unreviewed Stage B descriptors/schema already present in the fix base. The separate actual-SQL work in progress is outside this diff and review.

Native quality job `118914649206` is not relabelled green by local evidence. Browser work remains independently gated, and there is no release approval. The controller owns native rerun/disposition, publication, and the decision to resume the paused Stage B work after this scoped gate.
