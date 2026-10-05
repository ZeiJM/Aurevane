# Battle input, timing, preview and Chronicle corrections

Owner-requested follow-up to the October 4 battle release. All changes remain on a non-deploying branch until exact-candidate verification and the authorized combined release. Prior approved artwork and layout dimensions remain unchanged.

## Scope and root causes

- VS: replace rapid multi-peak flicker with one smooth seven-second glow cycle, steady lettering and static reduced-motion presentation.
- Preview: remove AP/AP remaining/Range chips, Parameters and Details buttons and the Forecast details popup. Preserve server-derived recipient outcomes, primary-only hit chance, actual selected area recipients and full cockpit information. Movement range guidance remains.
- Guard: timed inherent Guard omitted explicit authored duration, allowing the legacy timing fallback to reduce two advertised turns to one. Policy-bearing snapshots now resolve Guard v2 with `durationTurns: 2`; legacy Guard v1 and stored pending/active lifetimes remain unchanged.
- Resonance: pre-roll attached bonuses allowed actor recovery/Guard and activation on a miss. Gate only identified Resonance bonus ordinals after the existing accuracy result and synchronize activation/priming. No extra RNG, ordinary Skill cost/cooldown changes or client outcome authority. Hits fully absorbed by Barrier still count.
- Input feedback: deliberate commands already send directly to the server; painting a transient planning path/selection/focus rectangle during acknowledgment caused the visible pre-command box. Remove that feedback while retaining legal range, normal actionable focus and duplicate/pending/version guards. Network acknowledgment is still authoritative.
- Tab: capture plain Tab/Shift+Tab only while playable/spectator battle is mounted; retain modified browser shortcuts, action keys, typing and Escape. Cleanup restores normal behavior outside battle.
- Copy: replace retired numbered and raw-event export with the same viewer-safe Chronicle model, headings, pinned narration and outcome wording. Include all history, including collapsed rounds; both completion readers/copies use the same names/options. Pinned summon identities and Covert privacy remain intact.

## Observed verification

Meaningful failing regressions were observed before Guard, Resonance, clipboard, Tab and Details repairs. Focused preview/content tests pass (48), including recipient status/interaction and null-primary ground terrain regressions. Independent review verified 55 engine tests and 74 web tests without blockers. Separate full core and web runs passed during integration; these are not the frozen final candidate gate.

The frozen local `pnpm check` passes formatting, lint, all package typechecks, 3,872 Vitest tests plus seven Node checks and production builds. Independent follow-up review found no remaining blockers after preserving recipient outcomes and ground terrain. Exact-candidate CI, browser screenshots/video, merge and Production receipt remain pending. The production renderer fixture verifies request startup in the same input event while holding previews/commits, range/focus/deduplication, Tab scope and unmount restoration across desktop/mobile PvE/PvP/spectators. Local Chromium is unavailable; prepared browser checks run in CI rather than claiming local execution.
