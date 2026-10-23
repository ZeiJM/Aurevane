# Task10 Stage C handoff — 2026-10-22

Status: **DONE_WITH_CONCERNS** — implementation and focused source verification are ready for the single combined source review. This is not physical/native/browser/hosted acceptance. Stop Stage C product work here; no Stage D, Task11/12, deployment or hosted content mutation performed.

## Exact source

- Base: `a94204dce37bc585d2bc57a3712f4255c7f98e37` (documentation-only successor to accepted B).
- C1: `d62f77ad8d7c4b76206c96a2f6a53b82022f922f`, tree `c63f6b8399923fb1404edbf7a9554a55a6c72980` — contextual narration authority/controls.
- C2: `84118ad2f41757bb3063e185fa2710764415e25f`, tree `ec057b550cfb2f92614024d85946a2b2f390012d` — finalized immutable media and actual consumers.
- C3: `e9e6e0d01800de998cb275534ab610c4798a42d8`, tree `746c7fb1af4cef55c161d49b2d922d8dd370a288` — definition-bound contextual fields and current/exact Tag capture.
- Final C4: `a580fd7263ac253570440d488fcf08b98267ba6c`, tree `f1a3dcafd4629807657f0d2b27b016b66228c15f`; tracked working tree clean. Root confirmed main remains `a31029c04c0ef7be9fd08092c6a70f6f086b48b6` immediately before this freeze.
- No helper/reviewer agents were spawned. Root owns the one combined review, backups, all upstream/native/hosted actions and cumulative round4/5 review accounting.

## Actual text authority and producer/consumer contracts

`packages/game-core/src/combat/battle-narration.ts` remains the single interpolation authority. `battleTextReferenceChoices`, `battleTextContextIssues`, `abilityPresentationValues`, `abilityPresentationContext`, `abilityPresentationTextIssues` and `renderAbilityPresentationText` provide typed context and limits. Names/pronouns use explicit identity with neutral historical fallback. Supported references include User, Selected Target, Ability, singular/plural Affected Targets, triggering actor, finite configured public power/duration/tile/percentage/stack/application/resource values, and actual damage/healing outcomes where the concrete context supports them. Missing facts fail the template and retain the established fallback; no invented zero, damage estimate or private Accuracy reference.

Optional `presentation` fields are public (2000), compact (240), activation (160), result (160) characters on Mature Skill, Basic/auxiliary Skill, Resonance V1/V2 and summoned ability definitions; Essence uses its nested Skill. Definitions validate syntax and actual field context. Legacy flavorLine/battleText remain retained-compatible; new authoring rejects unavailable values/outcomes/trigger references in those original activation fields rather than claiming they have the new typed contexts. No mechanics, units, balance, admission or roster rules derive from prose.

`AbilityPresentationEditor` and the existing `BattleFlavorTemplateHelp` offer readable Insert Reference choices, field-specific sample contexts, singular/plural samples and plain guidance. The real existing Skill, Basic, Essence, Resonance and Summon editors use these controls. Result examples are explicitly illustrative. Registered media hooks and legacy narration remain intact.

Actual consumers:

- `SkillDetails` renders public text; `SkillParameters` renders compact text from the actual current/exact definition.
- `ResonanceParameters` renders optional public and compact text alongside its existing canonical/legacy report, preserving automatic/noncastable presentation.
- `projectBattleBasicActions` renders public/compact strings from the controlled owner's captured Basic definition; `battle-skill-command` displays these public strings with its captured mechanical report.
- `attachRecordedBattleLogSkillContext` reads exact Skill/Basic/Essence/Resonance/Summon definitions after viewer projection, extracts only the configured public values, and attaches presentation context. Chronicle activation renders the activation template; result rendering uses an actual visible damage/healing receipt and actual target identity. Periodic/trigger receipts without applicable context do not fabricate a result claim.
- Canonical command events carry engine-owned `triggeringActorId`. History projection removes that identity unless its command is actually visible in the same commit; log enrichment requires an available actor identity. This does not reveal hidden trigger commands.

## Canonical Tag presentation, current versus exact

`combat-tag-registry.ts` remains the finite canonical mechanics/handler registry. `CombatTagPresentationSnapshot` has exactly `contentKey`, `contentVersion`, `tagId`, `name`, `full`, `compact`. `captureCombatTagPresentation`, `combatTagPresentationIssues` and `bindCombatTagPresentations` validate canonical identity, positive exact version, plain bounded wording, unique entries and references without adding any execution handler. Authored Tag IDs are `tag.<existing payload identity>`; invented mechanics remain rejected.

Publishing a Tag **immediately changes the actual current catalogue/readers and newly admitted presentation** without republishing every Skill. `createCombatContentResolver` binds the current published Tag snapshot into matching canonical Ability payloads. `captureCurrentCatalogue` freezes one catalogue token and Tag set and applies that set to its admission current/exact resolver reads. The actual `captureBattleBuildAbilitySources` producer therefore freezes the same wording for both owners with the captured definitions. Publishing Tag wording changes the catalogue token, so stale prepublication tokens cannot admit/publish across the boundary.

