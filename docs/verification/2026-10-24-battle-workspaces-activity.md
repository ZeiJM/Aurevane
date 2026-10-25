# Battle workspaces, World rendering and activity follow-up

## Status

Local implementation, independent review and integrated verification passed on `agent/battle-workspaces-presence-20261024`, based on PR #977 merge `9128bfc382f7d7a86469e0ddb720ab0eb277ca87`. Prepared for native CI publication; not merged or deployed. The prior production is unchanged. Requirements and sequencing: `docs/superpowers/specs/2026-10-24-battle-workspaces-activity-design.md` and matching plan.

## Battle

Mobile Chat, copyable key, spectator count, Terrain, Cancel and Surrender share the original 44px footer row plus safe-area inset, with gaps, compact visible labels and full accessible labels. Conditional target confirmation remains. The fixture mounts the real PvP quality-controls portal including Surrender, so geometry checks cover the complete footer.

The unchanged-size gold Current / Round badge toggles the traditional shared Chronicle in the cockpit and adds a small recirculation icon. Timeline, battlefield geometry and log scroll ownership remain. Chat is always the real message feed, with no log tab. Mobile chat occupies preview/cockpit space without an X; the same transport/draft remains mounted through toggling/rotation. Desktop retains its window. Per-battle workspace state coordinates Terrain/history/chat; readers block combat shortcuts and battlefield clicks, with the command deck inert.

Your turn has green title/glow, enemy waiting text red; action titles retain the ownership colour and terminal states show the real result. No new banner row or flashing. Mobile cooldown centre offsets reproduced at 390px (x3.85/y7.05px); centred overlays now pass portrait/coarse-landscape geometry checks. Desktop placement is unchanged.

Essence/Resonance recorded damage, recovery and statuses already render through the shared Chronicle. Explicit outcome tests and immutable-context/privacy cases pass; no production outcome logic changed for this request.

Focused 320px checks pass, including the real six-control footer, gold log toggle, cooldowns and final facing. Earlier 320px pointer/keyboard movement and attack authority/duplicate guards pass. The full final matrix subsequently passed, as recorded below. A preliminary combined run passed playable PvE and desktop PvP cases before a new turn-state probe changed a fixture version expected by a later assertion. The probe was moved to its own page; that harness failure is not reported as a product regression or clean complete run.

Evidence: `/tmp/av-workspace-round-red.log`, `/tmp/av-workspace-round-green.log`, `/tmp/av-workspace-cooldown-red.log`, `/tmp/av-workspace-chat-first.log`, `/tmp/av-workspace-pvp320.log`, `/tmp/av-workspace-footer-real.log`, `/tmp/av-workspace-turn-red.log`, `/tmp/av-workspace-units.log`, `/tmp/av-workspace-special-outcomes.log`.

## Presence

Root cause: the heartbeat mounted only inside the open Account menu. Normal play/training could have no activity until that menu or Online Users opened. A headless heartbeat now mounts independently in the authenticated shell, keyed to the selected character; the menu subscribes to its count.

Per browser page/selected character: one timer/in-flight request, immediate first visible request, 120 seconds after success. Hidden tabs stop timers. Failure retries use 15/30/60/120 seconds capped at 120, with deadlines shared across remounts. A real request retains session/owned-slot validation, presence touch and scalar count; it never scans/hydrates the directory. Training/offline processors are untouched.

Roster RPCs fetch stable ID-ordered pages below the 1,000-row gateway cap; the earlier test mocked an uncapped primary result and only tested hydration. Unknown legacy history reads No recorded activity. No invented timestamps, login column or migration. Local verification: 11 files/51 tests, affected lint and web TypeScript pass. The strengthened native desktop navigation case requires a heartbeat with Account closed and no duplicate on opening/remount; authenticated execution remains pending.

## World

Zoom cold-rebuilt terrain on each tiny step. Stable rasters now survive the gesture and refresh once after 120ms quiet input. Projection, camera, picking, zoom lock, motion and final pixels are retained. Controlled 40-step Chromium p95: phone42.4→1.4ms, ordinary desktop63→1.4ms; terrain creations485/456→13. These are fixture measurements, not hosted guarantees; the final crisp repaint can still cost ~55ms.

At 35%, a fixed180-scenery existence cap omitted already-loaded visible trees (262 eligible at1296×944). Walking admitted them without network activity. Visible static bodies now remain, while180 bounds expensive detail. Small/overflow bodies use cheap direct sprite draws; other terrain/water/wildlife/coast/identity-density limits remain. No new bitmap cache. Tests require actual supplied visible bodies across walking frames rather than changing a count alone.

