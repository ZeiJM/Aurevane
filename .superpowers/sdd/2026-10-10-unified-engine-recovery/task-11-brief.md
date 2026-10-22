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
