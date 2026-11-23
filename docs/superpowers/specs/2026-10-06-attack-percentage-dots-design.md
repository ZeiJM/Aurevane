# Attack-based percentage DoTs

Status: prepared for Owner review; product implementation has not started.

## Approved intent

Nick wants Burn, Poison, and Bleed to scale from the HP damage their Skill's attack deals to each enemy. A Skill that authors any of these DoTs must also have an attack tag and a direct damage effect. Burn and Poison no longer stack; Bleed has no artificial stack cap. Preserve Burn's attack backlash and Poison's five-tile movement punishment. Replace fixed-HP parameter brackets and explanations with percentages. Percentages must be editable per Skill and Essence through the existing Master Panel workflow.

Owner selected: rebalance the percentages; reapplying Burn or Poison replaces the old application and restarts its duration; Burn continues weakening with each tick. Existing battle timing, server authority, accuracy, status resistance, criticals, and historical version pinning remain constraints.

## Chosen approach and alternatives

Extend the existing typed DoT effects and resolution path. Capture a separate, immutable attack-damage basis for every recipient and store it with the application. Reuse the existing tick, movement, backlash, cleanse, copy, authoring, and publication systems.

Recalculating from current attacker stats each turn would break the requested link to damage actually dealt and change outcomes after reloads or stat changes. Replacing the entire status system would add unrelated scope and jeopardize existing timing and provenance. Neither is needed.

## Damage basis and arithmetic

- The basis is actual hostile HP loss from direct damage effects in the same command, after defense, outgoing/incoming modifiers, criticals, Barrier, and remaining-HP clamping. Use the original command's damage receipts, before Absorb or Reflect output is added.
- Sum multiple direct hits to the same recipient once. An AoE captures each recipient's own sum. Exclude friendly/self damage, periodic ticks, backlash, reflection, absorbed recovery, and other commands.
- A miss, resisted DoT, defeated recipient, or zero actual HP damage creates no new percentage DoT. It also does not replace an existing Burn/Poison.
- Each tick is `floor(capturedDamage × tickPercentageBasisPoints / 10000)`. Use checked integer/BigInt arithmetic. A positive damage basis can produce a zero-HP tick at a small percentage; do not silently replace the percentage result with a fixed minimum of 1 HP.
- The captured damage never changes during the application's lifetime. Persist the authored percentages, captured basis, remaining ticks, Burn stage, and source/provenance.

Example: an attack deals 40 HP damage. Burn at 25%, 20%, and 15% ticks for 10, 8, and 6 HP. Poison at 15% ticks for 6 HP, including its extra movement ticks. Bleed at 20% ticks for 8 HP per active application.

## Lifetime, replacement, and special behavior

Keep the recorded instant/next-round policy and existing end-of-turn boundaries. Applying a DoT does not consume one of its future ticks merely because the target currently owns the turn.

- **Burn:** one active application per recipient, across all sources. A successful reapplication replaces it, captures the new attack's basis, and restarts at stage 0 with the new duration. Its first percentage is authored; each subsequent tick reduces it by the authored percentage-point decay. Authoring must keep every scheduled percentage positive. Backlash stays fixed at 2 HP per damaging command after that command resolves, including a miss; multi-hit/AoE remains one backlash, and pending Burn cannot trigger it.
- **Poison:** one active application per recipient, across all sources. Reapplication replaces it, restarts its duration, and starts a fresh movement counter at 0. Every five traversed tiles causes an extra tick using the captured percentage. Movement progress carries between turns; tile-by-tile movement and displacement count, instantaneous relocation does not. Extra movement ticks do not consume scheduled end-of-turn ticks.
- **Bleed:** each successful application is independent, with its own captured basis, percentage, duration, and source. No new three-stack or fixed 80-HP-total cap. Tick all active applications deterministically and preserve each application through reloads.
- Pending Burn/Poison must also obey replacement: keep only the latest valid queued application of that type for each recipient. Keep at most one active application while its queued replacement waits; replace the active one when the new application activates, respecting the pinned timing policy. Cancel superseded queued recipient entries without deleting other recipients of an AoE.
- Copy Debuffs transfers an already authored application; it does not author a new DoT tag or require a damage effect on the copy Skill. Preserve the donor's captured basis, percentages, remaining lifetime, and lineage. Enforce the single Burn/Poison rule at the receiver and leave the donor unchanged. Preserve current copy eligibility and immunity/resistance boundaries.
- Cleanse, defeat, battle completion, and terminal-state handling remain authoritative. They must not leave an orphan dependency or apply a tick/reward twice.

### Delayed attacks

The Master Panel can also configure direct damage as next-round. Do not base a DoT on damage that has not occurred yet. Bind delayed percentage DoTs to their originating command's scheduled damage, using a stable persisted command/dependency identity. When that command's damage resolves, capture its actual per-recipient HP loss and apply or queue its eligible DoTs. A dependent DoT cannot activate before both its configured activation boundary and the triggering damage. Multiple casts of the same Skill in the same round must never share a damage basis. No additional accuracy/resistance roll occurs at activation.

## Initial roster rebalance

Create new immutable versions for these nine current definitions. Preserve existing damage power, range, elevation, MP, AP, cooldown, other effects, requirements, media, and flavor unless a change is listed here. Current version numbers differ by Skill; do not assume a global version number.

