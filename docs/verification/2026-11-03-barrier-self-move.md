# November 3 combat, editor, media and support corrections

**Release status: LIVE for Owner testing through PR #1008.** See the [combined release receipt](2026-11-03-combat-items-release.md) and [complete checklist](2026-11-03-owner-combat-items-checklist.md). The following status and local results are historical implementation checkpoints.

Historical status: implemented, independently reviewed and locally verified on `agent/barrier-damage-triggers`, based on main `b8f6b68c86a3ada7c86c7aa95f60db9b89d4b54b`. PR #1006 is already live; this follow-up is not deployed. No hosted data mutation, applied migration, content republication or application deployment is included. A source-only additive image-finalizer migration is included for the eventual coordinated release.

## Owner requirements

- Positive damage absorbed by Barrier counts for damage-event activation even with zero HP loss. Count each packet once, including partial absorption. Preserve real HP loss, damage history, costs and trigger-chain guards.
- Damaging highlights use the same bright red on the caster and other targets. Remove blended parent shadows without changing terrain, portraits or identity rings. Audit other offered target choices against shared validation.
- Authored Self damage must be selectable and executable, including safe lethal settlement; Anyone must not silently omit the caster. Preserve historical captures.
- Move-only abilities, including Fleetstep, expose elevation and visibility under Range & Area in the shared editors. Their captured settings must govern highlights, quotes and execution, and survive refresh. Move remains Ground movement.

- Once per action permits one use in the entire battle even without cooldown; the cockpit disables that captured action afterward. Once per round permits one use each global round. Both unticked permits fresh uses subject to costs, Requirements and cooldown, including free offensive Move and Controlled actions. Keep historical root-action semantics in older snapshots.
- Automatically compress/downscale valid artwork whose finalized PNG exceeds 2 MiB. Keep original source/crop metadata accurate and let upload complete so Commit Now can save it.
- Chronicle must use the exact captured Summon skill name (Moon Bolt), without humanizing the synthetic ID as “Summon Vesper Moon Bolt.”
- Skill Manager and Arsenal must use current saved support artwork, matching battle. Summon rings/arrows must match their owners even with identical unit names.
- Replace awkward Pilfer artwork and improve Invocation's summoning sigil.

## Design and verification map

- New encounters opt in separately to Barrier damage-event and Self-damage policies. Historical absent-policy captures retain their original mechanics. Move elevation and visibility are optional captured Move fields: omission preserves ordinary Jump/no-LOS behavior; an authored elevation 0–3 replaces Jump only for that Move. LOS requires sight from the original position to every entered tile. Terrain, occupancy, Root, movement caps, payment and command authority remain enforced.
- Focused engine tests cover full/partial/no absorption, zero packets, native/canonical boundaries, ally/dealt/Barrier triggers, periodic settlement, reload, historical policy absence, Self/Anyone execution and lethal turn cleanup. Move tests cover a raised destination and an opaque-wall detour with visibility on/off.
- Shared editor checks cover enabled Self Damage, every ordinary selectable tag target's payload validity, actual Skill/Resonance Range & Area controls and captured Move metadata. Client walking reach and public projections carry the same authored settings; AI candidate generation uses the canonical walking quote.
- Production-component browser coverage retains targeting/Ground/Requirements assertions, adds actual Move controls and Self target roundtrips, and checks computed parent shadows as well as overlay colour across desktop/mobile PvE/PvP. Browser count wrappers must match the expanded matrices.
- Final gate: formatting, lint, all package types, full tests and production build (`pnpm check`), then fresh-main reconciliation, source review and required exact-head CI. Local disposable authenticated database/browser publication is unavailable unless separately established. Public fixture execution does not prove hosted signed-in gameplay or device/multiplayer acceptance.

