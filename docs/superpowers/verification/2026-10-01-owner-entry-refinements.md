# Approved entry screens and gameplay refinements — verification

Owner-authorized work on `agent/owner-ui-refinements-20261001`, based on Main `491e687ed0dc9be364c136f2202b02e555a72cad`. Scope: `../specs/2026-10-01-owner-entry-refinements.md`. The Owner approved both generated entry concepts and explicitly authorized merge and Production deployment when verified. No schema or combat-content activation is part of this release.

## Implementation and preservation

The login gateway and Character Select gallery use four clean runtime image layers derived from the approved concepts; controls and text remain real DOM. Actual account portraits, authentication/email confirmation, slot entitlement, cooldowns, account deletion and cancellation retain their existing authority. Versioned media dimensions, sizes and hashes match provenance.

Profile offers six short per-axis tendency explanations through the existing stat-help popup. The chart starts below the metadata divider. Popup focus, Escape restoration and click-off behavior are preserved. Training reports now require a deliberate Claim after completion or stopping. Pending, failure/retry, stale-tab and character-change cases preserve idempotent claims and fresh authoritative snapshots.

Support Action uses the same heading and ten characteristic rows as Discipline Skills. Move, Basic Attack, Guard, HP Recovery and MP Recovery descriptions derive from existing combat rules. Battle reuses the shared SiteHeader; Audio is centered. Artwork is larger inside existing dock/map budgets, with six pixels of cockpit top space, equal empty/populated squares and fully contained final-facing controls. The preview stays 44px high and centered; terrain samples are wider without shrinking the board or forcing desktop scrolling.

## Local checks on the frozen source

- Two complete `pnpm check` executions exited 0: repository formatting, lint, types, 3,157 Vitest tests, seven Node checks and Production builds. The second execution followed the final source freeze; unchanged package tasks may use Turbo cache.
- Worker `check:boot` passed in once mode.
- Explicit ESLint of changed browser suites passed with no warnings.
- Changed browser suites discovered 51 cases across nine files; this is discovery, not execution.
- Actual mounted entry checks: 35 desktop state cases across 1280×720, 1366×768, 1536×614 and 1920×1080, including long names and pending/cooldown/account-deletion states. No desktop scrolling or horizontal overflow; mobile 390/320 has no horizontal overflow. Signup/error and deletion/cancellation intent checks passed with mocked service responses.
- Actual mounted battle checks: 28 PvP/PvE cases across seven viewport sizes and dense/empty states. Initial, armed and final-facing states preserve board dimensions; complete command boxes and facing arrows fit, artwork is square, and six terrain types fit. Dock baseline height delta is at most 0.25px.
- Techniques: 14 pure/mixed cases across seven viewport sizes, all ten detail rows and card names/types contained.
- Root repeated actual Profile checks at six viewports: six axis click/keyboard/click-off/Escape helps, spoke click, stat help, reset confirmation, 19 stats, divider alignment and desktop fit passed.
- Root repeated manual Training claim checks: stopping/natural completion issue no automatic claim; explicit success, failure/retry, duplicate pending click, stale report, cross-tab claim, delayed refresh and character-switch cases passed without runtime errors.
- Root repeated Audio/shared-header checks at six viewports: horizontal center offset zero, no heading overlap, no desktop main overflow; shared masthead 64px desktop and 84.8px mobile.
- Independent review found no remaining Critical or Important issues. It independently exercised 35 entry cases, keyboard/deletion/entitlement behavior and 24 desktop PvP/PvE cockpit cases, inspected final Techniques screenshots and verified all four media hashes.

## Evidence boundary

Mounted browser checks use actual components/styles and mocked server responses. Docker is unavailable locally; authenticated backend/browser/database evidence remains an exact-head CI gate before merge. No authenticated Production gameplay or Owner visual acceptance is claimed by these checks.

Existing best direct artwork sources are retained: inherent artwork is 1254², authored Skills/Essences/Resonances are 128²–160². Normal Nexus/Techniques cap is 88 CSS pixels, matching the class sigil; compact cards are bounded by available room. These existing authored sources have limited DPR2 detail; this release does not claim new high-resolution masters.

## Integration and release

