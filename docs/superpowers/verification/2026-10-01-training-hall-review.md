# Training and Battle Hall live-review refinement — 2026-10-01

The Owner requested removal of the Training “Same steps. A farther horizon.” copy, a restored compact Spectate entry at 100% desktop zoom, and shortening AI Battles’ empty parchment.

## Diagnosis and change

Fresh base: `1c591bb0fb2872bdc17594c90a0f128b15e00c77`. The Training request identifies the decorative right-hand header copy; the useful Passive Training heading, cloister background, plans, active session and inline reports remain. Its unused styles are removed.

The final Hall composition bottom-aligned Spectate’s workspace, leaving 123–273px between its tabs and panel at representative desktop sizes. Its previous fit change also placed the access-note emblem on the far left. AI’s forced full-height workspace reserved 130–314px after the last control. A local render of the actual components and production CSS reproduced these geometry failures before the fix.

Spectate is now placed immediately below the tabs, its emblem and note are centered again, and its banner, padding and gaps are reduced. AI uses intrinsic content height. Short desktop Hall headings and tabs are compact, with narrow short-window AI options preserving readable text. Phone layout retains its natural flow. Launch modes, values, callbacks, private access and authoritative game state are untouched.

The existing authenticated Hall regression now guards adjacency, centered Spectate emblem and at most 24px unused AI parchment in addition to its existing overflow, readability, usable-target and control-containment checks. AI and Spectate also exercise 1024×768 and 1024×576. Existing Training idle/active/report/claim coverage remains.

## Verification

A temporary local synthetic render checks AI and Spectate at 1728×885, 1440×900, 1366×768, 1536×614, 1280×720, 1024×768, 1024×576 and 390×844. All seven desktop sizes show no document/main/panel/body overflow, all controls at least 44px and contained, no tab-to-panel gap, centered Spectate note, and AI parchment ending within 24px of its controls. This checks presentation with fixture identity, not authenticated persistence. The final exact-candidate CI and release evidence are recorded below.

## Additional Owner battle live review

The same authorized release includes the Owner's later request for circular grid tokens, a shorter cockpit, smaller info/hotkey markers, compact facing and single-row HP/MP, bottom effects without summary scrolling, and a smaller fixed preview without its info button.

An actual-component render with a custom URL reproduced the oversized map image: the legacy AI `BattleFeedbackAssist` injected a second intrinsically sized portrait into the native token. The shared refined controller already owns its custom portrait/fallback, so legacy injection now skips that surface. The canonical token remains circular and contained. No portrait URL support is removed.

Shared command markers are 18px. End Turn reserves one compact bottom row with its info/hotkey beside the four facing controls; opening it does not grow the command deck or board. Desktop rail cards reserve identity, inline resource bars and two rows of effects; the portrait adapts to available space. Terrain samples use compact image/label rows. Short desktop headers, footer padding and command art also adapt. Applicable card/terrain/preview geometry flows to spectation. The preview's desktop track is fixed at 68px; canonical parameters and exact server outcomes, target images, issues and interaction descriptions remain in keyboard-readable inline lanes. Skill information stays in the cockpit. No combat, targeting, authority, progression or audio rules change.

The authenticated forecast regression now provisions custom portraits through the actual account flow, checks token/image containment, zero card overflow, inline resource bars, cockpit containment, the fixed preview, and stable board geometry with final facing open. Preview-specific tests keep their outcome checks and read full authored parameters through cockpit information after removal of the duplicate preview button.

The first six-file Hall/Training candidate `df1eb96dc36ec9372f9eaf25dbf5a68b213ad6fb` passed all six applicable workflows, including 37 early/254 full Chromium browser scenarios and four Edge checks, 104 authenticated UI checks (61 intentional skips), plus one directory check (two intentional skips). That candidate is superseded by this expanded battle patch and is not itself a Production release. Its local full gate passed 3,094 Vitest tests, seven Node checks and Production builds. An exploratory synthetic legacy Training fixture overflowed by 17px, identically on the unchanged baseline; the authenticated Training suite passed. This inherited fixture/font limitation was not used to claim a new regression or broaden the requested work.

The final actual-component matrix passed all 36 AI/PvP/spectator states at 1917×987, 1366×768, 1536×614, 1024×768, 1024×576 and 390×844, both ordinary and six-terrain/twenty-effect fixtures. Desktop checks include loaded custom-image token containment, circular tokens without duplicate injection, zero summary overflow, contained bottom effects, square portraits of at least 32px that do not overlap HP/MP, terrain-key and rendered label-line containment, command/facing containment, and stable board dimensions with End Turn open. Populated two-action logs exercise Timeline/Text and All/You/Opponents with contained pagers and tracks greater than 24px; Skill parameter/outcome chips fit vertically inside their lanes. Phone states retain natural vertical flow without horizontal document overflow. This is synthetic presentation evidence; authenticated persistence/gameplay remains covered by the required CI.