Old admission captures remain byte-exact. Standalone exact Skill reads retain the Tag snapshot attached when that Skill version was published; a frozen admission resolver deliberately selects its own already-frozen Tag set, not a later live one. This distinction is tested with the actual producer, actual rendered Tag label, actual Basic capture and frozen exact reads. Current Tag publication does not rewrite physical Skill versions, old captures or mechanics/units.

`resolveCurrentTagPresentations` and `resolvePinnedTagPresentation` read the actual catalogue and physical version source. Exact reads verify both returned row identity/version and embedded identity/version. `/api/combat-tags` returns current public wording with `no-store`, or `?key=tag.damage&version=N` returns an exact immutable public version. The existing `AbilityDefinitionParameters`/`abilityBehaviorInformation`/`EffectTagLabel` render linked canonical labels with shared full/compact explanations and existing keyboard/focus/touch popover behavior. `projectBattleTagPresentations` exposes only controlled-owner captured labels, and the real battle page overlays those admitted snapshots on its exact display definitions.

## Finalized media contracts and actual boundary

`game-core/combat/content-media.ts` exports strict immutable image/audio descriptors, slot validators, truthful guidance, opaque artwork keys and fixed local route construction. No upload tickets, external URLs or labels stand in for finalized bytes.

Supported inputs: PNG/JPEG/WebP, a single image at most 4096×4096 and 2 MiB; server-oriented square crop normalized to PNG, final bytes at most 2 MiB. Audio is uncompressed PCM16 WAV only, mono/stereo at 44.1/48 kHz, nonempty and at most 10 seconds and 2 MiB. Compressed/other audio containers and container-level audio remain unavailable. `sharp` is pinned as a direct Web dependency at **0.35.5**, matching the existing resolved native dependency; `pnpm-lock.yaml` changes only that importer and its no-longer-optional dependency flags. Repository package manager remains `pnpm@11.17.0`; checks used `corepack pnpm`. A fresh frozen install on a clean native runner remains a final integration check.

`normalizeContentMedia` actually decodes image bytes with sharp, verifies declared MIME versus codec, applies EXIF orientation and a bounded whole-pixel crop, encodes delivered PNG bytes, and computes SHA256/length. The WAV parser checks actual RIFF/chunk/frame/header consistency and duration and normalizes one PCM header, removing ancillary chunks. No browser dimensions/hash or local preview is authoritative.

`handleContentMediaUpload` authenticates/capability-checks before consuming a bounded multipart body, permits exactly one file plus optional crop, normalizes bytes, then verifies the **entire** returned descriptor equals the normalized descriptor plus SQL-allocated UUID. A focused RED test established that accepting a changed channel count with matching hash/length was insufficient; the complete comparison is now GREEN.

Actual routes/store:

- `POST /api/master/combat-content/media`: authenticated actor and `content.combat.author`, actual normalized bytes to finalizer.
- `GET /api/master/combat-content/media`: staff-private latest 100 finalized descriptors for existing-asset selection.
- `GET /api/master/combat-content/media/[mediaId]`: private actual bytes, fresh selected-character authorization via existing `createSelectedCharacterRpc`/`loadSelectedCharacter`; image/audio GETs need no browser actor header.
- `GET /api/content-media/[mediaId]`: service-only SQL published reachability, actual bytes/hash/length verification, immutable public cache plus ETag/304, exact content type, nosniff and restrictive CSP. Unpublished-only media returns 404; corrupt/malformed storage fails closed. Private previews are `private, no-store`.
- `createContentMediaStore`: private server admin transport, bytea hex normalization and safe error mapping. Browser credentials have no RPC/table shortcut. Existing selected-actor inventory grows **41→43** for finalizer/private reader; public published reader does not take actor context.

`FinalizedMediaEditor` is a real PC file picker with decoded local square-crop canvas, crop coordinates, actual local/finalized audio elements, finalized image, upload failures, visible image/audio preview failures, replacement/removal and latest-asset selection. It resets the native file input immediately so the same file can be selected again. Its image-only mode rejects audio before uploading. Actual existing Skill/Basic/E/R and Summon editors use it through `SkillMediaEditor`. The reusable image-only contract and noncombat image slots are ready; Stage D owns adding other category shells, not an unsupported container-sound promise.

Actual artwork readers use opaque immutable UUID identity: current Character Skill cards, real battle Skill/Essence/Basic artwork, and the existing character/battle Resonance call sites. Runtime sound travels from exact definitions/captures into actual `combat_action_used`/`resonance_activated` events as `audioMedia`. Canonical restored commands, native Basic paths and summon legacy execution preserve that identity. `selectBattleAudioCues` consumes the finalized descriptor through the existing recent/version/replay cursor and priority rules. `AudioProvider` maps only the validated local UUID key into the existing AudioDirector, preserving volume/mute/unlock/concurrency behavior.

## SQL migration inventory