Extreme3840×2160 was already slow (~~95ms warmed p95); retaining2,123 bodies measured~~108ms. Omission is fixed; overall4K frame pacing is not. Further scene/depth caching is separate. Delayed sprite sheets repaint promptly on load without new input.

The Owner's rare click-to-move stop/resume is unconfirmed. Existing motion tests show a similar pause when first approval exceeds the preserved600ms unconfirmed-motion bound; that is a possible mechanism, not an actual-session diagnosis. No movement/server/prediction-bound change. PR #933 remains separate/unmerged/unresolved. Probe, timing and pixel evidence: `/tmp/av-zoom-investigation/`.

## Release boundary

Local integrated checks and independent review are complete. Native authenticated CI remains required. Preserve `apps/web/vercel.json` with `git.deploymentEnabled["**"] = false`. No preview/staging, hosted environment/data/schema changes, catalogue publication or unrelated Master/Staff work. Fixture tests do not establish Owner signed-in/physical-device/multiplayer acceptance. Configured exact-source gates, fresh-main reconciliation and exact tested-tree merge verification remain required. No new deployment is claimed.

## Final local gate and reconciliation

The complete integrated local sequence passed: format, lint, eight package type checks, 12,392 Vitest cases, seven Node checks and production build. The subsequently added real-SSR presence hygiene regression and adjacent tests passed (one additional unique case; 12,393 unique Vitest cases across these runs). Final targeted web types/lint including that patch passed. These are separate completed runs, not a claim that the entire suite ran after the last patch. Evidence: `/tmp/av-workspace-quality-final.log`, `/tmp/av-workspace-presence-final.log`, `/tmp/av-workspace-premerge-types.log`, `/tmp/av-workspace-premerge-lint.log`.

The final shared browser matrix passed across playable PvE/PvP at 1920, 1366, 1024, 821, 390, 320 and 844 landscape, plus applicable spectator cases. A fresh independent review found two Important issues: a conditional third Chronicle reset reading state, and the 821px spectator badge overlapped Terrain. Both have red-to-green guards and are fixed by retaining the existing mounted reader and reserving a real spectator footer cell. A subsequent real-browser probe found that the log hotkey could not close an open mobile log; the root listener now handles that toggle while retaining nested-reader/input ownership and combat blocking. The post-fix focused browser run passed. Evidence: `/tmp/av-workspace-browser-verified.log`, `/tmp/av-workspace-review-fixes.log`, `/tmp/av-workspace-postreview-browser.log`.

