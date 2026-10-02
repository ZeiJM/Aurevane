# Approved entry screens and gameplay refinements — verification

Owner-authorized work on `agent/owner-ui-refinements-20261001`, based on Main `491e687ed0dc9be364c136f2202b02e555a72cad`. Scope: `../specs/2026-10-01-owner-entry-refinements.md`. The Owner approved both generated entry concepts and explicitly authorized merge and Production deployment when verified. No schema or combat-content activation is part of this release.

## Implementation and preservation

The login gateway and Character Select gallery use four clean runtime image layers derived from the approved concepts; controls and text remain real DOM. Actual account portraits, authentication/email confirmation, slot entitlement, cooldowns, account deletion and cancellation retain their existing authority. Versioned media dimensions, sizes and hashes match provenance.

Profile offers six short per-axis tendency explanations through the existing stat-help popup. The chart starts below the metadata divider. Popup focus, Escape restoration and click-off behavior are preserved. Training reports now require a deliberate Claim after completion or stopping. Pending, failure/retry, stale-tab and character-change cases preserve idempotent claims and fresh authoritative snapshots.

Support Action uses the same heading and ten characteristic rows as Discipline Skills. Move, Basic Attack, Guard, HP Recovery and MP Recovery descriptions derive from existing combat rules. Battle reuses the shared SiteHeader; Audio is centered. Artwork is larger inside existing dock/map budgets, with six pixels of cockpit top space, equal empty/populated squares and fully contained final-facing controls. The preview stays 44px high and centered; terrain samples are wider without shrinking the board or forcing desktop scrolling.

## Local checks on the frozen source

- Two complete `pnpm check` executions exited 0: repository formatting, lint, types, 3,157 Vitest tests, seven Node checks and Production builds. The second execution followed the final source freeze; unchanged package tasks may use Turbo cache.
- Worker `check:boot` passed in once mode.
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

Exact-head CI, final Main freshness, merge identity, deployment source, live checks and restored deployment lock will be recorded after they complete. Current Production has not yet changed for this work item.
