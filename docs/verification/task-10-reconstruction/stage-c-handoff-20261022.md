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
