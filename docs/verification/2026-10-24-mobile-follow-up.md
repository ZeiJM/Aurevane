# Owner UI follow-up — October 24, 2026

## Status and source

Implemented on `agent/mobile-battle-space-20261024`, based on production PR #975 merge `89a730a1b2df0e7fadcdaf4a566166e0e266ce64` (tree `7f4dbb3b9ce5a9270bf490787533f472d1f414c0`). GitHub's authenticated browser checks remain required before release. This follow-up has not been merged or deployed.

## Owner-approved changes

- Mobile battle: add crest/AP spacing, compact Victory Conditions, shorten character summaries, enlarge cockpit artwork and tighten its rows/captions.
- Reduce mobile token facing markers to a tile-relative 8–10px. This explicit Owner request supersedes the prior 12px mobile minimum. Desktop minimum, tile containment, corner placement and noninteractive direction markers remain guarded.
- Show one preview information button after cockpit selection. It opens that selection's full report directly. Keep every existing report, disabled/passive/empty-slot reading, hardware-reader shortcuts, nested dismissal, focus restoration and command guards.
- Enlarge lobby VS and position it on the actual formation seam for duels, larger teams and wrapped third factions. Remove lobby-only Chat and allocate the remaining action row to Leave/Ready.
- Center the Profile Rekindling Cycle number below its label.
- Rename navigation Loadout to **Arsenal**; retain URLs, saved-loadout APIs and the Nexus/Items switcher. Remove the duplicate page heading above that switcher.
- Remove the AP crest from desktop battle markup, retaining mobile presentation.
- Keep complete preview text visible, including final-facing controls and longer desktop instructions.

## Implementation and diagnosis

The contextual information provider delegates selection at the shared battle root. It exposes one keyed reader while keeping all twelve existing reports mounted for shortcuts. It does not submit gameplay commands. The current action/version synchronizes keyboard selection, including selecting the same action after reading an empty slot. Open readers retain their input ownership; closed information triggers allow deliberate combat shortcuts again.

Desktop crest removal uses the existing responsive layout hook rather than competing with the global brand display rule. The desktop economy copy becomes the actual first child, preserving the shared header authority's compact geometry.

A permanent text-range guard reproduced real clipping at 844×390: final-facing glyphs extended to y171.421875 while the preview ended at y168.375. The short landscape override allocated only 3rem for two content rows plus padding. Its preview now uses the same 4.2rem budget as portrait. Desktop retains a 2.75rem minimum and can grow for wrapped or larger instruction text instead of cropping the last line. The regression checks complete text glyphs, all four controls, unchanged normal facing/terrain board geometry and exactly one authoritative facing request.

The Profile rendering guard also reproduced the desktop cycle copy being laid out horizontally: a later media rule used flex. The cycle copy explicitly uses a centered grid while the other identity facts retain their layout.

Lobby selectors account for existing duel-specific rules. Side-by-side formations center VS on their horizontal seam; a stacked duel or wrapped third faction centers it in the vertical gap. Short landscape lobbies retain bounded scrolling and visible action controls.

## Verification

- Full shared production-component browser regression passed across PvE/PvP at 1920, 1366, 1024, 821, 390, 320 and 844-landscape, plus spectator desktop/mobile cases. Existing movement, attack, pending/repeat, terrain, artwork, keyboard and single-submit checks remain intact.
- Focused final native-helper/selection probe passed PvE/PvP at 320px, including all twelve reports, actual native helper selection, same-action keyboard reselection, cancellation, nested reader dismissal and final facing. The clipping correction separately passed both playable modes at 844×390.
- Battle Hall production fixture passed seven existing sizes; lobby production fixture passed twenty mode/viewport combinations (1v1, 2v2, 3v3, 1v1v1 × 1440, 1366, 390, 320, 844-landscape). Profile/switcher rendering passed at 1440, 1366, 390 and 320.
- Formatting, lint, all eight package typechecks, 12,363 Vitest tests and seven Node checks passed. Production build passed after the local dependency-path repair described below.
- Native Playwright discovery found 642 cases in 94 files. Native authenticated suites require GitHub CI; local Docker is unavailable. Their relevant selectors, contextual-reader helpers, focus expectations and explicitly changed mobile marker sizes are updated.
- Read-only independent review found no remaining Critical or Important production issues. Its stale native 12px expectation finding was corrected without removing containment, direction, meter or authority assertions.

The initial recovered-workspace build could not resolve Next.js because temporary dependency symlinks escaped Turbopack's workspace root. Dependencies were copied into the isolated checkout; no application or deployment configuration was changed to repair this environment issue.

Logs: `/tmp/av-recover-check.log`, `/tmp/av-recover-build.log`, `/tmp/av-recover-types-final.log`, `/tmp/av-recover-full.log`, `/tmp/av-recover-nativehelper.log`, `/tmp/av-recover-landscape.log`, `/tmp/av-recover-lobbies-final.log`, `/tmp/av-recover-native-list.log`.

## CI expectation follow-up

The first PR #977 head `00ff9e90972779148d1ab70d244493a7ad034cc7` completed five workflows successfully and failed four on three stale test contracts:

- Desktop Page Fit `40093301910` and Desktop Experience `40093301908` both expected the cycle value beside the label. The native guard now requires it centered below the label at every tested breakpoint, matching the approved presentation.
- Controlled Combat `40093301916` waited for the removed preview-menu summary. Its captured-action cases now open the current contextual information button directly and assert that exactly one button is visible and no all-report menu remains. Captured costs/effects, readiness, commands and authority assertions are retained.
- Browser Smoke `40093301907` required the former marker minimum in its early production targeting probe. Actual mobile badge/SVG dimensions were 8.125px/6.125px. The guard now enforces the approved 8–10px mobile range using the actual responsive query, retains the 6px SVG floor, and retains desktop size, containment, direction, identity and noninteractive checks.

