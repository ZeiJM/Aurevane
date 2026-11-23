# October 8 combat/auth reconstruction design

Owner has authorized continuation of this existing scope and explicitly requested no restart of design approval. This preserved handover is the requirement and compatibility contract. Status claims in section 6 are historical notes only. Actual current verification is tracked in the implementation plan.

# Aurevane — comprehensive October 8 continuation

## 1. What the owner wants

The active job is the October 8 combat/authentication correction batch. The owner repeatedly instructed “please fix”, “continue”, “proceed”, and explicitly added the Sevenfold issues to the work. Those are implementation instructions, not a request for another plan-only response. The immediate final instruction in the old chat was to package this handover because the chat lagged and would be deleted.

The original task must remain intact when later requests arrive. The most recent Master Panel clarification is additive: **merge timing into the existing tag screen as one Normal / Instant / Delayed selector**. A tag cannot be both Instant and Delayed. The owner expects all related behavior, persistence, authoring and reader wiring, not just a label.

The owner prefers steady progress, concise factual updates, no repeated permission questions for authorized implementation, no premature completion claims, and a concrete list of things to test. Avoid unrelated Phase 5/world work. Preserve the existing fantasy art, responsive layout, shared player/PvP/spectator behavior and current game rules except where this batch deliberately changes them.

## 2. Evidence hierarchy and recoverability

This document combines direct current checks, the visible owner requests, and detailed retained notes of work done earlier in the chat. These are deliberately distinguished.

### Verified available files

During packaging the workspace was `/workspace/scratch/30e939f4a253`. The available repository was its `aurevane-combat-corrections` child. It was clean on branch `agent/combat-corrections-release-receipt-20261008`, HEAD `f8020f078a532e99bedf51bdc5647e8efb039edd`. Its source tree is `b2fbb852611cadc3ead3b7b363ddb6cd0e7c4ff4`.

A fresh GitHub read found Main `f49b99f23dc16419c94ede9589e9ebeb662bdfe0` with exactly the same tree. The different local and remote commit identities reflect the imported source/receipt workflow, not different file contents. Main may change after this package; refresh it.

All 2,686 Git-tracked files from the available snapshot are included. All 12 October 8 user screenshots were recovered and their PNG integrity checked. The earlier pasted handover and available browser/CI evidence are included separately as historical material.

### Later work recorded in retained chat notes, but absent from available files

The retained notes describe a later branch `agent/combat-recovery-delayed-reset-20261008`, commits `500c1b2`, `35af641a290e95b177f0d483ed461075483dbde2`, `91fb7a95c470f9b8b18c38f01319173a151ee9fe`, `0f8cee3`, and `ff83fba`, plus uncommitted reader and packet work. None of these later commits or changed files were recoverable from the available checkout. The remote branch lookup returned 404. Local ref/reflog/worktree/object checks found no alternate later checkpoint. The earlier temporary test logs were also gone.

Therefore the ZIP does **not** contain executable implementations of those newer edits. Their detailed design, diagnoses, path names, reported test results and stopping point are preserved below so they can be recovered or reapplied. Do not mark the new batch complete from these notes. Do not represent remembered test counts as fresh verification of the included source.

No October 8 new-batch deployment or Production migration is evidenced. The package was created without code changes or remote mutations.

## 3. Prior batch already released — preserve it

The authoritative included receipt is `source-snapshot/docs/verification/2026-10-07-combat-corrections.md`. Its opening section supersedes old pending-status paragraphs in the historical imported handover.

- PR #847: https://github.com/ZeiJM/Aurevane/pull/847, merged as `8a0a5a1e1e2a6a537be8f3de22accc7be7d77bc3`.
- Tested candidate `974d32728223cfa44f8f1fddf161d833f5746aef`; tested/merged tree `89005998f2550e45d821d73404228723f5035c80`.
- Receipt-only PR #848 merged as current inspected Main `f49b99f...`, tree `b2fbb852...`; no app change or redeployment for that receipt.
- Recorded Production deployment `dpl_BkvsQJyAv1nVQzqCrHD2bAxJpccV`, READY `2026-10-08T01:56:09.844Z`, canonical https://aurevane.vercel.app/.
- All 13 workflows passed. The receipt records 4,328 Vitest tests + seven Node checks, format/lint/eight-package types/build, 322 full Chromium cases and 10 Edge cases. Existing skips are explicitly retained in the receipt. These are prior release results, not new tests run during handover creation.
- Public smoke and a bounded warning/error/fatal runtime-log scan were recorded. No human balance acceptance or Owner-account playtest was claimed.

