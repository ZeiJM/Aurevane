# October 8 acceptance checklist

All boxes begin unchecked for the new batch. Reported checks from unrecovered code are not evidence that the included snapshot implements these changes. Use fresh battles for new policies and explicit old fixtures for compatibility. Record source SHA/tree, environment, test/receipt and result when checking an item.

## Facing indicators and Ground animation

- [ ] Every living occupied tile places its direction indicator in the top-left tile corner, clear of the portrait and HP/MP meters.
- [ ] North/east/south/west rotation, identity/team accent and minimum readable size remain correct.
- [ ] Edge/corner tiles, elevated tiles, corpses with living co-occupants and dense neighboring units do not overlap or clip indicators.
- [ ] Clicking/hovering/keyboard-targeting a unit or tile still works; the indicator does not intercept input.
- [ ] Desktop/mobile PvE, PvP and spectator views use the same correct placement.
- [ ] Embers runs through several complete animation cycles with no visible jump, cut or restart.
- [ ] Frost and Arcane Pulse loops also remain continuous; rerender/reload of unrelated state does not restart an unchanged area unnecessarily.
- [ ] Multiple overlapping areas remain readable below portraits; area activation and expiry work normally.
- [ ] Reduced-motion mode renders static effects without active animation; palette/contrast stays readable.

## Line targeting

- [ ] Selecting a Line Skill shows all legal potential line directions/reach.
- [ ] Hovering an enemy preserves the other legal line glows; leaving the enemy restores appropriate neutral preview without flicker.
- [ ] The selected direction/actual footprint remains distinguishable from potential reach.
- [ ] Committing uses only the selected legal direction, with server damage/targets matching the real footprint.
- [ ] Keyboard selection, pointer selection, Escape/cancel, changing Skills and rotations remain consistent.
- [ ] Board edges, range limits, elevation and terrain/occupancy restrictions preserve server legality.
- [ ] Existing Ground orange and recovery/self/ally preview priorities remain correct; do not regress the released 72-case matrix.

## Bleed, Poison and Burn

- [ ] Apply Bleed eight or more times from the same Skill/source without a hidden cap or replacement; verify independent persisted instances.
- [ ] Apply Bleed from multiple sources/Skills; verify every successful application is independent.
- [ ] Different captured damage values and staggered applications retain their own tick amounts and expiry schedules.
- [ ] Bleed application/tick timing begins on its specified activation, covers its full duration, and produces no cast-turn/double/early/late tick.
- [ ] Reload/JSON round-trip, retries, copying where supported and turn-order boundaries neither duplicate nor drop stacks.
- [ ] Tick damage and actual HP change agree, including lethal ticks and terminal cleanup.
- [ ] Chronicle attributes outgoing end-turn scheduled damage to the completed turn/round even when initiative has already advanced.
- [ ] Incoming activation, later commands and explicit extra triggers are not incorrectly moved to the previous turn.
- [ ] Run the same timing, reload, expiry, target and attribution checks for Poison and Burn while preserving their own stacking/replacement contracts.
- [ ] Burn backlash explicitly names Burn backlash and displays actual damage, including a one-damage case.
- [ ] Extra Poison movement damage explicitly names the extra tick after movement; scheduled Poison ticks remain distinct.
- [ ] Once-per-character-turn-cycle extra-trigger allowances survive reapplication, copy and reload; scheduled ticks remain independent.
- [ ] Poison threshold/partial movement carry, multi-hit Burn calculation and lethal/draw handling match the current pinned policy.
- [ ] Copied logs and on-screen logs agree; hidden source identity and private effect data do not leak through new metadata.
- [ ] Historical encounters/logs keep their recorded mechanics and honest historical wording.

## Repeated applications and Power scaling

- [ ] Under equal caster/target/defense conditions and noncritical hits, ordinary Power9 packet scaling is consistent with Power8 and independent of total packet count/AP-based splitting.
- [ ] Sevenfold retains seven authored applications; each has its own applicable hit and critical roll.
- [ ] A deterministic fixture demonstrates mixed misses, normal hits and critical hits within one Sevenfold cast.
- [ ] Repeated debuff tags get independent applicable hit/resistance results; ordinary Skill versus Essence/Resonance origin exceptions remain intact.
- [ ] Beneficial tags do not gain arbitrary miss/critical behavior just because they repeat.
- [ ] A repeated Skill pays resources, consumes action/cooldown and triggers command-scoped systems only once.
- [ ] Mixed effect sequences, recipients, merged Resonance, hit-dependent effects, absorb/reflect and Vengeance retain correct original effect ordinals and order.
- [ ] Percentage DoT capture uses the actual appropriate successful damage; Burn/Poison extra-trigger caps are not multiplied accidentally.
- [ ] An early lethal packet yields a valid final battle result with no duplicate reward or illegal post-defeat effects.
- [ ] Pending delayed packets retain committed target/hit/critical results through reload and do not reroll on activation/retry.
- [ ] Every new encounter factory pins the new policy; historical snapshots omit it and retain the old formula/RNG behavior.
- [ ] Invalid policy versions and malformed persisted per-packet metadata are rejected safely.
- [ ] Chronicle links each hit/miss/critical to the correct application and actual damage.

## Repeated-effect presentation

- [ ] Sevenfold displays one `Dmg [9] ×7` parameter group with an accessible application count.
- [ ] The bottom damage explanation appears once when identical.
- [ ] Different powers, percentages, durations, recipients, timing or custom descriptions remain distinct where needed.
- [ ] Grouping does not mutate the authored effect array or engine execution order.
- [ ] Character/Nexus, battle report, Essence, Resonance, full details, compact readers and Master previews remain consistent.
- [ ] A repeated self-recovery group followed by enemy damage retains correct recipient labels after grouping.
- [ ] Responsive layout, typography and keyboard/screen-reader presentation are reviewed in a real browser.

