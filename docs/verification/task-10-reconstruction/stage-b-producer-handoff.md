# Stage B producer handoff — partial implementation checkpoint

Stage B delta review BASE is `c96880123b8e31f6d8dec3bbbac024a1ff75609e` (accepted Stage A plus independently released current main, no Stage B product); cumulative Task10 BASE is `b83de822171d8f62726bd8b7a668a82d5d39b523`. This is an incremental source checkpoint, not Stage B freeze or acceptance. The complete Stage A actor/CAS/history and standalone-kind contracts remain binding.

## Discipline/Core SQL producer

Migration `20261020222401_published_discipline_producers.sql` was created with the pinned CLI after `migration new --help`. It appends authoritative `discipline_definitions` and `discipline_primary_profiles` inside the existing saved-revision publisher transaction. No actor/public signature changes. Current selection is the private `discipline_current_definitions` pointer, initialized from actual existing domain producers without creating content history; subsequent content-publication pointer changes select the corresponding exact domain definition. New publication floors cover every physical content, definition and Core version. The existing Core31/positive/six-stat/focus and unique-Core constraints remain. Existing derived offsets are preserved; a new identity has no invented offsets.

The actual Primary change v2/v3, active-build/personal-allocation creation triggers, public Primary catalogue, owned Discipline catalogue and owned Atlas progress reader use current selection. Their unchanged pinned/replay joins keep historical rows. The actual allocation reader/commit already use the pinned personal profile; publication does not mutate any character attributes, personal points, grants, builds or receipts. Current authored prerequisite evaluation uses existing mastery-stage and progression-cycle facts, retaining legacy rules for untouched Disciplines. Unsupported secret/flag discovery remains blocked.

The server category descriptor still blocks Discipline publication until the remaining complete consumer work is finished. The new SQL alone is not a finished editor or complete public/runtime producer.

## Expanded guard inventory

The same shared **nonblocking** advisory catalogue lock now guards six actual tables:

| Table | Existing/new |
| --- | --- |
| `character_skill_unlocks` | Accepted Stage A |
| `character_build_discipline_skills` | Accepted Stage A |
| `character_saved_build_loadouts` | Accepted Stage A |
| `phase4_skill_catalog` | Accepted Stage A |
| `character_active_builds` | Added in this slice |
| `character_attribute_personal_allocations` | Added in this slice |

The active/current selection mutations also take this shared try-lock before reading the current projection. Archive retains its exclusive catalogue lock; no waiting catalogue acquisition is introduced after character locking. Actual active-build and personal-profile dependencies block archive. The bounded reference extractor now includes authored prerequisite/partner/Essence/Resonance identities. Physical two-session execution for the new guard tables remains pending; PGlite is not physical concurrency evidence.

The actual Core allocation repository now uses the existing named admission-error mapper. Ten caller families are covered by20 HTTP mapping cases: original nine plus Core allocation. Contention maps to409; archived content remains an explicit400. No unrelated error mapping changes.

Seven new private helper signatures are added to the accepted fifteen-helper content inventory; all seven deny execute to anon, authenticated and service_role:

- `current_discipline_definitions_v1()`
- `validate_authored_discipline_unlock_v1(jsonb,text,integer)`
- `validate_authored_discipline_envelope_v1(jsonb)`
- `project_published_discipline_v1(uuid)`
- `select_published_discipline_v1()`
- `authored_discipline_unlock_satisfied_v1(uuid,jsonb)`
- `lock_current_discipline_selection_v1()`

The current-pointer table has RLS and no direct table privileges for those roles. The actual all-migration lifecycle fixture still executes the native Staff SQL with the original33 + Players4 + Content4 =41 actor-signature inventory, plus all14 retired overload guards. This is local execution of that native script, not a new native PostgreSQL job. Later Stage B additions must extend this inventory again if they add helpers or guard tables.

## Remaining work

Canonical unordered-pair selection is ruled by the controller: per-Discipline lists are declarations/views of one pair authority. Conflicting current non-null declarations must block before publication; omission cannot erase the other side's explicit choice. Builtin selection applies only without an authored claim. Invalid selected targets must never fall back. Explicit replacement/removal, both publication orders, stale CAS, rollback and exact old pins require tests. This checkpoint has initial relationship validation but has not yet implemented the full canonical selection consumer.

Per-Skill/per-Discipline earned grants, learned/equipped/named-loadout transport, actual trial credit, current Essence/Resonance runtime selection, builtin first edit, Profile/Atlas/Manual, creation/allocation Web adapters, Players copy and sourceHash/buildVersion fresh admission integration remain substantive work. Preserve retained testing entitlement separately from earned provenance. Do not infer completion from the current pointer or schema tests. Stage C/D remain held.

## Canonical current-selection checkpoint