`20261022214821_finalized_combat_content_media.sql`:

- Private immutable `app_private.combat_content_media` (UUID, descriptor, bytes, uploader/time) and `combat_content_media_versions` physical-version references; RLS and direct table privileges denied to anon/authenticated/service_role.
- Public service-only `finalize_combat_content_media_v1(uuid,uuid,bytea,jsonb)`, `read_combat_content_media_v1(uuid,uuid,uuid)`, `read_published_combat_content_media_v1(uuid)`.
- Finalizer invokes actual selected-actor Master authority, checks normalized PNG structure/dimensions/crop bounds or canonical PCM WAV headers/frame duration, recomputes checksum/size and allocates identity. Deep image codec decoding belongs to the authorized server normalizer; SQL does not pretend to decode a PNG codec.
- Private helpers `content_media_immutable_v1()`, `media_u32_v1(bytea,integer,boolean)`, `content_media_references_v1(jsonb,integer)`, `guard_content_media_references_v1()`, `index_content_media_versions_v1()`, all direct execution revoked.
- Draft/version BEFORE triggers recursively require exact stored descriptor and supported slot/kind; finalized media/version-reference UPDATE/DELETE blocked. Version AFTER trigger indexes every referenced asset. Audio applies only to Skill/Essence/Resonance families, including nested auxiliary definitions; other categories support image slots only.
- Reachability uses any physical published version, not the current-plus-two display window. Replacement/removal and deeper history retain exact old bytes. This deliberately retains finalized private bytes indefinitely; no unimplemented garbage-collection claim.

`20261022221218_canonical_tag_presentation.sql`:

- Private `content_tag_snapshot_v1(jsonb)`, `bind_content_tag_presentation_v1(jsonb,boolean,integer)`, `validate_content_tag_presentation_v1()`, all direct execution revoked.
- Actual draft/version triggers validate canonical Tag identity/plaintext bounds and every exact embedded Tag snapshot against its physical Tag version. Version INSERT binds current published matching Tag wording under the existing publication/catalogue lock.
- Existing `publish_saved_combat_content_v1` is patched with an exact predecessor guard to enable Tag presentation only; item/Ascension/Severence publication blockers remain. Existing record/draft/base CAS, attribution, lifecycle and admission lock authority are retained.

`.github/scripts/verify-master-panel-staff-authority.sql` now conditionally checks the actual 43 selected-actor inventory, new media selected/revoked/missing actor denial forms, five media helpers, three Tag helpers and both private media tables, preserving prior 41 inventory/denials. No broad native fixture repair or assertion relaxation.

## Public privacy

The established shared `projectPublicCombat` boundary still runs **after** final battle-envelope composition. Newly composed captured Tag rows and media/text envelopes go through that boundary; private object-valued Accuracy/aliases do not become references or presentation numeric values. Numeric ordinary public combat stats remain public. New composed projection tests include controlled versus opponent/spectator Tag ownership and nested private authoring keys. Actual history tests cover hidden triggering identity and cross-commit refusal. Canonical behavior metadata and capture/source internals remain private.

## Verification evidence and disposition

All raw logs and failed attempts are retained under `docs/verification/task-10-reconstruction/*.log.gz`, with exact argv/cwd/timestamps/exit/SHA256 appended to `verification.jsonl`. Earlier evidence is not rewritten; C4 checked the byte-exact 240813-byte previous ledger prefix and all 23 appended raw hashes. Initial RED failures, fixture-shape corrections, SQL syntax fixes, optional-chain type correction and zero-warning lint fixes remain in the ledger. Counts below overlap and must not be summed.

Latest focused final checks:

| Evidence | Command/result |
| --- | --- |
| `c-final-web-covering` | `corepack pnpm --filter @aurevane/web exec vitest run` with the 13 exact files listed in ledger; **273/13 PASS**. Media bytes/handler/real routes, current/exact Tags, actual admission, composed privacy, Resonance reader, Basic command, artwork/audio. |
| `c-final-tag-sql` | `corepack pnpm --filter @aurevane/db exec vitest run src/combat-content-media.test.ts`; **10 PASS** against all real migrations in PGlite with documented platform shims and storage-only LZ4→pglz. Actual finalization/save/publication/exact/deep history, unauthorized/forged descriptors, Tag publication/stale token/forged exact snapshot/helper ACL. |
| `c-final-captured-audio-fixed` | `corepack pnpm --filter @aurevane/game-core exec vitest run src/combat/combat-behavior-capture.test.ts`; **11 PASS**, including exact restored capture→actual command audioMedia and immutable capture. |
| C3 covering | `c-text-tag-core-covering`: **209/10 PASS**; `c-tag-admission-fixture-fixed`: **17/2 PASS**. Actual references/context binding, canonical registry/capture and producer admission. C2 core **140/7**, SQL **43**, Web reader **42/6** retained; superseded tests are not counted twice. |
| Types | `c-final-types-fixed`: `corepack pnpm --filter @aurevane/game-core --filter @aurevane/db --filter @aurevane/web typecheck`; all three PASS. |
| Lint | `c-final-lint-fixed-web`, `...game-core`, `...db`: touched files, `eslint --max-warnings=0`, PASS. |
| Format/diff | `c-final-format`: all C changed TS/TSX/JSON/CSS, Prettier PASS. `c-final-diff-check`: PASS. |
| Browser preparation only | `c-browser-discovery`: exact command below with `--list`, **1 test discovered**. No browser run occurred. |

