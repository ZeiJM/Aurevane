## REQUIRED first dependency checkpoint from Task10 cap adjudication

Before Rules/Music/World work, close the four confirmed Important Stage D adapter defects and M1 below. They are inherited load-bearing dependencies expressly carried into this next approved task at Task10's exhausted5/5 cap, not a sixth D fix wave or a reset. Root verified their concrete producer/consumer contracts. Use one implementation seat for the entire Task11; do not delegate. Produce one early coherent checkpoint with meaningful RED/GREEN controls and affected types/lint/format, then continue the operational scope below. Do not change the kernel, Basic parser key contract, unpublished-media public ACL, stored definitions/history or current/exact Tag semantics to make preview code pass.

Read the detailed review at docs/verification/task-10-reconstruction/stage-d-review-20261023.md for evidence; exact findings are reproduced here. Final Task11 report must separately map I1–I4 and M1 to source/tests, and its combined review must verdict them closed. Keep M2 tracked for13. Root owns actual physical/native browser/hosted operations. The current D native run is evidence on the old frozen D source, not a pass for your later changes.

## Important findings

### I1 — The Basic Text form creates an unsupported field and makes the draft unsavable

**Location:** `apps/web/src/components/master/combat-content/content-definition-fields.tsx:640–647`.

The shared combat Text section offers **Flavor line** for Basics as well as Discipline Skills, Essences and Resonances. Its callbacks always set a top-level `flavorLine`. Every Basic definition has a strict top-level key allowlist; `flavorLine` is absent from it (`packages/game-core/src/combat/combat-basic-actions.ts:66–88`). Only the supported Basic text fields, including `description`, `battleText` and `presentation`, may be written.

Reproduction from the actual source path: open any of the five Basics, select Text, type into Flavor line, then Save draft or Validate. The resulting Basic fails with `flavorLine / unknown-key / Unsupported Basic Skill field`. Clearing the input still writes an empty `flavorLine` property, so clearing it does not recover a valid definition. The retired Basic editor did not expose this unsupported field.

This violates the requirement to finish applicable fields for all five independently editable Basics. The new Basic tests only mount the Text tab and check for Description; they do not exercise the offered field through the strict parser.

**Requested correction:** make the shared Text controls category-aware and keep Basic edits within their existing definition contract. Preserve the supported Basic presentation fields; do not add a new mechanic or silently discard a user's other text. Cover the actual Text callback through validation/save for all Basic identities, including clearing an optional field.

### I2 — Unpublished finalized media cannot load in the main authoring previews

**Location:** `apps/web/src/components/master/combat-content/content-record-preview.tsx:77–78`.

The main full/compact/comparison preview obtains artwork and audio URLs using `contentMediaSource(media.artwork)` and `contentMediaSource(media.audio)` without the preview flag. The helper defaults to `/api/content-media/<id>` (`packages/game-core/src/combat/content-media.ts:84–85`). That public route calls `readPublished`; the accepted SQL intentionally returns a media asset only when an immutable publication references it (`supabase/migrations/20261022214821_finalized_combat_content_media.sql:89–90`). A newly finalized upload referenced only by a local or saved draft therefore returns 404 here.

The Media tab already uses the authorized private preview route, via `contentMediaSource(value.artwork, true)` and the corresponding audio call (`finalized-media-editor.tsx:211,237`). Consequently a newly uploaded image/sound can work in the Media tab while appearing broken in the main draft and comparison previews until publication. This defeats review-before-publication for the newly added preview surface. The pending media E2E edits target the Media controls, which does not establish that these main preview URLs work.

**Requested correction:** use the protected authoring media-read path for unpublished authoring previews while preserving the public route's published-only reachability restriction. Cover new local media and saved-but-unpublished media in the actual preview; keep already published and exact retained media working. Do not make unpublished assets public to repair the preview.

### I3 — Main compact and activation previews ignore the authored presentation text