- `abilityUsageLimitPolicyVersion: 1` is pinned at new balanced encounter creation. A single persisted usage helper drives server admission, Controlled preparation and owner-visible cockpit availability. Round reset uses the battle's global round. Older snapshots retain their existing root-action limits and implicit Basic Move/Controlled bounds. Usage hint projection exposes no private command ledger to opponents or spectators. Current reports explain Once per action as Once per battle; historical reports keep the old wording.
- Final media stays PNG: lossless compression first, then bounded aspect-preserving square downscaling only when needed. Original crop remains in original source coordinates. Shared descriptor validation and migration `20261103060943_automatically_fit_finalized_content_images.sql` accept output size no larger than the source crop, retaining 2 MiB, 4096-pixel, authority, checksum and actual-byte checks. No hosted migration has been applied.
- Chronicle resolves visible Invocation spawn profiles from the exact frozen Basic capture by owner/action/version. It never replaces captured names with today's catalogue and does not enrich hidden/ambiguous/mismatched captures. Current support artwork is resolved through the ordinary current Basic publication reader before reaching Character surfaces. Shared token polish uses the owner-pinned React accent before the old name fallback.
- Pilfer and Invocation replacement defaults are original generated art at `apps/web/public/media/art/support/{pilfer,invocation}-v02.webp`, registered through existing asset hooks. Previous assets remain. Generation provenance and prompt descriptions are in `apps/web/public/media/art/support/provenance.json`. Current custom uploaded artwork remains authoritative and requires the normal media-only versioned publication to select the replacement during a release.

## Evidence

- Clean baseline game-core: 6,875 tests / 241 files pass.
- Barrier RED reproduced missed reactions on absorbed positive damage. Corrected focused matrix: 12/12 pass.
- Self-damage RED reproduced the authoring prohibition and runtime eligibility gap. Corrected Self/Anyone, Barrier and lethal-boundary checks pass alongside historical rejection coverage.
- Glow RED reproduced a green friendly parent shadow under the red overlay. Corrected shared paint passes all 16 existing desktop/mobile PvE/PvP glow cases.
- Move RED reproduced absent controls and rejected unknown payload keys. Focused combined mechanics matrix: 41 tests / 3 files pass after adding authoritative Move metadata.
- The broader target audit found Loot offered unsupported recipient conversions; it now keeps its existing selected-unit recipient and rejects unsupported target choices. All 43 canonical editor tests pass.
- Remaining final results are recorded below after execution; these checkpoints are not release claims.

- Image RED reproduced a valid noisy JPEG becoming an oversized PNG and blocking finalization; corrected server media6 and database19 checks pass, including resized Commit/reload, real PNG byte dimensions, crop truth, hash and authority. Full migrated disposable DB suite501 passes in the first combined run.
- Usage RED reproduced unlimited reuse despite Once per action. Corrected persisted engine5, Manual/Controlled/Basic Move reuse, current/historical factory and owner projection checks pass. Native cockpit matrix38 passes in both battle modes at1366/390; current no-cooldown one-use button disables after commit.
- Independent review found Ground all-except-actor leakage and lethal area actor ordering. Both are corrected; mask regressions and lethal Anyone/Ground tests verify actor-last packet settlement and a single draw when everyone dies. Historical ordering remains unchanged outside new policy.
- Chronicle/log focused matrix198 passes, including actual captured Invocation/Vesper after expiry and hidden/mismatched-source cases. Current support artwork matrix61 passes. Owner-color matrix41 passes, with six native desktop/mobile PvE/PvP/spectator cases proving computed ring+arrow accents for four owners and identically named summons.
- Fresh main fetched November3 remains base b8f6b68. Final results follow below.

## Pending support-art publication

The replacement defaults are `/media/art/support/pilfer-v02.webp` and `/media/art/support/invocation-v02.webp`. Their stable hooks remain `basic.pilfer.icon` and `basic.invocation.icon`. Current saved finalized artwork takes precedence over these hooks: deploying the assets alone will not replace an existing custom Invocation or Pilfer upload.

