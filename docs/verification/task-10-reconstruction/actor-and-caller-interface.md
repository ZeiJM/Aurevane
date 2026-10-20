# Stage A content authority and caller inventory — implementation freeze for review

The accepted Task 8 actor contract and Task 9 backend handoff remain binding. The current physical inventory is **original 33 + Players 4 + Content 4 = 41** explicit actor signatures, including private assertion overloads. The all-migration PGlite fixture executes the actual native Staff verification SQL and checks this inventory; native PostgreSQL execution of these new changes is still pending.

## New service-only actor operations

Every operation first calls `app_private.assert_master_panel_operator_v1(p_actor_user_id,p_actor_character_id)`, which selects the existing live `content.combat.author` capability. The Owner account bootstrap remains the existing exception. The browser cannot supply authority: `createSelectedCharacterRpc` reloads the authenticated account and current selection and replaces `p_actor_character_id`. Both anon and authenticated lack execute; the fixture also attempts actual authenticated calls.

| Exact public signature | Contract |
| --- | --- |
| `read_combat_content_record_v1(uuid,uuid,text)` | Complete stored identity, lifecycle, revision, draft, current, last three immutable versions, attribution, links and Used-by |
| `list_combat_content_records_v1(uuid,uuid,text,text,text,text,integer)` | Kind/lifecycle/search/keyset filters, 1–100 records |
| `write_combat_content_record_v1(uuid,uuid,text,jsonb)` | Create/duplicate/save/restore/archive/link/unlink under full-record CAS; request-key retries for create/duplicate/link/unlink |
| `publish_saved_combat_content_v1(uuid,uuid,text,bigint,integer,text,integer)` | Saved draft revision + current base + catalogue token + trusted version floor; no submitted definition |

The complete actual actor inventory is asserted by `.github/scripts/verify-master-panel-staff-authority.sql`. The native fixture explicitly inventories all 15 new private record/validation/admission/reference helpers and denies service-role, anon and authenticated execute grants; the two retained private floor-helper overloads stay inaccessible. The private state tables have no direct service write authority.

## Retired unsafe overloads

Migration `20261020202415` replaces the bodies of all **14** existing mutation overloads, preserving signatures and ACLs. Each executes its actual predecessor account/selected-actor capability assertion **before** the precise `0A000` retirement error. The focused fixture invokes every exact `pg_proc` signature with both an authorized Owner and an unauthorized account.

| Family | Overloads | Authorized result |
| --- | --- | --- |
| `save_combat_content_draft_v1` | Account + selected actor | `COMBAT_CONTENT_COMPLETE_RECORD_REQUIRED` |
| `publish_combat_content_v1`, `v2`, `v3` | Account + selected actor each | `COMBAT_CONTENT_SAVED_REVISION_REQUIRED` |
| `app_private.publish_combat_content_with_floor_v1` | Account + selected actor | `COMBAT_CONTENT_SAVED_REVISION_REQUIRED`; helper remains private |
| `set_combat_content_publication_v1`, `v2` | Account + selected actor each | `COMBAT_CONTENT_RESTORE_TO_DRAFT_REQUIRED` |

Direct service writes to legacy draft/publication/history tables are revoked. Secure complete-record RPCs retain their necessary writes. Exact immutable history and ordinary current gameplay readers retain their paths; tombstoned current identities raise a named archive error instead of allowing builtin fallback.

## Actual callers and verification disposition

- The complete-record HTTP command enters the existing combat-authoring handler and service, uses the selected actor wrapper and calls the four new store operations. Saved publication loads the current saved record, validates the prospective compatible combat catalogue and sends only revision/base/token/floor.
- The existing editor and legacy authoring service methods still call the retired mutations. **This is an incomplete backend release unit.** Stage D must migrate those UI paths before deployment; these checkpoints do not certify a working finished editor.
- Native Staff SQL conditionally uses complete-record create when present, retaining the earlier 33-contract fixture path when absent. Original33 and current41 fixtures execute locally.
- Native catalogue concurrency SQL now creates saved drafts, publishes exact revisions and restores history to draft. It preserves cross-writer timing/content token races, floor assertions, holder rollback and whole-state losing-writer checks. Added actual earned-Skill admission versus archive in both orderings and independent shared admission. Shell syntax and the real rollback snapshot SQL execute locally; **physical two-session schedules have not run here**.
- Actual admission error mappings cover character-slot creation, Supabase character creation/build/loadout repositories, saved loadout save/activation, Mastery trials, testkit and Players. Named `40001 COMBAT_CONTENT_ADMISSION_RETRY` reaches `STALE_VERSION`/HTTP409 through each tested real caller. Archived references return a specific invalid request. Existing earned grants/pins/XP/receipts are retained.
- Historical migration-isolation tests intentionally exercise their historical predecessor APIs. Frozen reviewed release recipes/assets are historical evidence, not current operational callers; they must not be rerun against the new schema without a separately reviewed saved-record publication adapter.

## Consumer contract at the Stage A freeze

Full Task10 independent-review BASE: `b83de822171d8f62726bd8b7a668a82d5d39b523`. It includes accepted Task9 fix5 and coordination, but no Content product source. Review all Stage A commits against that BASE, not the latest merge or `HEAD~1`.