The same new migration now implements one unordered-pair selection from current Discipline declarations. Conflicting non-null declarations reject the losing saved publication. A missing declaration does not erase the other side. When either Discipline has an authored publication, the absence of both declarations is authoritative and never falls back to the builtin pair; untouched pairs preserve the inventory-checked builtin mapping. Pure Essence selection follows the same current Discipline declaration/absence rule. The actual existing SQL `resolve_resonance_reference_v1(text,text)` and `resolve_essence_reference_v1(text,text)` now resolve the selected identity's current publication pointer, not maximum physical history. Existing exact readers remain unchanged.

New service-only ordinary reader `public.read_current_discipline_selection_v1(text,text)` returns `{selectionVersion:1,catalogueToken,essence,resonance}`. The two extension values use existing exact snapshot-reference shapes or explicit null. Browser roles have no execute grant; this is not a new privileged actor mutation. Two additional private helpers, `current_resonance_selection_key_v1(text,text)` and `current_essence_selection_key_v1(text,text)`, deny anon/authenticated/service execution, bringing this migration's newly introduced private helpers to nine. Existing resolver helper ACLs are retained. The complete actor inventory remains the accepted41, with a fresh whole inventory execution still required at freeze.

`RpcPublishedCombatContentSource` consumes and strictly validates the new reader. Actual server current E/R resolution follows its selected identity and exact version, validates the complete runtime definition, and rejects disabled/mismatched/missing selected content without builtin substitution. Captured admission compares the selection's catalogue token with the frozen catalogue token and returns existing `STALE_VERSION` on a concurrent generation change. Historical exact pins never consult this current-selection reader. The older in-memory source interface remains optional for isolated legacy fixtures; the actual RPC implementation always supplies the authoritative reader.

Evidence: five actual SQL RED cases for old static selection, then five GREEN; expanded producer file19 passes. New actual-RPC resolver RED7 with one historical control passes; covering resolver/catalogue44 cases across3 files pass. Intermediate runs with misleading `green` filenames failed and remain explicitly in the ledger: one transport fixture needed the new read contract; three SQL control expectations used a guessed initial version, wrong error spelling and attempted forbidden history mutation. Corrected controls now use the returned exact version, actual named conflict, and separate injected malformed physical rows without altering old immutable history. Web/DB types pass. These tests are local PGlite/application evidence only.

Still open within Stage B: prepublication guards for disabled/invalid selected targets, builtin Used-by retirement after actual declaration replacement/removal, canonical replacement/late-failure proof, committed-snapshot/current-selection freshness integration, per-Discipline earned provenance and every remaining consumer, plus native physical new-table lock coverage. These are implementation obligations, not deferred acceptance findings. This checkpoint does not unlock Discipline authoring in the server descriptor or claim a finished editor.


### Stage B selected-target publication and dependency guard — 2026-10-20

Continued after the clean docs/evidence-only coordinator merge `e51bec2ce66c740d931d590517f25ac005a6b90d`. Three meaningful SQL RED cases exposed an obsolete unconditional builtin archive guard and publication of disabled selected targets. The new private `validate_current_discipline_selections_v1()` publication trigger validates the prospective canonical selection inside the existing publication transaction. Failed target/Discipline publication and conflicting physical old-pointer rollback leave content history/current state/draft consumption/domain Core selection unchanged. Removing declarations releases only mappings no longer used; untouched builtin pairs and explicit current-definition dependencies still block archive. No history rewriting or new actor API.

Focused producer file22 GREEN after the guard correction, plus one new old-pointer rollback/private-helper test GREEN (22 skipped), DB types and touched lint pass. The failed initial green attempt is retained: Used-by had correctly released its blocker but the separate archive mutation still had the older unconditional check; that precise guard now consults actual blockers. New helper denies all three exposed roles, bringing this migration's new private helpers to ten. The invalid-retained-data read test disables only this new pointer trigger inside its rollback fixture before injecting separate bad rows; ordinary authoring/publication tests retain the real trigger. This is explicit negative reader coverage, not a claim that malformed writes succeed normally.

Stage B remains incomplete: earned storage/provisioning/trial/caller paths, authored Core/public adapters, committed fresh admission and physical new-table concurrency coverage still require work. No broad suite or native claim. C/D held.


### Stage B attached earned-grant producer checkpoint — 2026-10-20

Pinned CLI help then `migration new discipline_skill_earned_provenance` created `20261020225734_discipline_skill_earned_provenance.sql`. Before structural edits, the actual direct-table SQL trace found18 current functions. The controller approved an attached normalized relation after comparing its footprint with widening the existing learned-Skill PK. `stage-b-earned-initial-inventory.json` records exact signatures and function-body hashes from that trace; the repeatable inspector and earlier broader49-function trace cover different scopes. The new relation is not a competing learned/version authority.