Focused browser execution command for root/native integration:

```sh
corepack pnpm --filter @aurevane/web exec playwright test --config=playwright.config.ts --project=desktop-chromium --grep 'finalized media controls'
```

This independent local-only scenario is in `apps/web/e2e/master-combat-content-authoring.pw.ts`. It provisions a disposable account, grants/revokes local Owner, uses the actual Basic editor/file controls, checks canvas pixels and delivered normalized pixels, same-file replacement/new crop/hash, unpublished public 404, actual local/finalized WAV duration, and visible failed image/audio previews. It avoids the older retired-publication test. Only test discovery and TypeScript/lint were executed here; no assertion is claimed as a browser pass.

### Exact remaining gates / concerns

1. **Physical PostgreSQL C media/Tag lifecycle not executed.** Native DB CI resets/apply migrations and executes the extended Staff ACL/actor script, but the ten actual lifecycle assertions currently live in the PGlite test, not a newly wired native lifecycle script. Migration application is not execution of those lifecycle assertions. Root explicitly deferred new native harness work to final integration.
2. **Actual browser/media decode/playback/visual checks pending.** The independent scenario above is prepared, discovered and typed; real browser output, production sharp native codec packaging, actual AudioDirector sound and cross-browser layout remain native integration gates. Editor failure handlers and same-file reset are implemented, not passed browser claims.
3. **Final hosted current/exact compatibility and clean frozen install/build pending.** Root's pre-C hosted 294-current/141-exact snapshot is prior evidence; it does not validate this final C source. No hosted mutations or deployment performed.
4. **Stage D owns remaining category shell/Tag Library/search/used-by and full Parameters/Text/Media/History arrangement.** C supplies supported current/exact Tag publication/readers, reusable controls and applicable existing editors, not a claim that the full requested operator shell is finished. Container audio remains unavailable. Source review may identify C contract defects; no final Master acceptance inferred.
5. **Previously classified B native/UI/quality failures remain open for Task13/D as assigned by root.** P34 retention expectation, captured-startup skeletal fixtures, Chronist preactivation fixture, old roster wording/Manual mock, retired browser publisher, actual Nexus narrow-card overflow. C did not fix them or loosen product authority. Stage A physical pointer-metadata limitation remains Task13.

Implementation stops for the same combined source reviewer after this freeze. There were no remote/hosted writes by the implementer and no reset of cumulative review accounting.


---

# Task10 cumulative repair round5 — 2026-10-22

Status: **DONE_WITH_CONCERNS** — Important I1/I2/I3 are repaired and the scoped source checks pass. Await the same combined reviewer's scoped re-review. This is the fifth cumulative Task10 repair round, not a new counter for C. No helper/reviewer/subagent was spawned; no Stage D/11/12/13 product work or native/hosted/upstream operation was performed by this implementer.

## Source and freshness

- FixBASE: `a580fd7263ac253570440d488fcf08b98267ba6c`, tree `f1a3dcafd4629807657f0d2b27b016b66228c15f`.
- Verified repair source/evidence commit: `00b2b80dafd3a68dc281d7c2a41106c7e2e53cb1`, tree `762cfd698f23cbd834cffdc812969e5fe191015a`. The commit adding this appended report is documentation-only; final HEAD/tree are returned to root in the handoff.
- Root refreshed current main for preflight and finalization and confirmed `a31029c04c0ef7be9fd08092c6a70f6f086b48b6` unchanged through PR972 metadata. No merge/reconciliation was required. The Git deployment lock in `apps/web/vercel.json` remains unchanged.
- The original C report was ignored/untracked locally at FixBASE. Its full **19,632-byte** prefix, SHA256 `2cf8a4b6fab3376573e3df78365e38894401be58e41c88f57b1f39cde24f90bb`, is preserved byte-for-byte above and is now force-added for durability. Root had independently preserved it as `docs/verification/task-10-reconstruction/stage-c-handoff-20261022.md` in coordinator commit `5c8d71ecced024ad44c8caab36d90a1edff8f829`. The existing tracked progress prefix and root's pre-existing coordination append are retained.

## Repairs and actual interfaces

**I1 — Retained Tag envelopes and correction.** `parseNoncombatContentDefinition` and `parseRetainedNoncombatContentDefinition` retain the original finite Tag draft shape: stable record identity independent of `tagId`, descriptions through 4000 characters, and implemented-registry membership. The existing native-failing `round-trips finite tag drafts independently and returns a specific runtime blocker` assertion is preserved and passes. New `assertTagPublicationReady` applies the unchanged canonical snapshot validator at the category's publication boundary; the category's published parser explicitly retains canonical identity/text and row/version matching. `captureCombatTagPresentation` and its six-field snapshot constraints are unchanged. The actual complete-record read/save path can therefore obtain and correct a retained draft; it cannot publish a long/noncanonical snapshot. A legacy UUID-keyed draft can supply corrected wording to a new canonical create while its original row and identity remain retained.

