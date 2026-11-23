# Combat publication version floor — October 15

## Confirmed problem and result

A selected Owner publication can remain older than the shipped catalogue. The existing allocator used only the selected current base and database history, so a new publication could reuse an existing shipped version number. Real service regressions reproduce version2 allocation while the shipped Skill/Resonance are version5 and Essence version4.

New publications now allocate above the maximum of shipped history, preserved database history and the observed current base. The shipped floor is server-owned, independent of the editor’s mutable definition and current-pointer CAS. The new core lookup helpers reserve disabled shipped records as well as enabled history. Basic records use their shipped definitions. Custom identities have no invented shipped baseline. Selecting an older publication still requires that actual version as the CAS base; its history, text and mechanics are preserved.

The Master page projects the same floor to the four editors. Their existing next-version calculation includes it without changing the current version or inventing a selected publication. Publication still returns its actual authoritative version. There is no browser import of the server floor resolver, no new layout, action or client mutation authority.

## Persistence contract and release coordination

New migration `20261015191634_combat_content_version_floor.sql` creates service-only `publish_combat_content_v3(uuid,text,text,jsonb,integer,text,integer)`. The last parameter is the trusted shipped-version floor. It retains the real operator guard, complete-catalogue lock/token and selected-base CAS. A private helper derives from the known typed predecessor body, changing only the numbering expression; it retains complete Essence stamping, immutable insertion, pointer update and draft deletion transaction. An unrecognized predecessor aborts the migration. The private helper and public wrapper have an empty search path. The helper, old v1 and old v2 writers are unavailable to service callers; browser roles cannot invoke v3. No older writer fallback is attempted.

The existing v1/v2 bodies are not rewritten, and no immutable row or current publication is migrated. Reapplying the new migration preserves content history. Code and this migration must be coordinated at the reviewed release, alongside the earlier unapplied overhaul migrations; applying it independently would revoke the older v2 writer. Nothing in this checkpoint is applied to production.

## Verification

Observed RED: three actual service numbering cases; five initial in-memory floor cases; the actual RPC adapter’s expected safe writer/floor assertion; six actual page/editor/workflow assertions. The SQL suite first fails because the v3 writer is absent. A further in-memory integer-overflow case first fails and then aligns allocation with the actual PostgreSQL integer boundary.

GREEN:158 covering web cases across service, compatibility, adapter, actual page, all four editor kinds and workflow tests. Final21 repository/database cases pass. The broader26-case SQL/repository/typed/predecessor gate also passes before the additional in-memory overflow case is added. Actual PGlite execution covers Skill/Essence/Resonance version9/10 allocation from current1 and floor8/3, immutable older rows, nested Essence version/text, rollback to older current followed by monotonic allocation, migration reapply, invalid/exhausted floors, stale token/base, unchanged state/drafts on rejected operations, revoked operators, browser/private-helper/older-writer denial. These are single-session database schedules, not physical concurrent-session or hosted acceptance.

The current Supabase function/privilege documentation and changelog are checked. No relevant function-signature change is identified for this standard service-only RPC pattern. The final full repository `pnpm check` exits0:6,134 Vitest plus seven Node checks, formatting, lint, all eight typechecks and both production build tasks pass. The first full gate stopped on an unknown-row type in the new SQL test; that query now has the correct result type, and the complete gate is rerun successfully. No product changes follow the successful gate. The exact saved `0978314fad6a25827d218ce661ba36fb4989af30` CI, native reader/editor run38794761125/job116628120775 and actual Controlled run38794761493/job116628116167 pass. The unchanged24-context editor/reader matrix and32 Controlled cases remain functional; job logs confirm successful execution. Broader workflows are still running at this receipt and no new screenshot inspection is claimed for unchanged layouts.

## Scope

This resolves a combat publication dependency before applying the creative roster. It does not complete the roster, historical Restore to Draft, the remaining reader/authoring audit, the broader Master/world upgrades or a live release. Existing publications are not rebalanced or repointed by this change.