Review exposed and corrected a populated-log regression during implementation: reducing its allocation without compacting controls hid filters/pagers. The native desktop log now has compact header/view/filter/pager rows, retains the ordinary 11rem minimum, and uses an 8rem minimum only on short desktops. Its complete pager text remains available through the DOM and title. The final matrix passed the original strict containment guard. Portrait sizing now uses the actual reserved grid row rather than a heuristic height subtraction, preventing resource overlap; its height is also bounded by the card inline width to preserve a square at narrow desktop sizes. Terrain labels wrap within their buttons; desktop samples use 18px icons, with 14px icons on narrow desktops to preserve whole-word label wrapping. At 821–1100px width and at most 620px height, a 44.8px masthead and 44px cockpit art preserve usable portrait space; larger desktop presentations retain their normal sizes.

The frozen local gate passed formatting, app/package lint, types, 3,094 Vitest tests, seven Node checks and Production builds. The final gate was invoked individually because the aggregate script returned without running its children in this workspace; successful Turbo cache replays were inspected for lint, types, tests and builds, and formatting plus package lint ran directly. Focused presentation tests also passed. Independent review found no P0/P1/P2 blockers. Final exact-candidate CI and release evidence are recorded below.

The expanded candidate `dad1aadc7150dfe0d0bd6cff8ea1db7883d87fa8` passed CI, Desktop page fit and Desktop experience; authenticated UI page inspection also passed before evidence upload completed. Buildcraft/Browser Smoke exposed two stale test contracts: forecast duration/team wording was still asserted inside the authored Skill dialog after removal of the preview popup, and the older shared geometry helper required the maximum navigation portrait size regardless of available row height. The test revision preserves the exact server forecast duration/team assertions in the inline outcomes lane and authored effect checks in cockpit details. Portrait sizing is checked against the minimum of navigation limit, rail width and allocated image row, with additional square/minimum-32px/non-overlap/no-scroll checks. No application code changes are part of this correction; fresh exact-head CI remains required. Direct lint of the ground-targeting test also exposed its pre-existing `no-unsafe-finally` cleanup warning/error, identical on main; cleanup behavior is preserved.

## Final verification and release

Final candidate `8d0e5f5479f6199f646a49fe362383296726af32`, tree `0f478454d4b5bf249b26a762f3047467d6a5f491`, passed all six applicable workflows:

| Workflow | Run | Result |
| --- | --- | --- |
| CI | 36853280442 | Success |
| Desktop page fit | 36853280545 | Success |
| Desktop experience | 36853280478 | Success on retry |
| Representative Buildcraft | 36853280458 | Success |
| UI layout review | 36853280487 | Success |
| Browser smoke | 36853280449 | Success |

Browser Smoke passed 37 early scenarios (13 intentional skips), 254 full Chromium scenarios (199 intentional skips) and four Edge checks. UI review passed 104 authenticated checks (61 intentional skips), plus one directory check (two intentional skips). Its saved actual AI/PvP screenshots at 1366×768 and 1536×614 were inspected: custom portraits remain native circular map tokens, rails fit, terrain names wrap by whole words, and command/forecast composition is compact. Desktop experience passed 48 checks (27 intentional skips) on retry. Its initial run encountered two matching rail cards during a character-creation route transition; the application was unchanged from the preceding passing candidate, so the failed job was rerun without a source patch. The retry passed. This is recorded as a transient test/navigation failure, not a new application defect or independent human study.

Independent final review found no P0/P1/P2 blockers. The final 36-state matrix checks square portraits of at least 32px, exact reserved-row sizing, non-overlap with resources, contained rendered terrain text, stable board dimensions, compact command/preview tracks, all six populated log combinations and phone flow. A separate reviewer recomputed exact portrait expectations across 30 desktop states, with a maximum difference of 0.0063px. All original forecast duration/team effects, single-mutation/AP/audio and server terrain assertions remain after their surface adaptation.

PR #784 merged at `1dc2b9d9a51ba8130f74854a7738e3281905f238`. Fresh main was unchanged from the inspected base, and the actual merged tree equals the tested tree. Configuration-only PR #785 adds main deployment permission while retaining the wildcard lock; its actual release merge `9071c392012c33bbc2b3f27207e163bd9c6eb48d` has tree `01f1797da3538347d67b1983932d957b62e40f52` and contains identical application bytes. Vercel deployment `dpl_AHYNwyudrkLCehktPYP3auX1iqDF` reached READY at **2026-10-01 11:45:51.727 UTC** from that exact source, with `aurevane.vercel.app` assigned and no alias error. Immutable deployment: https://aurevane-c78s9dqwx-zeijms-projects.vercel.app/.

Live public entry, Manual, Rules and News returned HTTP 200. Browser verification showed the enabled Enter AUREVANE action, Manual search for “battle” reducing the list to Battle Hall & Action Economy, Rules content and the intentional News empty state. Browser diagnostics contained only extension-origin metadata errors; no application-origin warnings/errors were observed. The deployment-scoped warning/error/fatal count scan was empty for **2026-10-01 11:45:51.727–11:48:49.301 UTC**.

This documentation/configuration follow-up restores `deploymentEnabled: {"**": false}`. No application change, Production migration, privilege change or combat-content activation follows the verified release. Authenticated gameplay/persistence was verified in disposable CI; no Production sign-in or real-user multiplayer/visual acceptance is claimed.