**Locations:** `apps/web/src/components/master/combat-content/content-record-preview.tsx:112` and `:185`.

There are two omissions in the new preview adapter:

1. Sample messages set `actionContext.battleText` only from the legacy `body.battleText`. Authored `body.presentation.activation` is not selected for that field. The real Chronicle consumes `actionContext.battleText ?? actionContext.flavor` (`apps/web/src/components/battle/battle-log-chronicle-model.ts:275–278`); merely attaching the presentation object does not make it use its activation template. Editing the new activation template therefore leaves this sample showing legacy/fallback narration instead of the authored activation.
2. For canonical non-Resonance definitions, Compact view calls `AbilityDefinitionParameters` directly. It bypasses `SkillParameters`, whose canonical branch renders `presentation.compact` before the parameters (`apps/web/src/components/character/skill-parameters.tsx:18–33`). Thus the compact wording edited in Text is absent from the main compact/comparison preview for canonical Skills, Basics and the nested Essence body.

The separate text helper is not a substitute for the required actual full/compact/live/message preview. These are valid authored fields and can be published, so a misleading preview can survive otherwise successful validation.

**Requested correction:** feed the main previews through the same presentation selection and rendering contract as the production readers, including activation precedence and compact text. Add controls with distinctive compact and activation strings, configured references, and legacy fallback text so the rendered main preview proves which field is consumed. Keep authoring Accuracy recursively excluded.

### I4 — Basic previews lose native execution metadata and misdescribe edited mechanics

**Locations:** `apps/web/src/components/master/combat-content/content-record-preview.tsx:185,195`.

Basics are passed to the generic Ability renderer for compact view and cast to `MatureSkillDefinition` for the full `SkillDetails` view. Both routes render their Ability without passing the Basic execution envelope to `abilityBehaviorInformation`.

That envelope is necessary for truthful Basic mechanics: `apps/web/src/components/character/ability-detail-presentation.ts:407–426` uses it for stronger Physical/Mystic Power scaling and recovery rounding, and `:524–526` uses it to distinguish per-terrain-point Move costs. The generic `AbilityDefinitionParameters` call supplies no `basic` option (`apps/web/src/components/character/ability-definition-parameters.tsx:43–52`). The retired Basic editor explicitly supplied `basic: draft` to that shared report builder.

For example, changing Basic Attack's Higher Power scaling to 42.25% does not make the new full/compact preview describe that scaling; it describes the underlying flat Ability payload. Changing Move from flat to per-terrain-point cost or changing Recovery rounding likewise loses the execution distinction. This is a presentation regression, not a requested change to the kernel or roster balance. The new Basic preview test checks a changed AP amount and privacy, which does not cover these execution-dependent facts.

**Requested correction:** retain the complete Basic execution context when rendering shared Basic information, with an explicitly illustrative character context wherever needed. Cover changed scaling, both Move cost bases and both supported recovery rounding choices in the actual full/compact preview. Preserve the public projection and existing native execution formulas.

## Minor findings

### M1 — The three-row history window can omit the selected current publication

**Location:** `apps/web/src/components/master/combat-content/combat-content-authoring-workspace.tsx:537–538`.

The UI sorts all history by descending version and takes the first three, instead of reserving one row for the selected current version. Retained state with current v2 and physical history v2/v73/v74/v75 therefore shows v75/v74/v73 and no current row. The page's own supported retained-state fixture uses exactly this form (`apps/web/src/app/master/combat-content/page.test.tsx:138–151`). The version-state banner still identifies current v2, and data is not deleted, so this is Minor rather than a persistence defect.

**Requested correction:** include the actual current publication explicitly, then the appropriate two previous/other recent retained publication entries, without duplicates. Add a history-rendering control where the current pointer is older than the newest stored versions.

### M2 — Inherited Vite native-config warning remains unsuppressed

**Location:** `apps/web/vitest.config.ts:1`, as reported in `docs/verification/task-10-reconstruction/d-tag-preview-wiring-green2.log.gz:1–3` after decompression.