Already released mechanics include persistent Ground policy 1, DoT trigger policy 1, authored Burn backlash percentages, once-per-character-turn-cycle extra Burn/Poison allowances, continuous typed effect projections, Master Ground settings and exact percentage publication, historical policy-aware readers, shared compass and spectator chat fixes. Do not redo or remove these systems.

The old imported October 7 handover still says the release and two browser corrections are pending. That was true at its timestamp and is now historical. Its long architecture/context sections remain useful; its status and publication checklist do not override the later receipt.

## 4. Full October 8 scope and acceptance intent

| Item | Owner requirement | Important interpretation |
| --- | --- | --- |
| Facing indicators | Move arrows to the top-left corner of the occupied tile | Tile-relative placement, clear of portrait; all directions and participant/spectator modes |
| Ground animation | Make animation one continuous seamless loop | The reference is Embers; also inspect other presets for visible loop jumps and honor reduced motion |
| Line targeting | Hovering an enemy must not hide the other legal line glows | Potential reach remains visible; the actual committed cast still has one chosen direction |
| Extra DoT damage narration | State the source/cause of extra damage | E.g. “took 1 damage from Burn backlash”; identify extra Poison movement tick distinctly |
| Bleed | Unlimited stacking while applications continue | Each successful application is an independent stack with its own captured damage and expiry; same Skill/source must not replace previous stacks |
| Other DoTs | Check Poison and Burn for any shared Bleed defects | Do not automatically make all DoTs infinitely stack; preserve their independently approved replacement rules unless a specific defect requires correction |
| HP/MP recovery | Percent of recipient maximum resource; repeat same captured amount for multiple turns | Stop using offensive Power 1–20 for these recovery Skills; show percentage in brackets; migrate current content by appending immutable versions |
| Timing | Master-editable Normal / Instant / Delayed per tag | One enum/select on the existing screen; mutually exclusive by construction and server/SQL validation |
| Rewind | First tag set to Delayed; selectable before moving; record position when successfully cast | Delayed is one extra global round beyond Normal: cast R2 → activation at start R4; new Rewind returns to cast-position anchor |
| Repeated tags | Every authored application resolves separately | Independent hit/crit where applicable, and applicable resistance for repeated debuffs; costs/cooldowns once per command |
| Sevenfold Power | Standardize damage Power across ordinary Skills/Essence packets | Power 9 per strike should use the same ordinary scaling basis as Power 8, holding other factors equal |
| Repeated-effect readers | Compact identical effects and remove redundant explanations | `Dmg [9] ×7`; do not collapse genuinely different magnitudes, recipients, timings, or custom explanations |
| Password reset | Send reset email link, allow reset on the site, including another browser | Complete request → email → safe landing → verification → new password; don't just return to sign-in |

## 5. Screenshot index

All filenames below exist under `reference-images/`. The original images are retained without modification.

| Filename | What it documents |
| --- | --- |
| `image(20261008-023811).png` | Compass/arrows visually overlap the character; requested tile-corner placement |
| `image(20261008-024235).png` | Ground animation/Embers visual reference; the owner's description supplies the loop-cut behavior a still cannot prove |
| `image(20261008-130021).png` | Line-targeting reach before/around enemy hover |
| `image(20261008-130027).png` | Companion line-hover view with disappearing other glows |
| `image(20261008-130223).png` | Burn extra-damage Chronicle needs explicit cause |
| `image(20261008-132729).png` | Password-reset link lands at sign-in instead of usable reset journey |
| `image(20261008-135608).png` | Aura HP 84/122, two BLE indicators with 2/3 counters; those counters were interpreted as durations, not stack counts |
| `image(20261008-140934).png` | Severing Cut: Dmg [8], Bleed [15%][3 turns], 45 AP, Line 2 |
| `image(20261008-140957).png` | Severing Cut dealing 16 damage and queuing Bleed rounds 4–6 |
| `image(20261008-141009).png` | Sevenfold Chronicle showing seven 9-damage hits |
| `image(20261008-141019).png` | Sevenfold: 65 AP, cooldown 3, seven Dmg [9] rows and duplicate explanation bullets |
| `image(20261008-143641).png` | Chat/progress panel showing repeated continue requests, DoT step Done and repeated-effect step In progress; useful context, not game behavior evidence |

## 6. Work recorded before the workspace discrepancy