`character_discipline_skill_grants` has a mandatory existing `(character_id,skill_id)` FK and per-Discipline PK. Backfill copies exact native time/provenance; only existing support/`discipline-testing-open:v1` remains unearned. Existing learned rows, PK, version, intrinsic source and original provenance remain byte-equivalent. Atomic private grant provisioning attaches actual eligibility; first acquisition through a shared link does not fabricate native eligibility. Current authored links/stages feed actual mastery provisioning, while unchanged native foundations keep their prior all-Skill entitlement. Publication alone grants nothing. Existing earned or testing facts survive unlink; actual mastery can add separate earned provenance to retained testing access without replacing its original timestamp/source.

The actual native grant RPC retains its signature/exact-version replay check and attaches native grants. The old native learned reader and save guard require an actual native grant. One shared private availability join supplies service-only `get_character_learned_skills_v2(uuid,uuid)`, including exact intrinsic source/learned version, eligibility identity, acquisition and earned provenance. This is an ordinary owned read, not a new privileged actor mutation. The new private helpers are `grant_discipline_skill_v1(uuid,text,integer,text,text,text,text,boolean)`, `current_discipline_skill_catalog_v1(text)` and `character_discipline_skill_availability_v1(uuid)`, all explicitly denied to anon/authenticated/service_role. The private grant relation has RLS/no exposed table grants and joins the same shared nonblocking archive/admission guard, now7 tables. Grant facts block archive of their Skill/eligibility identity; existing intrinsic dependencies remain.

Evidence: original earned3 RED and revised attached-authority3 RED preserved; focused3 GREEN, covering producer28 GREEN; additional4 GREEN/25 skipped prove exact pre-migration native/testing learned bytes, unearned native usability, cross-only/no native invention, wrong-owner read denial, mandatory FK, RLS/private helper/service read ACLs and full losing-grant rollback. DB types and touched lint pass. Fresh application transport integration is still open, so this does not claim new shared selections are yet available in the UI.

Remaining Stage B: eligibility must flow through actual equipped/named-loadout/Players/profile paths and immutable trial claims, with explicit choice for multiple eligible grants, historical omitted-native behavior, four-Skill capacity and unchanged intrinsic mechanics. Current Core/public/builtin first-edit/fresh admission coherence and native physical guard coverage also remain. No broad suite, hosted mutation, remote source publication or deployment was performed by this worker. C/D held.


### Stage B actual SQL equip/loadout eligibility checkpoint — 2026-10-20

Extended the same new earned-grant migration through actual `save_character_discipline_skill_loadout_v1`, equipped storage, committed snapshot v1/v2 serializers, named-loadout save/activate and the real build-change pruning trigger. New save requests select an explicit active grant, or infer only a sole active grant; multiple eligible active Disciplines require an explicit choice. Present malformed eligibility fails closed before writes. Intrinsic source and learned version are independently retained. The four-total bound precedes eligibility lookup; existing mixed three-per-side validation remains. Pruning now preserves selected eligibility/order/exact pins and the specified valid three-plus-one capacity, rather than the old hardcoded two-per-side truncation.

Old saved references that omit eligibility are materialized as intrinsic/native only in activation's local working value; the persisted saved body is not rewritten. The new service-only `get_character_discipline_skill_loadout_v2(uuid,uuid)` returns the explicit selected eligibility. Two new private helpers, `default_native_skill_eligibility_v1()` and `resolve_skill_eligibility_v1(uuid,jsonb,text,text)`, have explicit deny ACLs. This migration now introduces five private helpers (fifteen total across both Stage B migrations), plus the existing seven guarded tables. Ordinary actor mutation signatures remain unchanged; full41 inventory execution remains a later freeze check.

Evidence: actual equip/reference7 RED →7 GREEN. Intermediate green-labelled failures remain in the exact ledger: a SQL dollar-quoting defect prevented migration application, then two fixtures supplied the old phase4 catalogue version instead of the actual learned version; production correctly rejected them. The corrected controls use the real learned pin. Named-loadout/unequipped eligibility archive2 GREEN; covering producer39 GREEN; additional valid three-plus-one exact-pin pruning1 GREEN/39 skipped. Initial DB typecheck exposed inferred never[] fixture arrays; explicit typed fixture arrays fix it. Final DB types/lint/style and freshness checks are recorded separately. Fresh main at23:12UTC remains `4793b77c607b98bc8a8ccf783da56d69f429f0fe`, ancestor of this feature. The previous d746 checkpoint added12 ledger rows, not the13 estimated in a progress message; no command/evidence was missing.

Application transport currently still needs migration to the new learned/equipped readers and explicit eligibility; immutable earned trial capture/credit, Players copy and actual admission coherence remain open. Authored Core/public consumers/builtin first-edit and real physical concurrency remain open too. This is a recoverable SQL checkpoint, not Stage B freeze, a finished editor or a release. C/D held.
