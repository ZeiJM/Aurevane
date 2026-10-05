# Resource, duel, positional hit chance and Items verification — 2026-10-05

## Current scope and source

Fresh Main was40b999a4c0ff3bae49d7d54bfa30a375fad7e525 (previous released application plus deployment-lock closeout). Isolated branch: agent/level-100-duel-balance-20261005. The full deployment lock remains enabled during verification. No hosted migration, Auth/content mutation or production-account changes are part of this work.

## Local evidence

Resource expectations were changed first; actualV4 code failed six current-curve tests, thenV5 passed. Facing tests failed before the new factory existed and subsequently passed. New Items/customP expectations failed against the previous map and passed after the safe migration. HistoricalV4/older stat fixtures and encounter factories retain their explicit rules.

Final local pnpmcheck exits0: formatting, lint, all workspace typechecks,4019Vitest tests, seven Node checks, worker and production web builds. GameCore2293, web1579, validation62, database63, audio17, realtime3 and worker2. This includes canonical200seed legal Level100 four-Skill reference duels, direct-damage/old-policy projections, Basic and Skill front/side/rear committed hit chances and final0–100% clamping, Primary/current provenance and resource changes, lockedItems and safe customized controls.

Real-source reference mirrors use500HP and theirV5 MP pools, correct temporary Basic Attack damage, actualAP/cooldowns, front−5pp and pinned default tag timing. Independent audit reports Vanguard11.52 and Aetherist12.68rounds across100seeds each, pooled12.10. Physical range10–14; Mystic10–16. The benchmark intentionally does not force every build/rotation to twelve rounds. Legal balanced and Core60 offense builds remain meaningfully faster.

Independent review caught and verified repairs to an accidental fifth final-facing column and insufficient custom-key fallback candidates. Final application review has no remaining actionable findings. Serialization/normalization/resumed commands preserve the policy; current creation, AI/preview, critical, periodic/reactive, summon and Copy paths agree on scope.

## Browser and hosted verification

Initial candidate affba935bb0854fc4f2f5fa3d7bf3a04c013e3d3 passes full CI quality/database gates and the expanded desktop/tablet/mobile command geometry/control fixture. Desktop experience identifies one stale character-creation assertion on each of its three viewports: expected historical98HP, actual current174HP for starterVitality9. Update the current V5 starter expectations to174HP/44MP for Intellect3, with exact numeric readers. No application formula/layout change is needed. Final corrected-candidate hosted verification remains pending.

Downloaded actual command-fixture captures show correct unchanged artwork in PvE/PvP at1366/1024/821/390. The new Coming soon caption wraps into the footer at821; apply only the existing command-name font size and nowrap to that caption on desktop, then assert its entire bounds stay inside the cockpit. No artwork, card, map or rail size changes. Final exact-candidate hosted geometry and screenshots must confirm the repair.

Candidate3404c65a7c7d017ef60bbb2f6a2170cacf4d8fa2 passes the caption/control geometry regression, full quality/database gates,48 desktop interactions and24 representative buildcraft cases. Layout review passes109 scenarios but finds28px main overflow on Controls1366×768: the new22nd binding adds an eighth row. Downloaded screenshot/geometry confirms only the Save/Reset footer is obscured. Reduce only desktop binding row vertical padding from0.3rem to0.125rem, retaining13px text,44px buttons, complete descriptions, existing columns and mobile natural scrolling. The existing desktop editing/feedback fit matrix is the red regression; add explicit Items/P/locked copy assertions. Final corrected-candidate full hosted checks remain pending.

Candidate3b66933df0ae5750cc3a294a046241a2c45022e6 passes all110 UI layout scenarios, full quality/database gates and the other eight specialist workflows. Browser focused coverage exposes stale five-command/eleven-control expectations after Items adds the sixth/twelfth; update shared helpers, retain the artwork geometry assertions, and explicitly assert Items/P/disabled/Coming soon and order before Inspect. Actual failed mobile Guard trace shows the shortcut was pressed during the Recruit's opening turn: snapshot says Opponent turn and the Recruit response later yields the local turn. Synchronize the existing battle-entry helper on authoritative local-turn/enabled Guard before sending keyboard input; retain single-commit and repeated-key assertions. No game execution change or artificial delay is needed. Final corrected-head browser coverage remains pending.

Chromium installation in this workspace returned truncated/empty archives; the local browser script could not launch because the executable was absent. This is not a passing browser receipt. Existing CI browser infrastructure installs actualChromium/Edge. Extended command fixture covers desktop1366, tablet1024/821 and mobile390 for PvE/PvP plus read-only spectators, preserving artwork square dimensions, ordering, no overflow, inertP and existing direct-command/Tab guards. Full exact-head CI/browser/database checks must pass before merge/release.

Production source/READY/alias/public HTTP/runtime-log and restored-lock receipts will be recorded after the authorized combined release. PublicHTTP success alone is not authenticated gameplay or Owner visual acceptance.

## Final exact-head gate and merge

All eleven workflows pass candidate `add69fa3bb28a34da1e22d683eba0acab9d15415`, tree `b75f1f754b2986cc37e10d61cdb650a11222149a`: CI37325645246, Browser37325645484, Layout37325645260, Desktop37325645449, Buildcraft37325644895, Attribute37325644774, Profile37325645399, Shared snapshots37325645292, Resonance37325644764, Essence37325645401 and Skill Engine37325645230. Quality job111815573869 confirms4,019 Vitest tests, seven Node checks, lint/types/worker+web builds and clean source; the database job passes its authority gates.

Browser job111815574070 passes four ally previews, palette,28 elevation/privacy,54 completion,28 command/input,6 real-mail recovery,3 training,71 focused,317 full Chromium and10 Edge cases. Layout job111815573970 passes native mobile Profile swiping,110 scenarios and the directory case. Desktop48 and Buildcraft24 pass. Existing project-specific skips remain unchanged. Actual corrected Controls1366×768 geometry reports0 page/main/grid vertical overflow, complete13px descriptions and44px buttons; screenshot shows Save/Reset fully above the footer. Final application bytes are unchanged from that captured source. Previously reviewed821px PvE/PvP caption captures preserve artwork and fit inside the cockpit.

Fresh Main remains40b999a4c0ff3bae49d7d54bfa30a375fad7e525 immediately before integration. PR #833 merges as `6b67389fab84d31b82854ab943063413b448bd27`, with the identical tested tree. The full deployment lock protects the implementation merge. The following configuration/documentation-only step enables the one explicitly authorized Production release; live proof and lock restoration remain pending.
