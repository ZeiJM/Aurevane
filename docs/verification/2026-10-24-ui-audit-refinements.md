# Owner UI audit refinements — October 24, 2026

Owner authorized these refinements and one final production release for testing. Git-triggered deployments remain locked. This batch has no migrations, catalogue publication, or combat-rule changes.

## Implemented scope

- Desktop cockpit uses twelve evenly spaced slots with End Turn last; Discipline captions retain full glyph height and can wrap.
- Final facing uses only the existing preview controls, now red. Touch controls show artwork and compact action names; hotkeys and secondary captions stay in desktop presentation. Locked Items no longer adds a Coming soon row.
- Mobile parameter readers move into the preview's information menu. Escape, outside dismissal, rotation and shortcut ownership preserve command safety.
- The compact battle header uses the shared gold Aurevane crest, aligns the countdown with the AP bar, and retains full objective text height.
- Combatant resources have a right inset; effect scrollers retain access without a visible scrollbar rail. Portrait images and placeholder letters are centered. Tile facing/elevation annotations scale with their tiles.
- The mobile Chronicle current-round badge keeps its existing allotted width and height, using a gold background with Current: above Round X. Chronicle artwork resolves recorded action IDs, supports Resonance artwork and gives Defenseless a broken-shield image; unknown events use a neutral Chronicle image.
- Mobile Chronicle details replace the cockpit, with a separate scrolling reader and red close control. Selecting the same action closes it. Terrain/history switching and failed refresh cleanup restore action access.
- Terrain uses compact choices in the cockpit and current-snapshot explanations in the status preview on desktop and mobile; it preserves battlefield geometry.
- Navigation says Arena. The Sparring field selector says Field, and selected practice modes use a strong teal/gold treatment on all layouts.
- Switch Character shares the compact header and centered Account control. Mobile Discipline commits omit the success bar while preserving errors and pending feedback.
- Technique artwork/names are centered; Support uses the same eight cells as the Discipline libraries. Preview actions occupy a fixed boundary beneath the independently scrolling details.
- Mobile World lists use the available width. Multiplayer lobbies use compact settings and side-by-side team formations with fixed footer actions.
- Mobile Audio controls fit the page without scrolling, including small portrait and landscape layouts. Account omits the currently open Audio destination.

## Validation entry points

- `pnpm check`: repository formatting, lint, types, tests and production build.
- `battle-command-feedback-browser-regression.mjs`: shared PvE/PvP cockpit, facing requests, information/terrain reading and keyboard/rotation behavior.
- `battle-mobile-panel-browser-regression.mjs`: fixed frame, terrain/history transitions, failed-history recovery, Chronicle growth, Guard and chat layout.
- `management-mobile-browser-regression.mjs` and `battle-launch-browser-regression.mjs`: management commit behavior, cell geometry, fixed preview boundary, Hall labels/highlight and participant settings.
- Native authenticated Playwright coverage includes the corresponding navigation, roster, technique, terrain, Chronicle, support-action and Audio flows. Exact-head CI and production deployment receipts remain the release authority.

Physical-device and signed-in Owner acceptance follow the final production release; automated checks do not substitute for that testing.

## Browser Smoke follow-up on a46ff15d

All twelve other workflows passed. Browser Smoke run `40063742058`, job `120783032969`, completed its focused authenticated phase with 71 passed, 22 intentional project skips and five failures before the full serial suite. The five cases exposed three causes:

- The desktop Terrain scale helper required an obsolete nested icon span. It now checks the same visible `▲ Terrain` label, retaining all geometry/parity assertions.
- The empty Skill slot's fixed 2rem plus glyph imposed an intrinsic minimum height larger than mobile artwork. Its minimum height is released and glyph scales within the existing frame; the one-pixel square and equal-size assertions remain unchanged.
- Closing mobile Skill information hid its trigger before focus restoration. The menu now returns focus to the battle after its primary reader closes, while preserving a surviving parent report's linked-term focus when only the nested explanation closes.

Exercising all twelve readers also reproduced the last mobile PvP menu option behind the Chronicle strip. Menu placement now uses the actual shared content boundary and remains scrollable within its existing 14rem maximum. Toggle and resize listeners clean up on unmount.

The native cockpit test retains desktop alignment and complete reader/containment/AP assertions. On mobile it explicitly verifies hidden cockpit info/hotkeys and opens all twelve readers through the preview menu. The shared fixture browser guard now covers empty squares, the final menu choice, focus restoration, and nested Escape/outside dismissal without activating underlying actions. Both original defects were reproduced in production PvE/PvP fixtures; the nested regression also fails when its child-reader guard is removed through a test-only Vite transform.

Post-repair local verification passed: complete `pnpm check` (format, lint, eight package type checks, 12,363 Vitest tests, seven Node checks and production build), full shared command-feedback browser regression across PvE/PvP/spectators, all twelve native reader assertions in eight production-fixture layout/mode combinations, and discovery of all 21 entries in the four affected native suites. Independent review approved the repair after correcting nested-reader focus ownership. Current main remains `bea72528c26ad0fbc7ebfafa73f395db284fa3d2`. Fresh authenticated checks on the repair commit still gate merge and the one production deployment.

## Mobile facing readability follow-up on 68cfd6c9

Browser Smoke `40066609881`, job `120791093569`, passed 74 focused cases with 22 intentional project skips, but failed the two mobile PvE/PvP presentation cases before reaching the full serial suite. Both retained the existing 12px minimum facing-marker assertion: actual widths were 11.1875px and 10.203125px. The mobile tile-relative override used `min(34cqw, 0.7rem)`, capping markers below the shared indicator's readability floor and shrinking them further on small tiles.

The shared mobile override now uses `clamp(12px, 34cqw, 14px)` for both dimensions, preserving proportional sizing, tile geometry and noninteractive corner placement. The command-feedback fixture browser guard now checks the existing 12px minimum and tile containment on mobile PvE/PvP. No native assertion was relaxed. A focused production-fixture probe reproduced 11.1875px before the fix, then passed size and corner containment for PvE, PvP and spectators at 390px, 320px and 844px landscape. Fresh full local validation, independent review and all thirteen newest-head workflows remain required before release.

The permanent fixture guard also failed before repair with the same 11.1875px value, then the full shared command-feedback browser regression passed on final source. Independent read-only review approved the repair with no correctness blockers. Complete `pnpm check` passed, including 12,363 Vitest tests, seven Node checks and production build. The initial build could not read the disposable Turbopack persistence cache; setting that cache aside and repeating the unchanged-source full gate resolved the local build error. Logs: `/tmp/aurevane-facing-red.log`, `/tmp/aurevane-facing-browser-green.log`, `/tmp/aurevane-facing-focused-green.log`, `/tmp/aurevane-facing-quality.log`, `/tmp/aurevane-facing-quality-clean.log`. GitHub's authenticated newest-head checks still gate release; no deployment has been created.