The final focused Web log still warns that ESM syntax in a file loaded as CommonJS is unsupported by Vite's future native config loader. This is the already recorded C M2, not a new D source defect. The warning was not suppressed and does not invalidate the recorded exit-zero tests. Retain it in the integration inventory until a compatible configuration change is independently verified; do not describe the test logs as warning-free.



Preserve same-snapshot current Tag dictionary bindings and historical exact/captured Tag snapshots while repairing previews. Use actual public/battle components, private authoring URLs only within protected authoring, and recursively strip Accuracy. Distinctive authored compact/activation strings with references and fallback strings must prove real rendering precedence; Basic tests must exercise changed42.25% stronger-Power scaling, both supported Move cost bases and both recovery rounding choices without changing execution balance/formulas. All five Basic Text forms must remain parse/save-valid after supported edits and clearing optional text. Main media previews cover local and saved-but-unpublished final assets; public unpublished reads remain denied.

## Original Task11 requirements

### Task 11: Combat Rules and Site Music

**Files:** Existing timing/elevation policy editor/store/service and site-music settings/media/player/route coverage components/tests; compact Rules/Music workspaces.

**Interfaces:** Consume T8/T10 capability/shell and shared timing/Tag registry. Produce one actual timing/elevation authority, Used-by compatibility checks, Global/page music selector `Use Global | Custom Track | No Music`, slash-boundary longest-route coverage and single continuous looping player.

- [ ] RED `timing_order_not_execution_order`, `controlled_compatibility_usedby`, `reason_free_policy_save`, `page_silence_over_global`, `global_silence_custom_page`, `slash_boundary_longest_match`, `same_track_continuous`, `loop_user_intent_autoplay_error`, `pc_music_upload_retained`. Assert explicit silence never falls back to Global, route prefix does not match an unrelated sibling, same effective track does not restart/overlap, stop/replace occurs on effective selection change.
- [ ] Run policy/store/editor/music resolver/player/upload tests. Expected: actual missing behavior/copy/workspace assertions fail.
- [ ] Implement compact searchable/sortable timing/elevation sections and music page list/preview/reset/upload/direct URL. Display Instant/Normal/Delayed/Controlled intentionally; preserve captured old timing. Hide user-managed policy numbers/reason bureaucracy while retaining internal CAS and attributed history. Preserve mute/volume/player intent and actual route coverage; expose understandable upload/playback failures.
- [ ] Run real reader/editor/player tests and desktop/mobile/zoom/cross-page browser checks. Expected: continuous looping/silence and authoritative rules work; no skill-audio coupling or fabricated playback success.
- [ ] Commit/report/gate/checkpoint; carry actual supported media limits/coverage into final handoff.



## Current approved operational carry-forward

## Task11 — Rules, Site Music and approved World Environment

World Environment remains within the wider Master mandate even though the old Task11 title names only Rules/Music. Actual `world-environment-editor.tsx` still requires8–240character reasons, shows policy/version text and Recent Changes, and offers fixed15m/1h/6h/cleared choices. `world-environment-admin-store.ts` validates that bureaucracy and sends p_reason. Remove routine reason/history/version chores through UI/TS/relevant SQL, preserve automatic actor/time/action and internal CAS/history. Force weather for a positive whole number of minutes and return to ordinary weather after expiry. Do not replace one required reason with an invented value.

`world/environment.ts` currently uses the fixed24h UTC clock, offset and freeze; `dayLengthMs` is a returned constant, not configurable day/night authority. Add real configurable cycle authority/actual consumers. `map-renderer.ts` already applies gradual cosine night tint from minuteOfDay. `map-weather.ts` already maps shared rain/storm to Frostmere snow, and `world-workspace.tsx` already shows Snow/Snowstorm with UTC time in the header. Preserve those working paths. Remaining work includes accurate regional labels/explanation in Master and compact current time/phase/weather in the requested World right panel. Do not redo movement, traversal, artwork or persistence compression owned by other work.