The additive migration **`20261022225712_retained_tag_draft_envelopes.sql`**, generated with the pinned `supabase migration new` CLI, changes only the existing `app_private.validate_content_tag_presentation_v1()` body. Every draft write still rejects unimplemented handlers and uses the existing complete-record envelope validation. Canonical ID and compact/plain presentation restrictions apply to `combat_content_versions`; old draft writes keep their original envelope. Both installed triggers, empty search path, security-definer posture, private EXECUTE ACLs, media binding and immutable publication semantics are retained. No new table, public RPC, function signature, grant, actor overload or authority is added. All original migrations remain untouched. A temporary untracked filename `20261022225330_retained_tag_draft_envelopes.sql` was replaced by the CLI-generated identity before final verification/commit.

**I2 — Actual canonical Tag producer.** The real `createCombatContentRecordCommand` derives `tag.<validated tagId>` for Tag creation, overwriting the supplied record ID just as the command already owns other identities. The request UUID remains an independent operation key passed unchanged to the existing store and SQL transaction. Thus the existing capability check, selected character, request fingerprint, receipt replay, identity conflict and save/publication CAS still govern the operation. A duplicate command for a Tag returns a specific unsupported message: create or edit the canonical Tag; new mechanics require an implemented handler. No arbitrary registry entry or handler is invented.

The new `combat-content-tag-lifecycle.test.ts` invokes the real HTTP handler, service, command, selected-character transport, RPC store, SQL functions and current/exact `/api/combat-tags` reader. Only platform session/admin transport is replaced; RPC bodies execute the full production migration chain in PGlite. It proves canonical creation, original receipt replay before and after publication, one-record identity/request conflicts, stale save/publication rejection, current wording after a second publication and unchanged exact prior wording. It also proves missing selection/revoked live capability rejection (including replay), explicit duplicate denial, and retained predecessor drafts read/save/correction/canonical bootstrap without dropping old rows. The shared test-only database fixture was extracted from the existing media suite so both suites use the same migration/platform setup; existing media assertions remain intact. As before, PGlite substitutes only unavailable platform scheduling and storage-only LZ4 with pglz. This is not physical concurrency or hosted acceptance evidence.

**I3 — Typed Barrier values.** `abilityPresentationValues` exposes a supported `maximum-hp-percent` Barrier amount as `percentage`, and an omitted-basis relative-power Barrier as `power`. The controls first validate real supported payloads, then assert extraction, Insert Reference choices, accepted rendering and rejection/unavailability of the opposite unit. No Barrier mechanic, scale, balance, unit conversion or outcome changes were made. Prose remains presentation-only.

**Root-authorized native diagnostic supplement.** Four additive lines in `browser-simple-requirements-regression.mjs` retain the already-collected per-viewport page/console errors outside the loop, print them in the existing failure catch, and add them to `failure.json`. Assertions, waits, timeouts, case flow and fixture behavior are unchanged. Only syntax/lint/format were checked locally; no browser launch was attempted.

## Verification and complete failed-attempt disposition

Latest covering results are **55 core tests / 5 files**, **33 web tests / 4 files**, and **13 database tests / 1 file**. Counts from repeated runs overlap. Game-core/db/web types, affected per-package zero-warning lint, formatting, `git diff --check` and native-diagnostic syntax pass. Corepack reports the repository pin **pnpm11.17.0**; dependencies and lockfile were not changed or re-resolved. No package-wide suite, `pnpm check`, broad browser test, timeout extension or assertion/warning suppression was used.

All command logs, including failed attempts, are immutable gzip files. The exact cwd for every row is `/workspace/scratch/e5db2ba73c1a/aurevane-master-complete-20261022`; `--dir` in the commands selects package execution. Exact argv, UTC start/end, exit, path and SHA256 are appended in `docs/verification/task-10-reconstruction/verification.jsonl`.