At an explicitly authorized release, use the existing Master → Skills · Basic → relevant record → **Restore default artwork → Commit Now** workflow for each of these two records that has an overriding custom image or different icon hook. Build the candidate from the fresh complete current definition: remove only `media.artwork`, set `media.iconKey` to that record's stable hook, and preserve every other media field and gameplay field. The published hook will then resolve to the corresponding v02 asset. A record already using that hook without finalized artwork needs no publication.

Before any write, read the fresh complete current definition, record revision, version floor/highest version, catalogue CAS token and draft state. Preserve all Owner drafts; if either target has a draft, stop that record's release operation and reconcile it with the Owner rather than replacing it. Compare the exact candidate and prospective corrected definition against the fresh current definition, excluding only `contentVersion`, `media.artwork` and `media.iconKey`; abort if any gameplay or other media field differs. The existing Commit Now corrector must not silently broaden this media-only publication.

If the established service-role release procedure is used instead of the UI, invoke the existing atomic `commit_combat_content_record_v1` with the verified Owner user/character IDs, content key, fresh expected revision, copied-current media-only definition, fresh expected catalogue token and the validated record/builtin version floor. Retain the existing prospective catalogue validation and readback/preservation checks. A stale token/revision requires a new read and review, not an automatic overwrite; an ambiguous response requires readback before retrying.

Verify a new immutable version only for each changed record, exact media-only current readback, unchanged prior versions/finalized assets and unrelated publications/drafts. Then check actual decoded artwork in Master, Nexus/Skill Manager and a newly created battle. Existing battle captures containing the former custom descriptor retain that image. No current publication versions, revisions, catalogue tokens or draft assumptions are hardcoded here: they must be obtained at release. This appendix prepares the release delta; no hosted mutation, content publication or deployment was performed.

## Final local verification checkpoint

- Formatting, zero-warning lint and every package typecheck pass. All 16,100 Vitest tests (game-core 6,908; web 8,560; DB 501; remaining packages 131) and seven Node tests pass.
- The first final production build failed while opening a stale Turbopack persistence cache (invalid digit), before compilation. Moving only generated `.next` output aside and rerunning `pnpm build` passes. This is a local cache recovery, not a product-code workaround.
- The final generic Invocation art removes the creature silhouette for future summon reuse. Asset-hook/media focused checks and the final build are rerun after this image-only revision.
- Native production-component matrices: targeting/editor82, canonical targeting38, canonical Move38, owner colors6: 164 cases, zero page errors. Summary evidence: `release-assets/2026-11-03-combat-editor-native.json`.
- Independent source review found two Important recipient issues, plus an omitted-target path; all are corrected with failing-first regressions and accepted on re-review. Current/native/legacy mechanics remain separately covered.
- This checkpoint does not claim hosted migration application, content publication, production deployment or human gameplay acceptance. Follow-up Owner requests for the full Items system, equal Reckless/Fortified magnitudes, and global Skill Requirements/explanation deduplication continue separately and are not represented as implemented by this checkpoint.

## First remote CI compatibility corrections

The first exact-head remote run exposed a newly introduced Nexus dependency on retired Guard when collecting current support artwork. The reader now requests only the five current Support actions; a failing-first regression proves a retired Guard lookup cannot block Nexus. Two native scripts also retained old assumptions: pure Move's now-replaced range input, and Pilfer/Invocation v01 filenames. Their assertions now verify enabled Move elevation/LOS controls and the actual registered v02 art. Focused25 tests, changed-file lint/types,18 native Support cases and the modular editor/palette matrix pass. The corrected exact-head remote run remains required; the initial remote failures are not counted as acceptance.

The next remote reader run reached Simple Requirements and found one further saved-reader assertion still expecting the old “Once per action” teaching label. The checkbox remains named Once per action; its current saved report correctly explains Once per battle. The assertion now checks that intended meaning, and all34 native Simple Requirements cases pass locally. The other16 completed workflows in that remote run passed; unfinished/failed workflows still require the corrected exact-head result.