This section preserves the exact useful stopping point. Every implementation/result in this section is **recorded prior work, not present in the packaged source** unless independently found when resuming.

### Plans and task ledger

Recorded files, now unavailable:

- `docs/superpowers/specs/2026-10-08-combat-recovery-delayed-password-reset-design.md`
- `docs/superpowers/plans/2026-10-08-password-reset-repair.md`
- `docs/superpowers/plans/2026-10-08-combat-recovery-delayed-refinement.md`
- `.superpowers/sdd/2026-10-08-password-reset-repair/`
- `.superpowers/sdd/2026-10-08-combat-recovery-delayed-refinement/`

The retained state says Auth Tasks 1–2 and Combat Task 3 were completed, Combat Tasks 1–2 and 4–7 remained, and new Task 8 for repeated readers/packets was in progress. The task numbering is historical; reconstruct a clean current plan instead of falsely importing missing completion checkboxes.

The overall progress order was: DoT verification; repeated readers/Sevenfold; remaining password reset; arrows/loop/line visuals; percentage recovery and Delayed/Rewind; combined review/verification.

### Password reset — recorded Tasks 1 and 2

Recorded commit `91fb7a95c470f9b8b18c38f01319173a151ee9fe`, formatting follow-up `0f8cee3`.

Design/implementation notes:

1. Add `/auth/recovery` as a GET landing page that does not consume a token. An email scanner visiting the link must not invalidate it.
2. Show explicit “Continue to reset password”; client POSTs to `/api/account/recovery`.
3. POST strictly validates same-origin, JSON shape, token hash transport and recovery-only type. Verify OTP, then verify authenticated user/claims/session identity; set an HttpOnly recovery marker bound to the verified session. Do not acquire gameplay authority/claims just by entering recovery.
4. `isPasswordRecoveryTokenHash`: opaque token hash transport length 16–256 with strict permitted shape. Preserve proper server-side Auth validation; this shape check is not authentication.
5. Reset-email request uses `/auth/callback?flow=recovery` for the legacy PKCE route; keep old callbacks compatible. The new configured email template routes directly to the token-hash recovery landing.
6. Recovery routes get `Referrer-Policy: no-referrer` and private/no-store headers; preserve query confidentiality.
7. Existing password-reset completion route already covered mismatched/short input, ordinary-session rejection, recovery marker/session mismatch, global sign-out, marker clearing, and honest failure if sign-out cannot finish. Do not weaken these.

Reported verification: 48 Auth tests + web typecheck for Task 1; 30 tests/three files for Task 2. The associated logs/changed files were unavailable during packaging.

Remaining Auth Tasks 3–4:

- Create `supabase/templates/recovery.html` with exact on-site link `{{ .SiteURL }}/auth/recovery?token_hash={{ .TokenHash }}` and wire `[auth.email.template.recovery]` in local Supabase config.
- Resolve local canonical origin mismatch: Supabase SiteURL had port 3000 while acceptance base URL used 3100. Recorded plan favored 3100 locally while preserving needed 3000/3100 signup redirects; verify against current configuration before changing.
- Update `apps/web/e2e/password-reset.pw.ts`: capture new on-site token-hash URL rather than only `/auth/v1/verify`; assert site origin; visit scanner GET; use a fresh browser context; click Continue; set password; old password fails; new password works; recovery creates no gameplay claim; replay is invalid.
- Test expiry by manipulating only a disposable local test user's recovery timestamp in disposable database setup, not Production accounts. Verify Continue shows invalid/expired flow honestly.
- Preserve legacy callback unit coverage and add real compatible browser acceptance if fixtures support it.
- Hosted Auth template/SiteURL/redirect configuration must match deployed routes. Prepare exact configuration delta and release notes. Management configuration capability was not exposed in the previously available Supabase connector; do not probe credentials or claim it was changed.
- There was no local Docker/Supabase service, so real-mail tests required disposable CI. Never label mock/unit tests as delivered-email acceptance.

Current packaged source still uses `${origin}/auth/callback?next=/game` in `apps/web/src/lib/auth/password-recovery.ts`; it does not contain the recorded scanner-safe additions.

### Bleed, Poison, Burn and Chronicle — recorded completed Task 3

Recorded commit `ff83fba`, message “Verify unlimited Bleed and correct shared DoT damage narration”.

Diagnosis: existing current-policy Bleed storage already retained unlimited independent applications; no mechanical cap/replacement bug was found in the tested path. A regression file `packages/game-core/src/combat/combat-bleed-stacking-regression.test.ts` reportedly proved eight same-Skill applications, separate captured amounts, next-round activation, JSON reload and independent expiry.

