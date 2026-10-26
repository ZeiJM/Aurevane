# Master publication and gameplay reads — October 26, 2026

Local implementation receipt; no hosted migration, publication or deployment has occurred.

## Demonstrated causes and corrections

`read_current_discipline_selection_v1`, `get_character_committed_build_snapshot_v2` and the catalogue publication lock read the complete catalogue merely to obtain its token. The former catalogue reader serializes every current immutable definition plus all complete-record metadata and the timing policy, then hashes that full JSON. Character build display calls both Essence and Resonance selection, causing two identical selection RPCs in one captured generation.

Migration `20261026062322_combat_catalogue_read_performance.sql` introduces service-only `read_combat_content_catalogue_token_v1()`. The token hashes the current content key/kind/immutable version ID pointers, every complete-record metadata field, and the entire small policy. Immutable version rows already reject all updates/deletes with `COMBAT_CONTENT_VERSION_IMMUTABLE`, so their IDs identify every definition and provenance field previously hashed. Record revisions/draft state/lifecycle and policy changes retain CAS coverage. There is no TTL or weaker catalogue lock. The full snapshot and token-only readers use the same helper and stable MVCC snapshot. Migration replacement guards preserve existing caller authorization, locks and payloads.

The captured resolver coalesces the same in-flight Discipline selection within that capture only. Another capture reads authority again; a token mismatch still throws `STALE_VERSION`.

Active build v4 previously delegated names/descriptions to the pinned v2 mechanical definition. It now overlays current primary/secondary names and summaries while retaining committed definition/profile versions, Core, stat offsets and enabled flags. The pinned flags must remain: derived-stat calculation rejects a disabled primary. Current catalogue readers and change commands still exclude/reject disabled new selections. No character, active build, skill grant, allocation or immutable historical row is rewritten.

A separate profile-entry defect was reproduced for disabled learned Skills: `buildDisciplineSkillView` treated a valid disabled definition as persistence failure even when unequipped. Display now retains validated disabled learned/equipped definitions. New saves reject disabled selection as `INVALID_REQUEST`, and players can unequip it without losing learned facts. Battle admission continues rejecting disabled current Skills in the existing shared authority path.

## Hosted read-only observations

Supabase project read-only SQL; observations taken on October 26. These are one query observation per expression under current load, not a load test or release acceptance.

| Read expression | Execution time | Shared hit blocks |
| --- | ---: | ---: |
| Existing `read_combat_content_catalogue_v1()->>'token'` | 711.201 ms | 1,727 |
| New compact token expression, evaluated directly without creating a hosted function | 23.454 ms | 369 |

At observation time there were 295 current publications and 311 complete-record rows. Current definitions were 507,477 stored bytes and 781,318 serialized JSON bytes. The compact query scans only publication pointers and record metadata plus the small policy. Its PostgreSQL plan uses `combat_content_publications_pkey` (295 rows) and `combat_content_records_pkey` (311 rows), each once. Neither observation read physical blocks or wrote data. The existing stable function appears as a Result node, with its internal work accounted in the above 1,727 shared hits.

Reproduction queries (no identities or authored content returned):

```sql
explain (analyze,buffers,format json)
select public.read_combat_content_catalogue_v1()->>'token';

explain (analyze,buffers,format json)
with pointers as (
  select coalesce(jsonb_agg(jsonb_build_array(p.content_key,p.content_kind,p.version_id)
    order by p.content_key),'[]'::jsonb) value
  from app_private.combat_content_publications p
), states as (
  select coalesce(jsonb_agg(to_jsonb(r) order by r.content_key),'[]'::jsonb) value
  from app_private.combat_content_records r
)
select md5(jsonb_build_object('publications',pointers.value,'records',states.value,
  'policy',public.read_combat_effect_timing_policy_v1())::text)
from pointers cross join states;
```

Parent investigation separately observed production `character_nexus.persistence_unavailable` at `discipline_build`, PostgreSQL statement timeouts inside the nested catalogue/selection path, and substantial `WORLD_STALE_VERSION` conflict volume. This patch fixes demonstrated unnecessary catalogue work and profile-reader failures. It does not establish the origin of the World conflict volume or prove all reported interruptions share one cause. No World retry or authority behavior was changed.