## Percentage HP/MP recovery

- [ ] One-turn recovery gains the authored percentage of recipient max HP or max MP with the defined rounding/minimum rule.
- [ ] Two-, three- and four-application recovery repeat one captured amount per recipient rather than recalculating it each turn.
- [ ] Changing stats/max resource after the cast does not change the captured base amount; actual gain still caps at the current maximum.
- [ ] Near-full/full resources, zero MP maximum, small maxima and defeated units behave correctly without revival or overfill.
- [ ] HP Hex or other applicable adjustment is captured at the intended authority once; no unintended double scaling occurs.
- [ ] Multi-recipient and self recovery use the proper recipient maxima; self-cast does not tick twice in the current turn.
- [ ] Normal/Instant/Delayed timing preserves the full number of applications.
- [ ] Reload, retries, terminal transitions and source defeat preserve or clear recovery state according to the approved contract.
- [ ] All current Skill/Essence/Resonance/summon recovery content is audited and converted via explicit new immutable versions and a documented percentage table.
- [ ] Historical Power/flat recovery versions and saved encounters retain their old behavior.
- [ ] Parameters show percentages in brackets; Master validation, preview, diff, publication, rollback, server projection and copied descriptions agree.

## Master timing and Rewind

- [ ] Each tag has one selector on the existing Master screen: **Normal / Instant / Delayed**.
- [ ] Switching choices stores one mode only; no tag can contain both Instant and Delayed through UI, API, import or database publication.
- [ ] Validation/reason/expected-version/audit/immutable publication and rollback remain required and functional.
- [ ] New current policy sets Rewind to Delayed while preserving unrelated tag overrides.
- [ ] Cast in round2: Instant acts now; Normal activates at start round3; Delayed activates at start round4.
- [ ] Skill reports show Instant and Delayed characteristics consistently, including historical policy-aware reports.
- [ ] Full active durations remain correct for statuses, Ground, summons and repeated recovery after each timing mode.
- [ ] Rewind can be selected and successfully cast before movement; the current successful-cast position becomes the fixed anchor.
- [ ] Subsequent movement before activation does not move the anchor; a valid delayed activation returns to that exact tile.
- [ ] Already-at-anchor is a valid no-op; rooted/occupied/impassable/elevation/defeated cases produce honest defined outcomes without illegal placement.
- [ ] Save/reload, manual end turn, timeout, AI, command retry and battle completion retain proper timing/anchor behavior.
- [ ] Old Rewind versions/snapshots retain their recorded turn-origin/move-first contract.
- [ ] Migration and protected publication RPC reject invalid modes; disposable database reset and upgrade paths pass before Production application.

## Password reset

- [ ] Requesting a reset produces an email with the correct canonical on-site reset URL.
- [ ] The link works in a new browser/context where no original request session or PKCE verifier exists.
- [ ] Email-scanner GET/prefetch does not consume the reset token; an explicit Continue action does the verification.
- [ ] The user reaches a usable new-password form, not a normal sign-in loop.
- [ ] Invalid/malformed/expired/replayed token links show an honest recovery error and a route to request a fresh link.
- [ ] Ordinary signed-in sessions, mismatched recovery marker/session and forged request origins cannot reset through the recovery-only endpoint.
- [ ] Short passwords and mismatched confirmation are rejected with clear form feedback.
- [ ] After completion, the new password works and the old password fails; session revocation/marker cleanup follow the established account contract.
- [ ] Sign-out/revocation failures are surfaced honestly; no false completion or gameplay entitlement is issued by the recovery flow.
- [ ] Legacy emailed callbacks remain compatible where supported.
- [ ] Recovery responses are no-store/no-referrer; token hashes do not enter unnecessary logs, analytics or third-party requests.
- [ ] Local/disposable SiteURL, browser test port, template content path and redirect allowlist agree; signup is unchanged.
- [ ] Real delivered-email/browser acceptance runs against disposable Auth infrastructure, with successful replay/expiry/fresh-browser evidence.
- [ ] Hosted template/SiteURL/redirect settings are checked against deployed routes as part of an authorized release; configuration claims name actual observed results.

## Final engineering/release checks

- [ ] Refresh Main and preserve other chats' work; final source/tree identities are recorded.
- [ ] Focused mechanics/auth regressions pass, then fresh format/lint/typecheck/full tests/build on the final code.
- [ ] Actual component/browser screenshot and motion checks cover desktop/mobile/PvE/PvP/spectator where relevant.
- [ ] Required database/Auth/Master persistence and rollback acceptance plus all applicable exact-head CI workflows pass.
- [ ] Final whole-branch review findings are resolved and verified.
- [ ] Source/content/migration/hosted-Auth changes and any remaining limitations are concrete and reviewable.
- [ ] Publication authorization is resolved from the current user/session; deployment is not inferred from a merge.
- [ ] If deployed, the exact verified merged source is READY, canonical alias matches it, public smoke and bounded runtime checks pass.
- [ ] Final user report includes actual status and this complete relevant checklist, without claiming human balance acceptance.

The previous released batch's complete **31-point Owner checklist** remains in `source-snapshot/docs/verification/2026-10-07-combat-corrections.md`; retain it as regression coverage and historical context. Its old compass rim positioning is deliberately superseded by the new tile-corner requirement.
