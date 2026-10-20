# Stage A content authority and caller inventory — reconstruction checkpoint

The accepted Task 8 actor contract and Task 9 backend handoff remain binding. The current physical inventory is **original 33 + Players 4 + Content 4 = 41** explicit actor signatures, including private assertion overloads. The all-migration PGlite fixture executes the actual native Staff verification SQL and checks this inventory; native PostgreSQL execution of these new changes is still pending.

## New service-only actor operations

Every operation first calls `app_private.assert_master_panel_operator_v1(p_actor_user_id,p_actor_character_id)`, which selects the existing live `content.combat.author` capability. The Owner account bootstrap remains the existing exception. The browser cannot supply authority: `createSelectedCharacterRpc` reloads the authenticated account and current selection and replaces `p_actor_character_id`. Both anon and authenticated lack execute; the fixture also attempts actual authenticated calls.

| Exact public signature | Contract |
| --- | --- |
| `read_combat_content_record_v1(uuid,uuid,text)` | Complete stored identity, lifecycle, revision, draft, current, last three immutable versions, attribution, links and Used-by |
| `list_combat_content_records_v1(uuid,uuid,text,text,text,text,integer)` | Kind/lifecycle/search/keyset filters, 1–100 records |
| `write_combat_content_record_v1(uuid,uuid,text,jsonb)` | Create/duplicate/save/restore/archive/link/unlink under full-record CAS; request-key retries for create/duplicate/link/unlink |
| `publish_saved_combat_content_v1(uuid,uuid,text,bigint,integer,text,integer)` | Saved draft revision + current base + catalogue token + trusted version floor; no submitted definition |

The complete actual actor inventory is asserted by `.github/scripts/verify-master-panel-staff-authority.sql`. Private record/validation/admission helpers have no service-role execute grant. The private state tables have no direct service write authority.

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

Stage A remains open for deeper strictness, attribution/builtin/dependency boundary work and native/independent review. Stage B is not unlocked by this checkpoint.