Example fixture expectations: eight applications at 15% of captured damage 20 yield eight ticks of 3, total 24 each eligible turn for three turns. Staggered captured damage 20 then 15 yields 3 and 2 with their independent remaining durations.

Current Poison/Burn percentage policy was intentionally one replacement application across sources, as documented in COMBAT. The user asked to fix shared defects across all DoTs, not to erase those different stacking contracts.

Actual shared bug found: `endCombatTurn` advances initiative before outgoing scheduled DoT receipts. `apps/web/src/server/battle/battle-log-service.ts` inferred the next round/turn for those outgoing receipts, so an R4 tick could appear under R5.

Recorded correction in `annotateBattleContext`:

- Retain completed turn `{battleVersion, combatantId, round, turnNumber}` when `turn_ended` occurs.
- Attribute outgoing scheduled periodic receipts to it only when target and battle version match and there is no explicit incoming activation context.
- Exclude explicit Burn backlash and Poison movement triggers from that scheduled attribution.
- Preserve global round state and actual source attribution; don't move subsequent commands backward.
- Tests included later-command, incoming-target and explicit-activation negatives.

Recorded damage metadata: `damageTrigger?: 'burn-backlash' | 'poison-movement' | 'scheduled-tick'` on current receipts in `actions-legacy.ts`, gated by appropriate current policy rather than rewriting old logs. Whitelist it in server public projection without leaking concealed sources.

Shared Chronicle examples:

- `Recruit took 1 damage from Burn backlash`
- `Recruit took 1 damage from an extra Poison tick after movement`
- Scheduled ticks retain ordinary wounds/Poison/flames wording.
- Known historical Burn-backlash status IDs could map to honest wording; unknown historical Poison causes stay generic instead of inventing movement provenance.

Recorded tests: two additions to `combat-dot-turn-caps.test.ts`; new `battle-log-damage-causes.test.tsx`; hidden-source privacy regression; six round-boundary tests in the log service. Both visual and copied Chronicle use shared message authority.

Reported frozen `ff83fba` full quality: format/lint/typecheck/build, 4,360 Vitest tests + seven Node checks, including core 2,483/web 1,721/others 156. Reported receipt `docs/verification/2026-10-08-dot-stacking-and-timing.md` and `/tmp/aurevane-dot-combined-check.log` are unavailable. This report must be re-established after reconstruction.

### Repeated-effect readers — recorded green, uncommitted

Recorded helper `apps/web/src/components/character/skill-effect-groups.ts`:

`groupSkillEffects<Effect extends MatureSkillEffectDefinition>(effects: readonly Effect[], descriptions?: readonly (string | null)[])`

It grouped structurally identical full effects plus trimmed custom explanation using recursively canonicalized property ordering. It returned first-occurrence ordered `{ effect, count, firstIndex }`. It did not mutate the authored effect list or engine order. The generic preserved the narrower Resonance effect type.

Recorded consumers:

- `CompactSkillEffectSummary` → `CompactEffectSummary` optional count (default 1), with visible `×7`, `data-compact-effect-count`, and accessible “7 applications”.
- `BattleSkillParameters`, `character-skill-build-panel.tsx`, `SkillDetails`, `ResonanceParameters`.
- Shared `skillEffectSummaries` grouped/count text.
- `skillPreviewEffects` deduplicated identical bottom explanations by label+text. Different numeric variants still remain separate parameter groups.
- `resonance-detail-presentation.ts` used grouped effects for recipient-label indexing; otherwise a repeated self-heal followed by enemy damage can shift labels incorrectly.
- `SkillDetails` heading became “Effects”; nonadjacent identical effects can be visually grouped, so “Effects, in order” would overclaim execution ordering.

Tests: actual current Sevenfold one Dmg[9]×7 and one explanation; different powers/recipients/custom descriptions retained; Resonance repeated self-heals followed by enemy damage retain correct labels. The old “one explanation for every authored effect” assertion was deliberately superseded by the owner request.

Reported 25 focused tests passed, then full web suite 1,725 tests + seven Node checks, web typecheck and scoped ESLint. No new browser screenshot review had happened. Files and `/tmp/aurevane-repeat-readers-*` logs are unavailable.

### Sevenfold scaling and packet execution — recorded RED stopping point