Rules use the actual shared global Tag timing/elevation authority; display sorting Instant/Normal/Delayed/Controlled must not alter execution order. Keep captured history and real compatibility/Used-by safeguards. Hide policy management numbers and routine reasons while preserving CAS and attribution. Consume the actual simple Requirements/Tag registry from merged #950 rather than replacing it with qualitative prose or another mechanics registry.

Site Music's actual resolver (`lib/site-music.ts`) already implements slash-boundary longest matching and an explicit disabled matching override returns silence. The actual gap is `if (!config.enabled) return null` before route overrides, which prevents custom page tracks under global silence. Preserve working silence/boundaries. Expose real persistent Use Global / Custom Track / No Music, understandable page coverage and legacy prefix preservation, search/preview/reset/replace/upload/direct URL.

`audio-provider.tsx` already keeps the same media element/source for an unchanged URL, uses native loop, preserves user pause intent and handles hidden/visible behavior; do not rebuild or falsely claim these are absent. Preserve volume/mute and avoid overlapping players. Existing PC upload/signed site-music bucket/direct URL and20MB MIME allowlist work; preserve them. Improve actual visible upload/playback failures rather than promising successful audio without a real browser event. Site music stays separate from Skill audio.


## Exact Owner clauses

## 15. Combat Rules, timing/elevation settings, and simpler administration

Redesign the existing effect-timing and elevation-change screens into compact focused sections. Preserve the actual elevation mechanics and validations while improving presentation. Keep global elevation-change rules distinct from a skill’s Target Elevation field.

Allow effect tags to be searched, filtered, and sorted by name or timing in either direction. Use an intentional timing order: Instant, Normal, Delayed, Controlled. Display sorting must not alter execution order. Keep timing assignments authoritative and shared; do not create competing copies in different editors.

Remove mandatory reasons from panel forms and the corresponding relevant request validation. Do not silently submit invented reasons. Retain automatic actor/time/action records and appropriate confirmations for sensitive operations without covering the screen in audit widgets.

Remove visible policy/revision numbers and manual policy-management workflows. Editors change the settings and use straightforward Save Changes. Internal concurrency identifiers or snapshots may remain where required for correctness, but the Owner should not have to manage numbered policies.


## 16. Site Music

Replace the current complicated layout with **Global Music** plus a compact page-override list.

Global Music supports an uploaded file, a direct audio URL, or No Music. Each page supports **Use Global, Custom Track, or No Music**. Custom Track supports upload or direct URL. Explicit page silence overrides Global. Global silence must still permit a page’s custom track.

Use actual page names/routes and show the effective track or inherited/silent state. Provide search, preview, replace, remove, and reset-to-global controls. Do not require raw path editing for ordinary tasks. Migrate existing broader route rules carefully rather than silently changing coverage.

All enabled music loops indefinitely. Preserve player volume/mute and playback permissions. Avoid overlapping players; keep the same track continuous across pages that use it, and replace/stop it when the effective selection changes. Site music must remain separate from skill audio.

Validate uploads and usable direct media URLs, provide understandable playback errors, and retain uploaded assets durably. Do not fall back to global music on a page explicitly set to No Music.


## World Environment / weather Master workspace

Include the newly added World Environment workspace in the professional Master
overhaul, aligned with the actual world systems and the shared shell.

- Remove Recent Changes and its administrative change-tracking workflow.
- Remove required written change reasons and reason logging throughout the
  Master Panel. Remove policy/version-number tracking from its user experience.
  This replaces earlier requirements to retain those administrative displays;
  immutable gameplay captures and concurrency identities are distinct engine
  correctness mechanisms, not user-managed policy-number controls.
- Weather labels must accurately correspond to rendered regional weather,
  including rain versus snow. Do not call biome-dependent snow "rain" without
  making the regional result explicit.