- `core-red` reproduced I1/I3 but also had two mistaken reference-picker expectations including braces in `choice.token`; corrected before the fix in `core-red-corrected`. The final Barrier RED uses only registered valid payloads (omitted basis is relative power; there is no explicit `power` basis) and fails solely on percentage extraction. No prior assertion was removed.
- `web-red` failed the real canonical producer and retained reads as expected. `sql-red` independently failed on draft text/ID restrictions before the migration repair.
- First `web-green` reached exact reads but failed because the test transport returned PGlite Date objects where PostgREST supplies JSON timestamp strings. JSON serialization at the test transport corrected that mismatch; production readers were not relaxed.
- First `sql-green` caught an overly broad initial movement of the trigger checks, which allowed an invented handler. Registry membership was restored for every draft/version write; the existing negative assertion is unchanged and now passes. The final migration only separates retained envelopes from canonical publication constraints.
- `types` found the test transport's unannotated query row type; a `Record<string, unknown>` query result annotation fixed it. `lint` incorrectly used the root config for web files and failed on five ignored-file warnings; the final scoped web invocation uses its own existing config. No ignore flag or warning suppression was added.
- `integrity` assumed the original C report was tracked at FixBASE and failed on that missing Git blob, after ledger/log checks. Root confirmed the report was intentionally untracked. `integrity-corrected` checks its saved original byte prefix instead and succeeds. The failed command remains recorded.
- Inherited Vite M2 appears unchanged in web logs and remains unsuppressed. Supabase markdown pages were unsupported by the web reader; current changelog/function guidance was fetched by curl, with the documentation MCP also consulted. No relevant function/trigger API change requires a redesign. No hosted advisor result is claimed.

The corrected integrity receipt verifies the original **260,837-byte** ledger prefix (SHA256 `59a55125739a1ea1108571eb8eabbc8b6c9cfb78c4fb4fa95c79d996cf75f123`), all **323** prior compressed logs byte-identical, and all **24** prior fix5 rows/hashes plus decompression. The succeeding integrity receipt is row25; its hash and all25 rows were checked again before this report commit.

### Exact observed commands and outputs

**`c-fix5-core-red.log.gz` — exit 1; 6 failed | 33 passed (39)**

```sh
corepack pnpm --dir packages/game-core exec vitest run src/content/authored-content.test.ts src/combat/battle-narration.test.ts
```

**`c-fix5-core-red-corrected.log.gz` — exit 1; 4 failed | 35 passed (39)**

```sh
corepack pnpm --dir packages/game-core exec vitest run src/content/authored-content.test.ts src/combat/battle-narration.test.ts
```

**`c-fix5-web-red.log.gz` — exit 1; 8 failed | 23 passed (31)**

```sh
corepack pnpm --dir apps/web exec vitest run src/server/combat/combat-content-categories.test.ts src/server/master/combat-content-record-command.test.ts src/server/master/combat-content-tag-lifecycle.test.ts
```

**`c-fix5-barrier-valid-payload-red.log.gz` — exit 1; 1 failed | 5 passed (6)**

```sh
corepack pnpm --dir packages/game-core exec vitest run src/combat/battle-narration.test.ts
```

**`c-fix5-sql-red.log.gz` — exit 1; 2 failed | 11 passed (13)**

```sh
corepack pnpm --dir packages/db exec vitest run src/combat-content-media.test.ts
```

**`c-fix5-core-green.log.gz` — exit 0; 55 passed (55)**

```sh
corepack pnpm --dir packages/game-core exec vitest run src/content/authored-content.test.ts src/combat/battle-narration.test.ts src/combat/combat-tag-presentation.test.ts src/combat/ability-presentation-text.test.ts src/combat/battle-contextual-references.test.ts
```

**`c-fix5-web-green.log.gz` — exit 1; 1 failed | 32 passed (33)**

```sh
corepack pnpm --dir apps/web exec vitest run src/server/combat/combat-content-categories.test.ts src/server/master/combat-content-record-command.test.ts src/server/master/combat-content-tag-lifecycle.test.ts src/server/combat/combat-tag-presentation.test.tsx
```

**`c-fix5-sql-green.log.gz` — exit 1; 1 failed | 12 passed (13)**

```sh
corepack pnpm --dir packages/db exec vitest run src/combat-content-media.test.ts
```

**`c-fix5-sql-green-registry-preserved.log.gz` — exit 0; 13 passed (13)**

```sh
corepack pnpm --dir packages/db exec vitest run src/combat-content-media.test.ts
```

**`c-fix5-web-green-wire-corrected.log.gz` — exit 0; 33 passed (33)**

```sh
corepack pnpm --dir apps/web exec vitest run src/server/combat/combat-content-categories.test.ts src/server/master/combat-content-record-command.test.ts src/server/master/combat-content-tag-lifecycle.test.ts src/server/combat/combat-tag-presentation.test.tsx
```

**`c-fix5-format-write.log.gz` — exit 0; Passed (exit 0).**

```sh
corepack pnpm exec prettier --write apps/web/scripts/browser-simple-requirements-regression.mjs apps/web/src/server/combat/combat-content-categories.test.ts apps/web/src/server/combat/combat-content-categories.ts apps/web/src/server/master/combat-content-record-command.ts apps/web/src/server/master/combat-content-tag-lifecycle.test.ts packages/db/src/combat-content-media.test.ts packages/db/src/test-support/combat-content-test-database.ts packages/game-core/src/combat/battle-narration.test.ts packages/game-core/src/combat/battle-narration.ts packages/game-core/src/content/authored-content.test.ts packages/game-core/src/content/authored-content.ts
```

**`c-fix5-diagnostic-syntax.log.gz` — exit 0; Passed (exit 0).**

```sh
node --check apps/web/scripts/browser-simple-requirements-regression.mjs
```

