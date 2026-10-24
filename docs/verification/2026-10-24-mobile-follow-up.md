# Owner UI follow-up — October 24, 2026

## Status and source

Owner-approved work in progress. This remote checkpoint records requirements and recovery details only; application changes are still uncommitted in the workspace and are NOT published or live.

Base: production PR #975 merge `89a730a1b2df0e7fadcdaf4a566166e0e266ce64`, tree `7f4dbb3b9ce5a9270bf490787533f472d1f414c0`.
Local branch: `agent/mobile-battle-space-20261024`.
Working tree: `/workspace/scratch/716e81302a24/Aurevane-mobile`.
The execution environment disconnected during verification. Recover and inspect the working tree before making new edits. Do not claim it is lost, complete, passing, committed or deployed without fresh evidence.

## Complete Owner-approved scope

1. Mobile battle header: shorten the AP bar from its left edge to add space after the crest; make Victory Conditions more compact.
2. Shorter mobile character summaries, allocating more room to the battlefield.
3. Smaller facing markers on battlefield tokens. This explicitly supersedes the previous mobile 12px minimum. Preserve visible direction, relative tile scale, containment and noninteractive behavior.
4. Preview information button appears only after cockpit selection and opens that selection's complete report directly. No menu of all reports. Preserve passive/disabled/empty-slot information without executing unavailable commands, hardware-reader shortcuts, nested-reader dismissal and command guards.
5. Larger mobile cockpit artwork; tighter rows, smaller captions where useful; remove excess blank space.
6. Larger, integrated lobby VS on the seam between formations, including more-than-two-player and three-team lobbies. Handle a wrapped third team explicitly.
7. Remove lobby Chat button and associated lobby-only panel; retain battle/site chat.
8. Center the Profile Rekindling Cycle number below its label (Owner called it resonance cycle; screenshot identifies Rekindling Cycle).
9. Remove duplicate Nexus/Items headings above the section switcher on both routes; retain the two switchable buttons.
10. Rename navigation Loadout to Arsenal (assistant's stated design choice, subject to any later Owner correction); keep route URLs and saved-loadout APIs unchanged.
11. Desktop battle only: remove the extra crest next to AP, retaining it on mobile and reclaiming its grid space.
12. Fix vertically clipped text at the bottom of the battle preview, specifically the desktop final-facing state in the last screenshot.

## Implementation already present locally — inspect before relying on this

- `battle-cockpit-info.tsx`: replaces the details/menu with one preview host. All readers remain mounted in hidden keyed wrappers; only the selected wrapper is visible. A delegated pointer/click listener on the battle root selects a slot without mutating gameplay; disabled/empty slots can be inspected. Visible wrappers use display:contents to avoid intercepting their own information button.
- `BattleCockpitInfo` requires selectionKey. Basic commands use slot; selected Skill controls use shortcutAction. `BattlePreviewInfoMenu` receives an actionKey from mode, active technique and infoSelectionVersion. clearPlanning increments the version, allowing explicit same-action keyboard reselection to update the contextual report.
- Closed preview-host focus no longer blocks combat shortcuts in `battle-keyboard-scope.ts`; open reports, native Enter/Space activation and other reading surfaces still retain their guards.
- Mobile CSS: crest/AP gap, compact Victory Conditions, 8–10px tile-relative facing markers, artwork based on clamp(1.5rem,min(11vw,7dvh),3.25rem), tighter content rows and shorter character rails.
- Small-phone reproduction found that the enlarged cockpit could center content beyond its allocated track. Latest fix uses align-content:start and lower-panel minimum calc(2 * artwork + 8rem), with explicit preview border-box/scroll containment.
- Lobby Chat markup/import/state and dead panel CSS removed; VS positioned relative to each teamWrap seam. Wrapped third faction spans the next row with a top-center VS; a narrow-screen specificity correction is included.
- Profile cycle CSS, Arsenal navigation label, switcher-only LoadoutHeader, and affected unit/native test expectations changed.
- Native information-menu helper now selects one card via pointer-down then releases outside, auditing reports without submitting gameplay commands. Actual tap/select/i/Escape interactions are separately covered by production fixtures.

## Verification and known outstanding work

- Before implementation, the permanent production-fixture guard reproduced the idle information-menu mismatch (1 visible control versus expected 0).
- Initial production browser probe passed PvE/PvP/spectator at390/320 portrait and844 landscape; later review found keyboard edge cases, since repaired.
- Read-only independent review identified stale keyboard info, blocked shortcuts after dismissal, and wrapped-third-team VS placement. All were addressed; final review after the later naming/desktop/preview changes remains needed.
- After the small-phone track correction, a focused copy of the permanent shared guard PASSED all PvE/PvP320 scenarios: all12 contextual reports, nested readers, action keyboard synchronization, explicit same-action reselection, cancellation, final facing, movement/attack gestures and single-submit guards.
- Lobby production fixture passed seven existing Hall sizes and16 lobby mode/viewport combinations before the last three-team320 layout refinement. Inspect `/tmp/av-mobile-lobby-evidence` and rerun affected lobby cases after final CSS.
- A full local gate ran once while further Owner requests arrived. Formatting/lint/types passed on its earlier snapshot; tests found3 failures: one negative assertion still forbidding Arsenal (corrected), plus two tab-label expectations during the mid-run rename. No final full-gate success exists; build was not reached.
- Latest desktop crest attempt FAILED the existing compact-header assertion: header85.34375px versus <=56px. The CSS-only display:none conflicts with the global brand display rule and header child-placement assumptions. Planned but NOT confirmed applied: conditionally render the crest with existing useDesktopBattleLayout; desktop economy uses one column; retain mobile override. Update the fixture crest assertion to mobile?1:0. Verify all desktop widths, not just1366.
- New permanent preview text-range containment assertion was added after final-facing screenshot capture, but the desktop header failure prevented reaching it. Reproduce the actual clipped preview before choosing a fix. Inspect shared preview grid row2.75rem in battle-approved-layout.module.css, previewFacing dimensions, and any injected instruction text. Preserve complete content and board/control boundaries.
- Temporary Profile/header rendering probe `apps/web/scripts/.profile-check.mjs` needs a next/link mock alias; its first run failed because real Next link expects process. Planned mock addition was in the interrupted command and is NOT confirmed applied. No rendered Profile verification is claimed yet.
- Temporary focused runner `apps/web/scripts/.focused-mobile.mjs` must be removed before publication. Refresh it from the permanent script for diagnostics; do not commit scratch probes.
- Current logs: `/tmp/av-mobile-polish-red.log`, `/tmp/av-mobile-polish-focused.log`, `/tmp/av-mobile-polish-browser.log`, `/tmp/av-mobile-polish-lobby.log`, `/tmp/av-mobile-polish-check.log`, `/tmp/av-profile-check.log`, `/tmp/av-preview-red.log`.

## Resume and publication

1. Recover workspace, inspect git status/diff and actual fresh main. The final interrupted shell call may not have executed at all.
2. Complete desktop crest and preview clipping fixes; verify Profile and Arsenal header.
3. Run affected rendered flows, all changed native test discovery/type checks, formatting/lint and final quality verification. Update tests to the explicitly approved UI contract without removing gameplay/authority/containment assertions.
4. Update this document with actual final evidence, inspect the diff, review and publish source to this same branch with expected-head protection. The remote branch currently contains only this checkpoint; avoid overwriting it blindly.
5. No preview/staging deployments. Git deployment lock stays false for all branches. No migrations, catalogue publication or production data/configuration changes. PR #933 stays separate/unmerged; its timing acceptance remains unresolved.
6. PR #976 separately contains the Owner-approved change-scoped testing policy; it is still unmerged and its CI optimization checklist is not implemented. Do not silently bypass configured gates.

The previous production release remains READY at https://aurevane.vercel.app, deployment `dpl_EytuTsQeu1YDZHzitYaZUEtvyjHW`. That release's monitor was disabled after success. No new worker or deployment has been created for this follow-up batch.