Root cause of scaling discrepancy: `damage-scaling.ts` currently distributes scaling across damage effect count. Historical scaling is 2500/count basis points; current scaling is AP cost ×50/count. Sevenfold therefore splits scaling across seven strikes, while an ordinary one-hit Skill receives its full allocation.

Another root cause: `actions.ts` rolls accuracy, then status resistance, then critical once per target for the whole action. Duplicated effects share those outcomes.

Recorded proposed policy: add `skillPacketPolicyVersion?: 1` to `CombatEncounterState`, validate with stat bridge rules/schema 4, and pin only **new encounters**. Preserve old saved-battle formula and RNG behavior. Add `STANDARD_SKILL_POWER_SCALING_BASIS_POINTS = 2500` and `standardSkillDamageScaling(source)` for each ordinary new-policy direct damage packet. Explicit authored scaling and special Vengeance handling remain authoritative. This coefficient is a recorded implementation decision, not a separate new owner quote.

Only the policy field/validator stub and helper stub had been written, not wired. The packet engine had not been implemented. New uncommitted `packages/game-core/src/combat/combat-skill-packets.test.ts` was correctly failing two assertions after a fixture schema mistake was fixed:

- Compare current Severing Cut Power 8 and Edgedancer Essence Sevenfold Power 9 under the same stats/recipient. Severing uses direction east/Line2, Sevenfold a unit target. Expected per-hit standard scaling `{source: 'physical-power', coefficientBasisPoints: 2500}`; observed current Sevenfold 9 versus comparison 12. The owner's screenshot was 16 vs9 under their live conditions, so don't hardcode that screen's total into unrelated fixtures.
- Synthetic seven damage-9 packets, actor MP20, action cost MP3, `spendsAction:false`, accuracyMode per-target, range1, seed42, accuracy5000, critical7500, recipient HP1000: proposed sequential packet RNG expects accuracy `[false,false,false,false,true,false,true]`, critical receipts `[false,true]` only on the two hits, damage `[9,13]`, recipient HP978, actor MP17, one resource-cost event. Existing action emitted one accuracy receipt, failing the test.

Those exact seed expectations assume per-packet hit→crit interleaving in authored order. Re-evaluate if a more appropriate deterministic ordering is designed; assert independently varying outcomes rather than blindly manufacturing a specific RNG implementation.

#### Paths and integration points

- `packages/game-core/src/combat/pv1f-action-economy.ts`: `applyCurrentMatureSkillPowerScaling` (~1565 in old snapshot), ordinary Skill/Essence materialization, summon ability materialization (~670), `evaluatePv1fMatureSkill` (~861). Resonance bonuses are appended after ordinary scaling; missing ordinary damage scaling on appended packets must not be forgotten. Avoid applying recovery/heal scaling twice.
- New-encounter factories found in `apps/web/src/server/battle/battle-session-service.ts`, `pvp-lobby-service.ts`, `pvp-lobby-quality-service.ts`. Search all existing policy pins to find world/training/summon paths; don't assume only those three.
- `actions.ts` executes resource payment and reactions once. Preserve its CSR, Vengeance, provenance, resonance, hit-dependent and reflection/absorb contracts.
- `combat-skill-accuracy.ts`: hostile target forecast, per-target roll and receipt.
- `combat-critical.ts`: current per-target eligible ordinals, single roll sets all eligible ordinals, zero/10000 probability avoids random draw.
- `combat-status-resistance.ts`: ordinary Skill negative effects only; Essence/Resonance origin rules bypass where specified. Per-effect origin must remain intact.
- `actions-legacy.ts` queues pending recipients and applies instant effects. Existing filters use global missed combatants and per-target resisted effect ordinal sets; new per-packet miss sets need equivalent exact ordinal handling for both instant and delayed work.

#### Suggested approach, not yet implemented

Use a small packet-resolution layer, potentially reusing existing roll helpers with single-effect action views, mapping every ordinal back to the original authored effect. Do not recursively execute the entire paid Skill seven times.

Identify duplicated tags with canonical effect identity (`combatEffectTimingTag`, including apply-status identity). Duplicated applications need independent applicable rolls. Beneficial recovery must not acquire arbitrary miss/critical behavior. Keep costs/cooldowns/reaction caps at command scope. Preserve merged hit-dependent Resonance behavior and original ordinals when filtering. A global missed-combatant flag must mean all relevant hostile applications missed, not just one packet.

