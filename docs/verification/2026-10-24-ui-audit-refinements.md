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
