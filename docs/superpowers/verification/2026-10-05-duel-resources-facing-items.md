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

Chromium installation in this workspace returned truncated/empty archives; the local browser script could not launch because the executable was absent. This is not a passing browser receipt. Existing CI browser infrastructure installs actualChromium/Edge. Extended command fixture covers desktop1366, tablet1024/821 and mobile390 for PvE/PvP plus read-only spectators, preserving artwork square dimensions, ordering, no overflow, inertP and existing direct-command/Tab guards. Full exact-head CI/browser/database checks must pass before merge/release.

Production source/READY/alias/public HTTP/runtime-log and restored-lock receipts will be recorded after the authorized combined release. PublicHTTP success alone is not authenticated gameplay or Owner visual acceptance.
