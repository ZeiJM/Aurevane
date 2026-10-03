# Battle popup, narration and portrait refinements

Owner requested changes are implemented on `agent/battle-popup-log-portrait-20261003`, based on current Main `cfe4dbf96cc9bec17111ddcfafe4deff9b0a4106`. Main was refreshed before implementation and finalization and did not advance. Deployment remains disabled in `apps/web/vercel.json`.

## Behavior

- Resonance uses the Skill's single aligned ten-field table. Requirements contains the setup matcher or N/A. Effects prefixes the trigger matcher and omits duplicate Self recipients. Mode, Setup and Trigger rows are removed. The shared adapter covers current, pinned and Master draft reports.
- Chronicle retains the first movement per character per round. Basic Attack's engine hit/miss receipt precedes `combat_action_used`; the reader now groups it under the same use rather than showing an orphaned outcome followed by an empty action. Hits without damage remain explicit. Missing historical results say `No outcome recorded.` rather than inventing damage or effects.
- Separate optional versioned `battleText` is editable for regular Skills, nested Essence Skills and every summon ability, with existing safe token insertion/preview and content validation/publication. Default prose is actor-led and derived from exact pinned content. Skill descriptions and catalogue flavor remain separate. Summon names/text use the preceding visible spawn receipt and exact parent version, including expired summons. Target pronouns use recorded identity. Missing explicit gender metadata remains neutral.
- Effect hovering retains the rich accessible popup and removes the duplicate browser-native title tooltip.
- Portrait & Title offers all 64 existing default portraits and a permanent confirmation. The server authenticates ownership and protects active gameplay sessions. The migration serializes the one-time change with a character row lock, records consumption, rejects a second different choice, and makes a retry of the successful choice idempotent. Selecting a default clears an existing custom URL atomically. Custom URL editing remains available separately.

## Verification

The final `pnpm check` exited 0: formatting, lint, TypeScript, 3,430 Vitest tests and production builds passed (unchanged package work reused Turbo cache). Regression coverage includes movement-only rounds/deduplication, pre-command misses and hits without damage, incomplete historical results, one rich effect tooltip, exact-version narration and summon names after expiry, safe token validation, separate Master action fields, portrait catalogue/ownership/consumption/receipt validation, authenticated API/session guards and the locked portrait controls.

A local Chromium harness mounted the actual shared React components at 1440×900 and 390×844 for both PvE and PvP fixtures. All four cases passed: ten aligned Resonance rows, no table overflow, setup/trigger placement, one rich effect dialog without a native title, retained Round 1 with one movement beat, a miss beneath Basic Attack, and immediate portrait lock after a mocked successful API receipt. No runtime page errors occurred. The final dark table was visually inspected at the phone breakpoint. These are shared-component fixture checks, not authenticated full battle-route or Production gameplay evidence.

The actual migration was executed against local PostgreSQL semantics using PGlite and minimal fixture tables/roles. Invalid defaults, foreign/deleted characters and unchanged initial selection were rejected. The first change persisted its portrait/timestamp and cleared the custom URL; an identical retry returned the same receipt; a second different choice was rejected; the authenticated role could not execute the privileged function. Real concurrent connections and the complete live schema were not exercised locally.

## Release boundary

No live database migration, content publication, merge or deployment is claimed. Before enabling the gallery, apply `supabase/migrations/20261003120343_character_default_portrait_choice.sql` through the normal authorized release workflow. Until its getter is available, the gallery fails closed while the existing title/custom-image controls keep working. Exact-head CI, authenticated integration and Owner visual acceptance remain release checks.