Persist successful pending targets and critical decisions; don't reroll delayed effects on reload. Damage summaries and percentage DoT capture must use actual successful damage. Consider an optional safe `effectOrdinal` on new-policy accuracy/critical/direct-damage receipts and public projection so Chronicle links a critical to the correct strike. Test lethal early packets, command completion, no duplicate rewards, current/historical snapshots and missing/invalid policy fields. Preserve once-per-cycle Burn/Poison extra-trigger allowances.

## 7. Percentage recovery design to implement/reconstruct

The recorded agreed design used a new explicit effect rather than silently reinterpreting immutable old Power effects:

```ts
{
  type: 'percentage-recovery';
  recipient: /* existing canonical recipient */;
  resource: 'hp' | 'mp';
  percent: number; // integer 1..100
  ticks?: number; // 1..4
}
```

Capture the recipient's relevant maximum at successful cast/application: floor(maximum × percent /100), with minimum one for a positive maximum and zero for zero maximum. Capture HP Hex adjustment once where it applies, then reuse the final amount for every scheduled application. Actual gains still cap at the current resource maximum and must not revive a defeated unit. The display reports actual recovery honestly when already near full.

Recorded saved shape: `CapturedPercentageRecovery { resource, percent, maximumAtCast, amountPerApplication }` stored per recipient for pending and ongoing effects. Reload cannot recalculate it from later max changes. A self-cast must not accidentally consume a second tick at the caster's current end-of-turn. Check multi-recipient maxima independently.

One-turn Instant recovery applies once. A two-turn recovery applies the same captured amount on its two intended activations. Clearly define the schedule with timing mode so delayed/normal/instant are consistent; preserve full active duration.

All current HP/MP recovery content and readers need percentage parameters. The recorded missing plan had an approved rebalance table for 37 Skill/Essence rows, plus 55 Resonance recovery rows and one summon recovery row. **The exact row-by-row percentages are not recoverable from the retained notes.** Do not invent them and call them the recovered approved mapping. Enumerate actual current content, recover that table if a durable copy exists, or make a concrete replacement mapping for review based on current balance and the owner's percent-based direction. Preserve old immutable versions and saved battle definitions.

Power-based barrier/other unrelated effects are not automatically percentage recovery. Search validators, descriptions, compact/full readers, Master authoring, server projection, copy/transform effects, Ground/summon execution and all new encounter paths. Capture and persist at the correct authority; never let client values choose maxima.

## 8. Delayed timing and Rewind

Current available `CombatEffectTimingMode` is `instant | next-round`. Default damage/healing/MP recovery are instant; ordinary scheduled statuses use next-round. There is already one select in `apps/web/src/components/master/combat-content/combat-effect-timing-editor.tsx`. Extend it in place.

Use one enum with a third value `delayed`; user-facing choices must be **Normal / Instant / Delayed**. Internally Normal can retain `next-round` for compatibility. Never add two independent Instant/Delayed booleans. Validate single permitted mode in TypeScript, input schemas, publication service and SQL/RPC. Update misleading old copy that calls ordinary next-round timing “Delayed”. Show Instant and Delayed characteristics through the same shared reader context.

The recorded interpretation is offsets 0/1/2: Instant now, Normal next global round, Delayed one additional global round. Cast in round2 → Delayed start round4. Activation round offset is separate from active duration; do not lose the first or last tick. Share one offset helper across queued effects, summon and Ground handling.

Rewind is the first effect/tag assigned Delayed by the new current timing policy. New authored Rewind should support `anchorMode?: 'cast-position'`; pending state stores `returnAnchor`. Successful use can occur before moving and captures the then-current tile. It must not require movement first or silently move its anchor when the actor later moves. Old omitted anchor mode keeps historical turn-origin/move-first behavior for saved content.

Possible blocked return reasons to preserve/display: rooted, occupied, impassable, elevation restriction, defeated. Already at the anchor is a valid no-op, not an invalid cast. No resurrection, illegal overlap or movement-budget/cooldown duplication. Test JSON persistence, retries, manual turn end, timeout, AI, and terminal cleanup.

Recorded migration plan: use Supabase CLI to create a migration such as `combat_delayed_timing`, expand protected timing-publication RPC validation from two allowed values to three, append a new immutable policy retaining every existing override except the approved Rewind default. Respect reason/version/audit/rollback and read existing hosted override state before any data strategy. Do not apply Production migration just because a file exists.

## 9. Visual correction diagnoses

### Facing arrows

The current compass is nested in the unit/portrait span in `battle-experience` and spectator rendering. CSS positions it with a negative top and left50%/translateX. The last released fix deliberately placed its center on the portrait's upper rim to fit the old requirement. The owner now specifically wants a tile top-left corner, so that old rim assertion is superseded.