- Support a manually entered forced-weather duration in minutes, rather than
  only preset durations. Expiry returns to the actual ordinary weather authority.
- Add configurable day/night cycles and pertinent controls; the real map must
  transition through day/night, and the travel screen's right panel must show
  current world time/phase/weather clearly and compactly.



## Execution boundary

Single sole implementer; no helper/reviewer agents. Root owns all remote source publication/native/hosted/merge/deployment. Existing Owner authorization covers the completed full Master live release; no repeated design/permission loop. Preserve current combat/roster/Owner definitions/history/player facts; no map implementation or rebalance publication. Consume accepted prior shell/capability/current-pinned contracts. Read only this brief and necessary concrete handoff interfaces, not the whole plan/session history. Corepack-pinned pnpm; meaningful focused RED/GREEN, affected types/lint/format; final full pnpm check belongs Task13. Do not relax assertions/timeouts or invent routine reason strings. Append exact argv/results/immutable compressed raw SHA evidence preserving the ledger prefix. Early coherent commits for root remote backup; ask root for main freshness before reconciliation/commit. Full task report at this brief's matching task-N-report.md with source/tree/interfaces/migrations/commands/output and pending native/browser/hosted limits; final concise status/commits/tests/concerns. Stop source at task handoff for the one combined review before next task.

## Preimplementation music precedence clarification

Root read the actual current apps/web/src/lib/site-music.ts resolver and retained-prefix model at the accepted D baseline. Ruling: an explicit page selection Use Global must resolve directly to the configured Global track/silence, even when a broader legacy prefix has a custom or silent override — Use Global names that specific authority, while unset pages continue their retained broader coverage. Cost if wrong: the explicit per-page selection may differ from inheriting a broader route rule; it is visible, reversible configuration. Preserve broader rules for all other pages; do not silently delete or flatten them.

Add a focused explicit-global-page-over-broad-custom/silent control alongside existing longest-slash-boundary and global-silent/custom-page checks. Reset to Global should implement the stated selection, not remove the entry and unexpectedly reveal a retained broader custom rule. Expose clear effective state/coverage without requiring raw path edits. Legacy stored enabled false remains explicit silence; enabled custom rows retain actual prefix coverage. No new player or Skill audio authority.

## Concrete D native follow-through into this dependency checkpoint

Frozen source remote7c02f72ad9046c77b023b494e0453124769da326, native CI39879830994: Database foundation120174258510 SUCCESS. Root inspected actual migration20261022233500 application, selected-character/private ACL, Players/Event/route checks and all7 actual producer tables both physical lock orders/whole rollback. This closes D foundation application/authority only, not new media/Tag lifecycle or final browser gates.

Quality120174258742 stops at Prettier for apps/web/src/components/master/staff-focus-interaction.test.tsx: vi.fn().mockResolvedValue layout. Fix this touched-file formatting in the early dependency checkpoint; no semantic test change or full-suite rerun just for formatting.

Browser120174258557 reaches the new Basic editor palette and fails existing contrast4.5 assertion (text rgb(49,59,55), background rgb(107,107,107)), script assertBasicContrast458/verifyBasicEditor476. Trace actual shared-workspace control/theme versus fixture contract and repair the demonstrated cause in this same bounded UI checkpoint. Preserve the existing contrast assertion and real mounted UI; do not lower the standard, skip it or guess a broad palette redesign. Cost if wrong: a small style/fixture-contract correction reversible with actual native evidence.

Separate modular-reader120174258447 times out clicking Preview Essence: Unbroken Strike: an already open Unbroken Strike data-battle-info-panel intercepts pointer events, gesture314/verifyModularReaders326. Basic/Primed/SimpleRequirements steps are NOT reached. This remains13 unless a direct cause lies in the assigned preview repair; no force-click, ignored exception or timeout increase. Compilation does not close it. All raw diagnostics are preserved in docs/verification/2026-10-23-master-native-d.md; no broad local rerun requested.