| Skill / Essence | DoT percentages | End-turn ticks | Additional change |
| --- | --- | --- | --- |
| Ravager — Gash | Bleed 20% | 3 | None |
| Edgedancer — Severing Cut | Bleed 15% | 3 | None |
| Wildwarden — Venom Shot | Poison 15% | 4 | None |
| Cinderweaver — Cinder Bolt | Burn 25% → 20% → 15% | 3 | None |
| Cinderweaver — Flame Burst | Burn 20% → 15% → 10% | 3 | None |
| Cinderweaver — Ember Line | Burn 20% → 15% → 10% | 3 | None |
| Cinderweaver — Blistering Heat | Burn 15% → 10% → 5% | 3 | Add Fire Dmg [6] to the same primary enemy; 50 AP, 3 MP; attack/Mystic category; keep Slow [2 turns], range, elevation, and 2-turn cooldown |
| Ravager Essence — Red Tempest | Bleed 20% | 3 | None |
| Cinderweaver Essence — Phoenix Wake | Burn 25% → 20% → 15% | 3 | None |

These are deliberate starting values: Bleed gains sustained stacking pressure, Poison gets 60% total scheduled damage plus movement punishment, and Burn gets 30–60% total scheduled damage plus backlash. Verification must compare complete legal builds and per-AP/cooldown value, rather than claiming balance from percentages alone. Report measured outcomes and any proposed adjustment before changing this table.

## Master Panel and player-facing descriptions

Extend the existing Skill/Essence effect editor and draft → validate → preview → publish path.

- Poison and Bleed expose **Damage per tick (% of attack damage)** and their existing duration/tick control.
- Burn exposes **First tick (% of attack damage)**, **Decay per tick (percentage points)**, and duration, with a live readable percentage sequence.
- Percentages use validated basis points internally, while the form accepts percentages with 0.01-point precision. Valid scheduled percentages are 0.01% through 100%; Burn decay may be 0 but may not produce a nonpositive scheduled tick. Duration stays 1–4 ticks. Invalid/NaN/nonfinite/unsafe input fails server validation as well as form validation.
- Owner edits are not silently reset by runtime rebalance functions. Save/publish preserves exact authored values and appends a new version. Authorization, reasons, audit metadata, expected draft/base version, and conflict handling stay in place.
- Publishing a current DoT definition requires the attack tag and an eligible direct damage effect covering the DoT's recipients. Reject standalone fixed-HP DoTs in newly published current definitions, and explain how to add the required damage effect. Historical definitions remain readable and executable under their pinned contract.
- All readers derive from the same immutable definition. Examples: `Poison [15%] [4 turns]`, `Bleed [20%] [3 turns]`, and `Burn [25% → 20% → 15%] [3 turns]`, with timing shown by the existing reader.
- Descriptions explain that percentages refer to HP damage dealt by that attack, identify nonstacking/stacking behavior, and retain Burn backlash and Poison movement rules. Current rail inspection shows the captured basis and resulting tick HP where relevant, without exposing private information about another viewer's build or command.
- Use shared adapters across battle Skills/Essences, Skill Management, Master Panel preview/review, Manual, and Resonance results that display a transferred DoT. Preserve effect-name labels added by the UI batch.

## Versioning and release

- Pin a new percentage-DoT policy for newly created PvE, PvP, multi-participant/quality, and training encounters. Existing snapshots without it keep their historical fixed damage, stacking, and movement behavior. Historical content versions and stored active battles are not rewritten.
- New-build authority resolves and pins current definitions at battle creation. Subsequent Master Panel edits do not alter a battle already underway.
- Extend typed effect/state validation and public projection intentionally. Invalid percentage state or dependency metadata fails closed; never infer a percentage from a legacy fixed number.
- Reuse existing JSON definition/state storage. No unrelated Phase 5 migration, table deletion, or schema cleanup belongs to this task.
- Before release, inspect current published DoT definitions. If a published database version overrides a built-in, append a converted version through the existing audited, expected-version publication path, preserving unrelated Owner customizations. Do not rewrite old published versions or bypass the current pointer by mutating a resolver's returned version.
- Keep automatic Git deployments disabled. Release only the final verified merged source and the reviewed content conversion. The Owner has standing authorization to publish completed work.

## Required verification

Use focused failing regression tests before implementation, then the full repository gate and exact-head workflows.

1. Damage basis: actual post-Barrier HP loss, mitigation, criticals, overkill, misses, zero damage, different AoE defenses, multiple hits, effect reordering, and excluded reactive/friendly/periodic receipts.
2. Pending/instant matrix: damage and DoT each instant/next-round; target turn already active; repeated same-Skill casts in one round; delayed resistance not rerolled; superseded pending applications; reconnect/serialization; terminal recipient/source states.
3. Burn/Poison: single instance across multiple attackers, fresh replacement values/duration, preserved special triggers, Poison movement carry/reset/displacement/relocation, Burn decay and one backlash on multi-hit/AoE/miss.
4. Bleed: more than three independent applications, unequal attack bases and durations, safe aggregation, copy/cleanse/defeat, no newly introduced cap, and historical fixed/capped snapshots unchanged.
5. Master Panel: editable percentage controls for all three types, invalid input, exact save/read/preview/publication round-trip, permission denial, stale draft/base conflict, edited values surviving a new battle, and old battle pinning.
6. Presentation: matching percentage brackets/descriptions in Skills, Essences, Master Panel, rail popups, desktop/mobile PvE/PvP, and spectators; no fixed `1/1/1` claims for percentage definitions.
7. Balance: existing legal-build harness with the new nine-definition roster, per-AP/cooldown comparison, low/high damage and multi-recipient cases; report observations without fabricating human playtest acceptance.

## Scope boundary

This task changes attack-bound DoTs, related current Skill versions, percentage authoring, and their reports. It does not redesign other stacking effects, the combat kernel's reaction grammar, movement, initiative, map/Phase 5 work, rewards, or unrelated layout.