Mount/position it against the **occupied tile**, approximately inset1px as a starting layout choice, and verify actual bounds. Retain direction, identity/team colors, minimum readable size, no pointer interception, corpse/living co-occupant behavior and unchanged portraits/meters. A hidden legacy glyph or keyboard-preview query may assume unit nesting; trace before moving it. Cover participant PvE, PvP and spectator, mobile/desktop and board edges. Shared authority rather than separate special-case styles.

### Ground loop

Recorded diagnosis: Embers uses repeated radial textures with inset−30 and transformY10→−20 plus opacity .4→.8; the endpoints visibly differ, so every iteration jumps. Use truly periodic background-position or staggered elements whose reset occurs while invisible. Frost endpoints already matched; Arcane Pulse also needs checking for visible end reset. Preserve stable area IDs so rerenders don't restart animation. Honor reduced-motion static styling with sufficient specificity. A still screenshot alone cannot verify seamless motion; observe multiple complete cycles in a real browser.

### Line reach

`battleTargetReachTiles` for geometry2 currently chooses only the aimed direction on hover. Keep the union of all legal cardinal potential line tiles visible as reach while separately showing the selected cast direction/footprint. Server legality and committed directional selection must remain unchanged. Test occupied enemy tiles, hover exit, keyboard focus/selection, rotations, edges, blockers/elevation and all play/spectator contexts applicable to preview. Maintain the existing strict browser matrix; don't weaken it to hide a regression.

## 10. Original pasted Chronicle example

The owner provided this example for the Bleed issue; preserve timing/source facts when designing regressions:

```text
Archer — Archer moves.
Zei — Zei moves.
Aura — Aura moves.

ROUND 2
Archer — Archer moves.
Zei — Zei moves.
Aura — Guard; Aura settles into a guarded stance.
Guard will affect Aura during rounds 3–4!

ROUND 3
Archer stands around and does nothing.
Zei moves.
Zei — Severing Cut; Zei channels edgedancer power into Severing Cut.
Critical hit on Aura! · 16 damage to Archer · 20 damage to Aura
Bleed will affect Archer during rounds 4–6!
Bleed will affect Aura during rounds 4–6!
Aura — Guard, 2 rounds; Aura moves.

ROUND 4
Archer — Severing Cut; Archer channels edgedancer power into Severing Cut.
15 damage to Aura · Bleed will affect Aura during rounds 5–7!
Zei — Severing Cut: Archer gained Bleed.
Severing Cut: Aura gained Bleed.
Severing Cut: Archer's wounds reopen · Bleed deals 2 damage.
Zei stands around and does nothing.
Aura — Basic Attack; Aura drives a measured strike through an opening.
17 damage to Archer.

ROUND 5
Archer — Severing Cut: Aura gained Bleed.
Archer stands around and does nothing.
Zei — Severing Cut: Aura's wounds reopen · Bleed deals 3 damage.
Severing Cut: Archer's wounds reopen · Bleed deals 2 damage.
```

This is a condensed line-preserving transcription of the supplied sequence, not a server event dump. Timing headers can be a presentation attribution error even if mechanical tick state is correct; test both authorities separately.

## 11. Architecture, verification and operational constraints

Read current `AGENTS.md`, battle scoped `AGENTS.md`, `docs/COMBAT.md`, `docs/SKILL_INFORMATION_CONTRACT.md`, `docs/ENGINEERING_EXECUTION_STANDARD.md`, `docs/CONCURRENT_AGENT_WORKFLOW.md`, Master authority and current content contracts. All are included in source.

Monorepo: `apps/web` (Next.js), `apps/worker`, `packages/game-core`, `db`, `validation`, `realtime`, `audio`, `ui`. Runtime recorded as Node24, pnpm11.17.0, Next16.3.8, Vitest4.1.10, Supabase SSR0.12.4/js2.112.3. Treat lockfiles/current package definitions as authority.

Useful quality commands from repository root:

```bash
corepack pnpm install --frozen-lockfile
NEXT_TELEMETRY_DISABLED=1 corepack pnpm check
corepack pnpm --filter @aurevane/web typecheck
corepack pnpm --filter @aurevane/game-core test
corepack pnpm --filter @aurevane/web test
```