PR #794 first head `00fc4854788a68b6051366b7cd19829a5fec6d24` matched local tested tree `3160d6bd17703ed508777238283c04fc1ff29a51`. Eight workflows passed. UI layout review and early Browser smoke exposed real account-frame overflow, account-menu obstruction, a forecast row with 20px intrinsic content in an 18px lane and a short-desktop portrait below the existing 32px floor. They also exposed stale radial-parchment and rigid-art-cap assertions. This head was not merged or released; the full Browser suite and Edge stage did not run after the early-stage failure.

The corrective patch sizes the decorative account SVG within the card, puts the shared battle masthead above ordinary battlefield layers, reserves 20px for forecast content inside the unchanged 44px strip, and reclaims short-card padding for the portrait. Existing containment and behavior guards remain; material assertions now reflect the approved parchment design and art guards check responsive caps, readable floors, equal squares and complete content containment.

A final populated Nexus check also exposed outer scrolling and management controls overlapping the Attunement row. The Arsenal layout now budgets actual row content and available height. Root repeated the full pure/mixed matrix: all four requested desktop sizes and both phone sizes have contained controls and artwork, without desktop scrolling or horizontal overflow. Overview/Support art is 80.42 / 88 / 68.73 / 88px on the four desktops. An authenticated regression now equips and reloads all four Skills before checking complete panel fit and a 64px artwork floor. Independent review also checked empty, long-label and valid mixed 2+2 loadouts.

The frozen correction passed another complete `pnpm check` and explicit E2E ESLint. Mounted account checks show internal overflow zero. The account menu reproduced an intercepted hit on the old source and now permits actual Controls & Keybinds clicks on desktop/mobile PvP/PvE. Two header tests passed. The final battle correction matrix passed 98 states (PvP/PvE × seven viewports × seven action states), including real Ice Lance and direct portrait URLs: forecast inner content fits, preview/map geometry stays fixed, portraits meet the desktop floor, and card content stays inside its bounds. The original CI forecast font/intrinsic-content difference was not reproduced locally; exact corrected-head CI remains the definitive check.

The final gallery review found locked-card outer padding reducing the artwork container height relative to active cards. Desktop locked cards now share the active sizing budget. Independent rendering across 14 pure/mixed cases confirms all 16 active/locked frames match: 88px on normal desktops, 66.70px on the short desktop, and contained responsive squares on narrow/mobile layouts. Names and all ten characteristic rows remain contained. The final complete `pnpm check` exited 0 with optional telemetry disabled, and the changed Techniques browser suite passed explicit ESLint. Independent review renewed its signoff with no remaining Critical or Important findings.

The next exact head `557a1c74def6f226b684e34c5aba0273ad000feb` passed eight workflows; UI layout review passed 104 scenarios with 61 intentional skips but failed three scenarios: two roster variants overflowed at 1024×576, a long name also overflowed at 1728×887, and Training did not return to Plan after a successful pending claim. Browser smoke was still running when the corrective work completed. This head was not merged or released.

The roster correction subtracts name/state overhead from both artwork limits, uses available compact-desktop board width and retains full names, readable text and all controls. The exact same-page ten-desktop plus two-mobile viewport sequence passed all 84 cases across seven states, including maximum-length names, pending deletion and cooldown combinations. No fit/readability assertions were relaxed.

Training now validates the server's successful claim identity and suppresses only the acknowledged report while the page refresh is pending. A reproduced held-refresh failure passes after the change. Missing/mismatched acknowledgments retain the report and idempotency key; later reports, characters and active snapshots remain authoritative. Independent review identified an out-of-order callback race, reproduced before the guard and fixed by checking the currently committed character/report before changing local state. Held-refresh, same-key retry, malformed/wrong-report/wrong-character acknowledgment, next report/character, stale active snapshot, late A after B claim and stopped-wait cases passed actual-component checks. Server claim/reward logic is unchanged. The authenticated regression now deliberately holds the post-claim RSC response and retains all existing assertions.

The final corrective source passed another complete `pnpm check` (telemetry disabled), including formatting, lint, types, 3,157 Vitest tests, seven Node checks and Production builds. Independent review is clear: it repeated all 84 roster cases with 876 artwork/name/paragraph/action child-bound checks (zero desktop scroll, no overflow/errors) and independently repeated claim acknowledgment and out-of-order response cases. Corrected-head CI, final Main freshness, merge identity, deployment source, live checks and restored deployment lock will be recorded after they complete. Current Production has not yet changed for this work item.