The existing authoring POST accepts `{operation: "record", command: {...}}`. Commands have finite fields and reject supplied actor/body-publication extras. `read` and `list` return the selected-record/page contract. `create` and `duplicate` derive the new stable identity from kind plus request UUID. `save`, `restore`, `archive`, `link` and `unlink` take complete-record `expectedRevision`. `publish` takes the reviewed `expectedDraftVersion` and nullable `expectedBaseVersion`; the server reloads the saved draft, loads the current catalogue/global timing token, validates the prospective compatible catalogue and supplies the trusted floor. There is no browser `definition` in publication. Create-with-parent includes `parentKey` and `expectedParentRevision`; failure leaves neither orphan nor request receipt.

`CompleteCombatContentRecord` in `packages/db/src/combat-content.ts` is the producer shape. It contains identity/kind/lifecycle/revision/floor, nullable original creation attribution, nullable saved draft and current publication, three most recent immutable history entries, `links` (at most256), and `usedBy` (at most100) with `blocking` and `usedByTruncated`. Retained history outside the display window remains exact-readable through the existing version reader. Drafts expose update/restore attribution; versions expose separate publisher/author/restore attribution. A fresh restore resets an archived record's draft while leaving its lifecycle archived until successful publication. Historical `restoredFrom` alone grants no reopen authority.

Builtin metadata indexes the actual294 current identities (141 Skills including five reserved Basics,17 Essences,136 Resonances) and153 actual implicit E/R selections. The source-derived manifest and literal SQL manifest are checked against the executable catalogue. No mechanic body, publication/history, player grant or floor rollback is fabricated. A selected nonarchived metadata-only read hydrates `builtinDefinition` from its exact existing executable version. First save and publication use normal saved-record CAS/floor; current Owner publications win. An archived baseline has no hydrated definition. Basics remain stored kind `skill`, cannot be duplicated or archived, and retain ordinary exact pinned reads.

Used-by distinguishes actual four-table references, active links, live draft/current definition references and existing builtin selection consumers from nonblocking retained history. Archive checks the full dependency relation, not just100 displayed entries. Current implicit E/R selection returns a specific blocker until the actual selection is replaced; this is not a Stage B authored selection producer. Unlink can clean up archived relationships; adding a link to either archived endpoint remains denied. A self-referential fresh restore is permitted only under explicit restore intent; unrelated archived references remain denied.

The strict finite noncombat definition parser reuses actual Requirement/Ability/Tag validators. SQL independently bounds command/envelope/Requirement shape and reference traversal; it does not duplicate the full combat Ability semantic parser. Existing server catalogue validation remains the trusted publication boundary for the five current combat kinds. Recognized noncombat snapshot entries validate before deliberate combat-only projection; unknown kinds and malformed definitions fail closed. Item/Ascension/Severence publication has a specific missing-runtime blocker. Discipline/Tag publication is held for subsequent stages. No inventory, equipment, transformation, Core, AP or earned-progression mechanics are implemented here.

## Native and subsequent-stage handoff

Run the existing Database Foundation sequence on a disposable local Supabase/PostgreSQL stack with actual LZ4 migrations and the earlier Staff fixture's confirmed Owner setup. The complete Staff SQL remains in its existing gate. Run `.github/scripts/verify-combat-catalogue-concurrency.sh` last, as its comment requires: fixture history is deliberately retained until stack disposal. Its new cross-session admission schedules use the actual earned-Skill grant RPC and character locks; all four physical table guards are exercised by the actual-chain local suite. Do not present those earned-RPC schedules as four separate physical native races. Native output must establish immediate named40001, independent shared admission, archive ordering, and whole-state rollback; shell syntax/PGlite does not establish these physical properties.

Independent combined review and native execution remain open at this freeze. Latest parent-reported Task9 fix5 native DB gate is green on remote43ff3cad, but its quality/Browser/layout acceptance remains pending and N4 quality reliability is open. Stage B must refresh that producer disposition before use. Stages B/C/D remain held. The legacy editor still invokes retired endpoints, so this is not a deployable finished editor or full Task10 completion.


## I1 repair: explicit standalone-kind capability

Status bodies use the actual finite `CombatStatusDefinition`/`NamedCombatStatus` fields and current optional modules, validated with the existing combat validator at create/save, returned-record and current/prospective catalogue boundaries. The Status runtime `version` is not the publication `contentVersion`; neither is silently rewritten by this parser. Current unsupported Status forms fail closed; the unchanged exact history reader preserves historical bytes.

Effect Profile remains a legitimate stored/history kind with **no registered definition schema or runtime adapter**. New create/save/duplicate/restore/publication is blocked before write/publish RPC. A retained complete record has server-derived `authoringBlocker: {code: 'EFFECT_PROFILE_AUTHORING_UNSUPPORTED', message}`; a retained catalogue entry additionally has `runtimeSupported:false`. Its opaque definition is private inspection/history data, not a validated editable or executable form. Identity/version envelope checks do not confer semantic authority. Ordinary unrelated publication remains available and exact retained bytes are preserved. Later UI consumers must honor this blocker rather than imply the existing generic payload is an editable Effect Profile schema.