Check package scripts before adapting focused Vitest commands. Root ESLint ignores apps intentionally; lint web paths from the web package with `pnpm --filter @aurevane/web exec eslint src/... --max-warnings=0`. A root invocation can misleadingly print ignored-file warnings. Preserve meaningful RED→GREEN mechanics/auth regressions and do appropriate UI/browser validation without writing tests that only mirror trivial CSS.

Existing real-component browser matrix: `apps/web/scripts/battle-targeting-browser-regression.mjs`; supports `AV_CHROMIUM_EXECUTABLE`. Earlier `/tmp/aurevane-chromium-runtime/chromium` and temporary logs were missing by handover time. Install/use the current session's supported browser rather than assuming those paths survive. The released targeting wrapper expects72 cases; if adding cases, update the count honestly while retaining all existing behavior checks.

No local Docker/Supabase service was available in the implementation notes. Real Auth/email and privileged Master/database flows require disposable integration infrastructure/CI. Do not substitute unit tests for actual delivered-email, persistence, rollback, or browser evidence. A full app check must be fresh on the final source, followed by necessary exact-head CI and final source review. Earlier full green runs cannot validate later dirty changes.

Current code preserves saved battle policies/content. New semantic changes require versioned encounter/content policy; do not silently rewrite historical battle outcomes, RNG order or old skill definitions. Enforce server expected-version/idempotency, concealment/privacy, terminal cleanup, costs/cooldowns and immutable Master publication with reason/audit/rollback. Do not weaken validation to make tests green.

## 12. Infrastructure and release boundary

| Service | Known identity |
| --- | --- |
| GitHub | `ZeiJM/Aurevane`, repository ID `1335303167` |
| Supabase | `luazfeupwfgnilohfsya` |
| Vercel team | `team_oZRrN2ckoy5ge7NgZfp1B6de`, `zeijms-projects` |
| Vercel project | `prj_ZmH66I1zyOARUt8OXdTl7CN9r18d`, `aurevane` |
| Canonical site | https://aurevane.vercel.app/ |

`apps/web/vercel.json` deliberately disables automatic Git deployment with `"**": false`; preserve this. Merge alone is not deployment. Existing migration `20261007101310` belongs to earlier elevation work; do not reapply it. Prior read-only checks found no published Skill/Essence/Resonance overrides, but this is time-sensitive and must be checked again before a conversion/publication strategy.

Release authorization history is imperfect in the retained materials. The historical imported handover quotes broad standing publication authorization; the later compacted notes say that authorization covered the previous batch and to obtain explicit authorization for Production changes to the new batch. This package does not resolve that discrepancy by inventing a new permission. Current user request is packaging, and no deployment/migration was attempted. In the new chat, finish the concrete reviewable implementation and verification first; then apply the current user's actual authorization and current release rules before Production actions.

GitHub connector operations previously supported exact tree/blob/commit creation, expected-head ref update, PR creation/merge and CI evidence retrieval. Tool names/schemas may change; discover them. Never force-push over Main or overwrite another chat's changes. Before any integration, refresh Main, compare source trees, maintain branch isolation and verify the final tested source identity.

## 13. Recommended continuation sequence

1. Read this handover and audit; inspect screenshots and authoritative repository documents. Confirm current Main and actual accessible source. Try to recover later edits only from real available artifacts; don't spend indefinitely searching for commits already absent from this package.
2. Recreate the new-batch plan with all items above, marking preserved diagnoses separately from implemented state. Resolve the missing exact recovery-content percentage table with concrete actual content, not invented recovered values.
3. Reapply/recover scanner-safe recovery and DoT narration/round attribution, with meaningful focused tests. Preserve current source behavior where existing tests prove it already correct.
4. Recreate grouped readers and finish the new per-packet scaling/roll policy, all factory pins and replay compatibility. This was the active implementation priority at the old stopping point.
5. Finish Auth template/config and real-browser acceptance setup; implement tile-corner arrows, seamless Ground loop and retained Line glows.
6. Implement captured percentage recovery, immutable current-content revisions and the single Master timing selector, persistence/migration, Delayed activation and cast-position Rewind.
7. Run appropriate focused/full checks and actual browser/database/email acceptance. Perform one useful whole-branch review of the final implementation; resolve findings with evidence rather than repeating review loops.
8. Prepare concrete source/release/config/migration notes, current evidence and the complete Owner checklist. Only claim deployment if an authorized exact-source deployment actually reaches READY and passes matching alias/smoke/log verification.

Avoid redoing the already released prior-batch fixes merely because historical notes still say pending. Conversely, do not claim the new work exists simply because the old chat once reported it.