**`c-fix5-lint.log.gz` — exit 1; Failed: five web paths ignored by root config; corrected per-package invocation.**

```sh
corepack pnpm exec eslint --max-warnings=0 apps/web/scripts/browser-simple-requirements-regression.mjs apps/web/src/server/combat/combat-content-categories.test.ts apps/web/src/server/combat/combat-content-categories.ts apps/web/src/server/master/combat-content-record-command.ts apps/web/src/server/master/combat-content-tag-lifecycle.test.ts packages/db/src/combat-content-media.test.ts packages/db/src/test-support/combat-content-test-database.ts packages/game-core/src/combat/battle-narration.test.ts packages/game-core/src/combat/battle-narration.ts packages/game-core/src/content/authored-content.test.ts packages/game-core/src/content/authored-content.ts
```

**`c-fix5-types.log.gz` — exit 2; Failed TS2339 in test transport; corrected typed query.**

```sh
corepack pnpm --filter @aurevane/game-core --filter @aurevane/db --filter @aurevane/web typecheck
```

**`c-fix5-lint-web.log.gz` — exit 0; Passed (exit 0).**

```sh
corepack pnpm --dir apps/web exec eslint --max-warnings=0 scripts/browser-simple-requirements-regression.mjs src/server/combat/combat-content-categories.test.ts src/server/combat/combat-content-categories.ts src/server/master/combat-content-record-command.ts src/server/master/combat-content-tag-lifecycle.test.ts
```

**`c-fix5-lint-core-db.log.gz` — exit 0; Passed (exit 0).**

```sh
corepack pnpm exec eslint --max-warnings=0 packages/db/src/combat-content-media.test.ts packages/db/src/test-support/combat-content-test-database.ts packages/game-core/src/combat/battle-narration.test.ts packages/game-core/src/combat/battle-narration.ts packages/game-core/src/content/authored-content.test.ts packages/game-core/src/content/authored-content.ts
```

**`c-fix5-types-corrected.log.gz` — exit 0; Passed (exit 0).**

```sh
corepack pnpm --filter @aurevane/game-core --filter @aurevane/db --filter @aurevane/web typecheck
```

**`c-fix5-migration-new.log.gz` — exit 0; Passed (exit 0).**

```sh
corepack pnpm exec supabase migration new retained_tag_draft_envelopes
```

**`c-fix5-format-check.log.gz` — exit 0; All matched files use Prettier code style.**

```sh
corepack pnpm exec prettier --check apps/web/scripts/browser-simple-requirements-regression.mjs apps/web/src/server/combat/combat-content-categories.test.ts apps/web/src/server/combat/combat-content-categories.ts apps/web/src/server/master/combat-content-record-command.ts apps/web/src/server/master/combat-content-tag-lifecycle.test.ts packages/db/src/combat-content-media.test.ts packages/db/src/test-support/combat-content-test-database.ts packages/game-core/src/combat/battle-narration.test.ts packages/game-core/src/combat/battle-narration.ts packages/game-core/src/content/authored-content.test.ts packages/game-core/src/content/authored-content.ts
```

**`c-fix5-sql-final.log.gz` — exit 0; 13 passed (13)**

```sh
corepack pnpm --dir packages/db exec vitest run src/combat-content-media.test.ts
```

**`c-fix5-web-final.log.gz` — exit 0; 33 passed (33)**

```sh
corepack pnpm --dir apps/web exec vitest run src/server/combat/combat-content-categories.test.ts src/server/master/combat-content-record-command.test.ts src/server/master/combat-content-tag-lifecycle.test.ts src/server/combat/combat-tag-presentation.test.tsx
```

**`c-fix5-pnpm-pin.log.gz` — exit 0; Passed (exit 0).**

```sh
corepack pnpm --version
```

**`c-fix5-diff-check.log.gz` — exit 0; Passed (exit 0).**

```sh
git diff --check
```

**`c-fix5-integrity.log.gz` — exit 1; Failed: original C report is not a FixBASE Git blob.**

