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
- Battle Hall production fixture passed seven existing sizes; lobby production fixture passed sixteen mode/viewport combinations (1v1, 2v2, 3v3, 1v1v1 × 1440, 390, 320, 844-landscape). Profile/switcher rendering passed at 1440, 390 and 320.
- Formatting, lint, all eight package typechecks, 12,363 Vitest tests and seven Node checks passed. Production build passed after the local dependency-path repair described below.
- Native Playwright discovery found 642 cases in 94 files. Native authenticated suites require GitHub CI; local Docker is unavailable. Their relevant selectors, contextual-reader helpers, focus expectations and explicitly changed mobile marker sizes are updated.
- Read-only independent review found no remaining Critical or Important production issues. Its stale native 12px expectation finding was corrected without removing containment, direction, meter or authority assertions.

The initial recovered-workspace build could not resolve Next.js because temporary dependency symlinks escaped Turbopack's workspace root. Dependencies were copied into the isolated checkout; no application or deployment configuration was changed to repair this environment issue.

Logs: `/tmp/av-recover-check.log`, `/tmp/av-recover-build.log`, `/tmp/av-recover-types-final.log`, `/tmp/av-recover-full.log`, `/tmp/av-recover-nativehelper.log`, `/tmp/av-recover-landscape.log`, `/tmp/av-recover-lobbies-final.log`, `/tmp/av-recover-native-list.log`.

## Release constraints

No preview/staging deployments. `apps/web/vercel.json` retains `git.deploymentEnabled["**"] = false`. No gameplay, migrations, catalogue publication, production data, environment or unrelated World/Master/Staff changes. PR #933 stays separate and unmerged; its timing acceptance is unresolved. Human signed-in/physical-device/multiplayer acceptance remains open.

Refresh actual main and branch heads before publication/merge. Required configured checks must pass on the final source. Production deployment remains a separate Owner-controlled step. The previous production release at https://aurevane.vercel.app remains unchanged.

PR #976 separately records the Owner-approved change-scoped verification policy. It remains unmerged; its CI optimization checklist has not been implemented and does not bypass configured gates.