The final freshness check found main advanced to `a7e80f619f8da5df59da7a8b66098606da93cb22` (PR #970 World diagnostics), overlapping the renderer and its tests. The reviewed task source is checkpointed before reconciliation. The combined source requires fresh verification; no stale source is published or deployed. Diagnostic clocks, bounded capture and strict native movement assertions must remain intact.

## Combined source verification

Main PR #970 diagnostics were reconciled with the task renderer. Its callback-entry clock runs before raster settling; cache build/resample timings and bounded post-paint records remain intact. The six desktop/mobile wheel/pinch/settings cache guards now also require no intermediate ground rebuilds, a measured final rebuild, unchanged RAF timestamps and complete phase accounting. The native repeat helper/assertions are inherited unchanged from main.

The combined tree passed the complete local quality sequence (normal Turbo cache): format, lint, all eight package type checks, **12,424 Vitest cases plus seven Node checks**, and production build. World renderer/projection/terrain and native diagnostic helpers separately passed **170 cases**. Real Chromium desktop/mobile wheel/pinch/lock tests issued zero walks and retained the camera. Final 110% terrain pixels match the old renderer exactly at 390px/DPR2.625 and 800px/DPR1. Delayed scenery sheets repainted without further input. Native affected-suite discovery collected 162 entries in five files; collection is not authenticated execution. Logs: `/tmp/av-workspace-merged-quality.log`, `/tmp/av-workspace-merged-world.log`, `/tmp/av-workspace-merged-zoom.log`, `/tmp/av-workspace-merged-crispness.log`, `/tmp/av-workspace-merged-assets.log`, `/tmp/av-workspace-merged-native-list.log`.

The complete battle browser matrix and post-review keyboard regression above remain applicable: main's intervening change touched only World diagnostics. No battle source changed during reconciliation. Native authenticated execution is delegated to the configured exact-head CI; Docker is unavailable locally. Do not treat CI publication as release or human acceptance.

Decisions and limitations: heartbeat semantics are accepted activity evidence, not reconstructed historical character-selection login dates. Visible scenery bodies replace the old existence cap while retaining the 180 expensive-detail budget; the documented 4K cost remains. The rare walking pause and formal arbitration of delayed stale zoom settings remain unconfirmed, so neither movement limits nor feedback authority were guessed or changed. PR #933 remains separate and unresolved.

## Native guard alignment after first CI

PR #978 head `197a0143` started ten configured workflows. Combat/mobile run `40143029911`, job `121018547815`, failed because the older mobile-panel script required footer height to change on rotation (actual44, expected44 via `notEqual`) and later still clicked the now-hidden mobile close X. A local unchanged-source run reproduced that exact failure before editing the guard (`/tmp/av-workspace-mobile-panel-red.log`). The script now requires the original44px row in both orientations, the chat panel filling the lower workspace, no Battle Log tab, hidden mobile close X and draft survival across rotation/toggles. The **complete script passed** across all modes/map sizes/viewports (`/tmp/av-workspace-mobile-panel-green.log`, evidence `/tmp/av-mobile-panel-green`). No production component, dimension, authority or deadline changed in this correction.

The same pass aligns five native battle assertions with the approved Your turn title and explicitly requires `data-battle-turn-state=yours`; a public-profile unknown-history assertion now requires No recorded activity. All command/AP/turn/ownership/privacy checks remain. Affected script/native-file lint, formatting and syntax pass; native discovery collected15 entries in4files (`/tmp/av-workspace-ci-guard-native-list.log`). Authenticated execution and a fresh full quality gate remain CI responsibilities for the new exact head. The prior completed local12,424+7/build gate covers identical production source; it is not represented as a rerun after these test-only edits.

## Desktop geometry selector correction

On head `c2e912ac`, the complete CI quality/database workflow, Desktop experience, Representative Buildcraft, Combat/mobile, ability readers and Controlled checks passed. UI review run `40143431706` completed108passes/61intentional project skips and2failures: both desktop forecast cases dereferenced a null Cancel rectangle. Two geometry helpers still selected Cancel by raw `textContent`; the compact-label spans yield `Cancel ActionCancel` even though the visible/accessibility name remains Cancel Action. A real production-component probe reproduced that old-selector failure before the correction.

Both helpers now use the existing `data-battle-cancel-action` marker; the forecast guard additionally requires a non-null, footer-contained Cancel rectangle. Existing board stability, Terrain-before-Cancel, cockpit, artwork and viewport limits are unchanged. The probe passes PvE/PvP at1366/1536px, showing the button contained and correctly ordered. Logs: `/tmp/av-workspace-cancel-selector-red.log`, `/tmp/av-workspace-cancel-selector-green.log`, `/tmp/av-workspace-cancel-lint.log`, `/tmp/av-workspace-cancel-types.log`. A scan found these two raw-text Cancel selectors; no production source changed. Fresh exact-head native CI remains required.

## Mobile round-toggle native guard correction

Head `7e703188` finished nine configured workflows successfully. Its sole failed workflow was Browser smoke `40144714346`, job `121023785551`: Guided Fundamentals passed desktop/laptop and failed mobile because `battle-round-badge-helpers.ts` expected exactly Current battle round1 while the approved interactive badge correctly announces Current battle round1. Show battle log. The same helper also retained the former non-interactive pointer-events expectation. The run stopped at this focused case before the later complete suite; no unchanged-source retry was launched.

The helper now verifies the mobile button, enabled state, valid expanded state and exact Show/Hide label, retaining the fresh authoritative round comparison, absence of the old footer toggle, contained badge and desktop non-interactive behaviour. No production component, style, gameplay assertion or timeout changed. The original helper failure was reproduced locally before editing. The actual corrected native helper then passed12 production-component fixture combinations (PvE/PvP/spectator ×320/390/844landscape/1366desktop); mobile cases check closed/open/closed. Only its server snapshot-response boundary is supplied by the existing local fixture, so this does not claim authenticated Guided Fundamentals execution. Affected lint, complete web TypeScript and native discovery pass. Evidence: `/tmp/av-workspace-round-helper-red.log`, `/tmp/av-workspace-round-helper-green.log`, `/tmp/av-workspace-round-helper-lint.log`, `/tmp/av-workspace-round-helper-types.log`, `/tmp/av-workspace-round-helper-native-list.log`.

Publishing this test-only correction starts fresh configured CI for the new head. Continuous agent polling remains paused at the Owner's usage preference. No automation was created or resumed, and no merge/deployment occurred.