The `61414251` follow-up changed only tests and this receipt. Application source at that head was unchanged from `00ff9e9`. No retry was launched on the failed head.

Fresh local verification passed: all 76 production targeting cases, all 57 canonical Controlled cases, seven Hall sizes, twenty lobby combinations and four Profile/switcher sizes, including the new centered-and-below cycle assertion. Scoped formatting/lint and web typecheck passed. Independent read-only review found no actionable issues and no further stale expectations in the targeted script/native scan. Authenticated native browser cases still require fresh GitHub results.

Evidence: `/tmp/av-followup-targeting-red.log`, `/tmp/av-followup-targeting-green.log`, `/tmp/av-followup-controlled-green.log`, `/tmp/av-followup-profile-green.log`, `/tmp/av-followup-checks.log`, `/tmp/av-followup-lint-final.log`, `/tmp/av-followup-format-final.log`.

## Browser Smoke follow-up on 61414251

Head `61414251bb24a06cfe6f28bd8cc2e42ed29226c9` completed eight workflows successfully. Browser Smoke `40115047499`, job `120934488959`, completed with six failures in its focused authenticated phase: 70 passed and 22 intentional project skips. The full serial suite was not reached. The failures were not World timing failures and no retry was launched.

Three causes were diagnosed and reproduced before repair, preserving all six native assertions:

- The adaptive preview's 14px/1.4 title made a two-line PvP turn title consume 47.6px, while a one-line PvE title retained the 44px row. Native battlefield height drift was 3.6px; the production fixture reproduced preview 44/47.5625 and battlefield 449.921875/446.359375. Using the existing 1.2 title line-height allows both normal title lines to fit within the same 44px minimum while retaining wrapping and growth for larger text. The new parity guard retains the native 1.5px tolerance and all glyph containment checks.
- The lobby override had reduced desktop VS from its existing 144px minimum to 112px. The override now preserves 9rem/144px desktop artwork and the enlarged 56px phone artwork. Both permanent/native size requirements and seam/containment/identity checks remain enforced.
- A window-capture Escape handler in the Tab-cycle guard queued root focus after the information reader had already restored its contextual trigger. The production fixture reproduced the active battle root after closing Items, and the new unit guard failed on the same delayed overwrite. The handler now preserves a restored contextual trigger only when Escape began with an open reader. A later Escape still releases it; desktop dormant controls and nested-reader ownership retain their behavior.

Permanent production checks now verify the exact contextual trigger after every report dismissal and after programmatic replacement of Inspect with Basic Attack, plus wrapped-title parity and the desktop/mobile lobby size floors. New unit cases cover first/second Escape, desktop release and retained parent readers.

Focused final verification passed PvE/PvP at native 412×839 and 844×390, all twelve reports, keyboard reselection, nested dismissal, final facing and wrapped-title parity. The complete Hall/lobby/Profile fixture passed seven Hall sizes, twenty lobby combinations and four Profile/switcher sizes. The 47 adjacent keyboard/reader unit checks passed. Read-only review found no Critical/Important issues.

Formatting, lint and all eight package typechecks passed. The first local umbrella run completed the other core package tests and 204 database tests, then a database fork exited; the host recorded an OOM kill. No database source changed. The unfinished six-case database file and full web tests are being verified separately with bounded workers; final results are recorded in PR #977's validation description before release. The umbrella command is not reported as a clean exit.

Shared browser coverage passed across all playable viewports, including the strict contextual focus and reader-replacement checks, and the targeted spectator viewports. The initial combined run timed out only while capturing a screenshot during the concurrent resource-heavy tests. Its remaining PvP/spectator cases passed in a separate run; only local artifact capture had a longer deadline, with all gameplay/layout assertions unchanged. Permanent capture/assertion deadlines are unchanged. The native authenticated six-case rerun remains required on the new GitHub head.

Evidence: `/tmp/av-focus-614-red.log`, `/tmp/av-parity-614-red.log`, `/tmp/av-escape-614-unit-red.log`, `/tmp/av-focus-parity-green.log`, `/tmp/av-smoke614-unit-green.log`, `/tmp/av-smoke614-lobby-green.log`, `/tmp/av-smoke614-browser-green.log`, `/tmp/av-smoke614-check.log`, `/tmp/av-smoke614-browser-remaining.log`, `/tmp/av-smoke614-db-bounded.log`, `/tmp/av-smoke614-web-bounded.log`. Downloaded native evidence is retained at `/tmp/aurevane-smoke-61414251.zip`; selected traces are extracted under `/tmp/av-smoke614-evidence`.

## Release constraints

No preview/staging deployments. `apps/web/vercel.json` retains `git.deploymentEnabled["**"] = false`. No gameplay, migrations, catalogue publication, production data, environment or unrelated World/Master/Staff changes. PR #933 stays separate and unmerged; its timing acceptance is unresolved. Human signed-in/physical-device/multiplayer acceptance remains open.

Refresh actual main and branch heads before publication/merge. Required configured checks must pass on the final source. Production deployment remains a separate Owner-controlled step. The previous production release at https://aurevane.vercel.app remains unchanged.

PR #976 separately records the Owner-approved change-scoped verification policy. It remains unmerged; its CI optimization checklist has not been implemented and does not bypass configured gates.