## Verification

RED observed before implementation:

- Captured Essence/Resonance read called the selection RPC twice instead of once.
- Physical migration-backed selected disabled Discipline continued showing former text after publication.
- Disabled learned/equipped Skill caused `PERSISTENCE_UNAVAILABLE` during profile loading.
- Token helper was absent.

GREEN:

- Physical PGlite tests applying the complete real migration chain: `combat-catalogue-read-performance.test.ts` and `combat-content-discipline-producers.test.ts`: 60 tests. Coverage includes current disabled Discipline copy, unchanged committed Core/player rows, rejection of new disabled selection, full/token matching, record metadata invalidation without a revision bump, pointer replacement, policy publication, unchanged token for unselected history, immutable-row enforcement and service-only ACL.
- Seven affected web suites: 112 tests (`character-build-service`, `character-build-essence`, `combat-content-admission`, `combat-content-publication-consumption`, `combat-content-selection`, `combat-content-catalogue`, `combat-content-resolver`).
- Adjacent `battle-build-authority-mixed-source-cap`, plus repeat service/selection checks: 62 tests, including rejection of disabled current Skill at real battle admission and unchanged historical restoration.
- DB TypeScript check, focused DB/web ESLint, Prettier and diff whitespace checks.

Adjacent complete-record/catalogue/version-floor database run had 112 passing tests and two actor-inventory count failures: `combined actor inventory includes original33 Players4 Content4 Media2 Event2 with private helpers inaccessible` and `executes the complete native Staff fixture with all 45 real actor contracts on the current migration chain`. New concurrently added commit/music wrappers increase that inventory to 48. Parent owns inventory fixture reconciliation and final combined verification; this receipt does not claim that earlier run passed.

The parent owns final whole-branch checks, browser/UI acceptance and release authorization. No source push, commit, hosted mutation or deployment was performed by this subtask.

## Authored Discipline artwork follow-through

Closed the static-sigil consumer gap identified during the initial review. Current active and chooser SQL DTOs now include the current authored media descriptor, independently of the pinned mechanical definition/profile. Repository parsing validates finalized identity/checksum/dimensions/crop and preserves the exact descriptor. Optional `DisciplineDefinition.media` and `DisciplineAtlasEntry.media` carry this presentation metadata; committed battle references/captures are unchanged.

`FoundationDisciplineSigil` now prefers the current finalized artwork through its immutable `/api/content-media/<id>` URL, then a recognized authored registry artwork ID, then the native fallback. Existing current data flows explicitly pass media through Arsenal, Manage Disciplines, creation/review, public Manual Atlas and the nonveiled Mastery DTO. Identity rail context already carries the complete current definition, requiring no additional request. No metadata fetch was added per image; replacing an image changes its immutable URL, and absent artwork restores the existing native fallback.

New RED observations: actual sigil and actual Discipline library rendered native artwork despite a supplied finalized image; physical active-build SQL omitted the newly published image descriptor. Both are GREEN after the repair. Physical regression uses actual PNG finalization and publication, then verifies current image metadata while a selected Discipline is disabled, with the prior mechanical pins/Core and all player facts preserved. A separate physical chooser regression checks current artwork alongside the exact published Core.

Artwork checks: seven focused web files/32 tests pass, including native fallback/replacement URLs, actual library output, lossless active/current-catalogue descriptor mapping and rejection of a forged URL identity. Three physical DB files/74 tests pass (Discipline producers, catalogue performance and media lifecycle). Scoped web ESLint passes. Full web TypeScript initially reported one own unintended FocusBadges prop (removed) and two concurrent parent-file errors (`master/activity` section and narrowed effect-profile comparison); final combined check remains parent-owned.

Final artwork check update: game-core TypeScript, full web `tsc --noEmit`, scoped core/DB/web ESLint and diff whitespace checks all pass after the concurrent parent-file fixes. The earlier TypeScript failures are recorded above as intermediate evidence only.