```sh
python -c 'import pathlib,subprocess,json,hashlib,gzip
base='"'"'a580fd7263ac253570440d488fcf08b98267ba6c'"'"'
ledger=pathlib.Path('"'"'docs/verification/task-10-reconstruction/verification.jsonl'"'"')
prior=subprocess.check_output(['"'"'git'"'"','"'"'show'"'"',base+'"'"':'"'"'+str(ledger)])
current=ledger.read_bytes()
assert current.startswith(prior), '"'"'Original ledger prefix changed'"'"'
immutable=0
for raw in subprocess.check_output(['"'"'git'"'"','"'"'ls-tree'"'"','"'"'-r'"'"','"'"'--name-only'"'"',base,'"'"'docs/verification/task-10-reconstruction'"'"']).decode().splitlines():
    if raw.endswith('"'"'.log.gz'"'"'):
        assert pathlib.Path(raw).read_bytes()==subprocess.check_output(['"'"'git'"'"','"'"'show'"'"',base+'"'"':'"'"'+raw]), raw
        immutable+=1
rows=[json.loads(line) for line in current[len(prior):].splitlines()]
for row in rows:
    path=pathlib.Path(row['"'"'rawLog'"'"'])
    assert hashlib.sha256(path.read_bytes()).hexdigest()==row['"'"'sha256'"'"'], str(path)
    gzip.decompress(path.read_bytes())
for path in ['"'"'.superpowers/sdd/2026-10-10-unified-engine-recovery/task-10-c-report.md'"'"','"'"'.superpowers/sdd/2026-10-10-unified-engine-recovery/progress.md'"'"']:
    before=subprocess.check_output(['"'"'git'"'"','"'"'show'"'"',base+'"'"':'"'"'+path])
    assert pathlib.Path(path).read_bytes().startswith(before), path
print(json.dumps({'"'"'base'"'"':base,'"'"'prefixBytes'"'"':len(prior),'"'"'prefixSha256'"'"':hashlib.sha256(prior).hexdigest(),'"'"'unchangedPriorCompressedLogs'"'"':immutable,'"'"'verifiedNewRows'"'"':len(rows),'"'"'verifiedNewLogExits'"'"':[row['"'"'exit'"'"'] for row in rows],'"'"'priorReportAndProgressPrefixes'"'"':'"'"'unchanged'"'"'}))
'
```

**`c-fix5-integrity-corrected.log.gz` — exit 0; Prefix/log integrity succeeded.**

```sh
python -c 'import pathlib,subprocess,json,hashlib,gzip
base='"'"'a580fd7263ac253570440d488fcf08b98267ba6c'"'"'
ledger=pathlib.Path('"'"'docs/verification/task-10-reconstruction/verification.jsonl'"'"')
prior=subprocess.check_output(['"'"'git'"'"','"'"'show'"'"',base+'"'"':'"'"'+str(ledger)])
current=ledger.read_bytes()
assert current.startswith(prior), '"'"'Original ledger prefix changed'"'"'
immutable=0
for raw in subprocess.check_output(['"'"'git'"'"','"'"'ls-tree'"'"','"'"'-r'"'"','"'"'--name-only'"'"',base,'"'"'docs/verification/task-10-reconstruction'"'"']).decode().splitlines():
    if raw.endswith('"'"'.log.gz'"'"'):
        assert pathlib.Path(raw).read_bytes()==subprocess.check_output(['"'"'git'"'"','"'"'show'"'"',base+'"'"':'"'"'+raw]), raw
        immutable+=1
rows=[json.loads(line) for line in current[len(prior):].splitlines()]
for row in rows:
    path=pathlib.Path(row['"'"'rawLog'"'"'])
    assert hashlib.sha256(path.read_bytes()).hexdigest()==row['"'"'sha256'"'"'], str(path)
    gzip.decompress(path.read_bytes())
report=pathlib.Path('"'"'/tmp/task10-fix5-original-c-report.md'"'"').read_bytes()
assert pathlib.Path('"'"'.superpowers/sdd/2026-10-10-unified-engine-recovery/task-10-c-report.md'"'"').read_bytes().startswith(report)
path='"'"'.superpowers/sdd/2026-10-10-unified-engine-recovery/progress.md'"'"'
assert pathlib.Path(path).read_bytes().startswith(subprocess.check_output(['"'"'git'"'"','"'"'show'"'"',base+'"'"':'"'"'+path]))
print(json.dumps({'"'"'base'"'"':base,'"'"'prefixBytes'"'"':len(prior),'"'"'prefixSha256'"'"':hashlib.sha256(prior).hexdigest(),'"'"'unchangedPriorCompressedLogs'"'"':immutable,'"'"'verifiedNewRows'"'"':len(rows),'"'"'originalCReportBytes'"'"':len(report),'"'"'originalCReportSha256'"'"':hashlib.sha256(report).hexdigest(),'"'"'reportAndProgressPrefixes'"'"':'"'"'unchanged'"'"'}))
'
```

## Pending acceptance and stop boundary

- Same-seat scoped re-review of I1/I2/I3 remains required. The source status is not review acceptance.
- Native quality job120129353276 previously corroborated I1 with5507pass/1fail; it has not been rerun here. C Database foundation120129353597 passed the predecessor migration chain, not this new migration. Root must run the updated exact-head physical migration/43actor/privateACL/Players/Event/lock chain and applicable native gates.
- The standalone simple-Requirements native bootstrap timeout remains unresolved and required; no source cause or pass is invented. The four-line diagnostic supplement only makes a future failure actionable.
- M1 HP percentage-recovery actual-healing reference remains explicitly deferred to Stage D/final integration per root ruling. M2 remains unsuppressed.
- Existing deeper native/media/browser/hosted and Stage D acceptance obligations in the original report remain open. No live catalogue publication, hosted migration, deployment, source push/merge or stage advancement occurred in this repair dispatch.

Implementation stops for the same combined reviewer's scoped re-review after the documentation-only report commit.
