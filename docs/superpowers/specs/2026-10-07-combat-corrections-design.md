# Combat corrections, persistent ground areas and capped DoT triggers

Status: concrete design for Owner review; no implementation or new release claimed.

## Intent and scope

Nick reported eleven corrections with twelve screenshots, then added once-per-turn Burn/Poison gimmick limits and precise Resonance setup wording. The outcome is readable and continuous combat presentation, honest targeting information, persistent ground areas with bounded entry effects, and percentage-based reactive damage. Apply relevant presentation changes through shared desktop/mobile PvE, PvP and spectator components. Preserve artwork sizes, identity colors, costs, server authority and unrelated Phase 5 work.

Current Main inspected: `443b61398d53f7a303bbbf33a75b2927b33c9075`. Previous combat release remains live. This correction work uses isolated branch `agent/combat-corrections-20261007`. Standing Owner authorization covers publishing this completed, verified task; no second deployment permission is required.

All thirteen screenshots were recovered through their supplied upload IDs and inspected. Do not infer unseen details from the earlier missing-file messages.

## Confirmed decisions and proposals

The Owner answered the Burn basis question: **Burn backlash uses the burning unit's own attack damage, rather than the attack that originally applied Burn.**

Proposed initial Burn backlash rate: **10%**, rounded down. Poison movement retains the exact percentage already authored for that application. Both extra triggers are limited to once per affected character's turn cycle. These limits are additional to ordinary scheduled end-turn ticks.

Two ground-area approaches were considered:

1. Extend only the existing Frozen/Steam terrain overlay. This is smaller but cannot honestly represent a persistent authored damage/status payload, its recipients and its trigger bookkeeping.
2. Add a typed persisted ground-area instance alongside terrain overlays, using the existing targeting/effect services. Recommended: it supports the requested mechanics without rerunning the entire original command on movement.

For elemental targeting, keep explicit authored recipient policies rather than enabling all elemental attacks to damage allies/self. Elemental interactions are consequences of a legal hit, not a universal friendly-fire permission. A skill intentionally designed for self/allies must advertise and support that policy; existing ally-healing skills remain self-eligible when their actual contract allows it.

## 1. Shared visual and input corrections

- Facing: replace the tiny unbacked arrow above each portrait with a compact dark compass badge, an identity-colored rim and a clearly shaped directional arrow. Maintain the character's unique color, no input interception, no clipping at board edges, and readable mobile sizing. Do not enlarge portraits or replace their art.
- Circle: remove the artificial blue caster-tile fill. The caster tile is outside the Circle footprint; arming a Circle produces no center glow, including when a separate actor effect exists. Its authored actor effect still executes normally.
- Invalid targets: remove incidental red target outlines beyond the potential footprint. Preserve red legal damage footprints and identity rings. Out-of-range clicks remain rejected by the server and can display the existing textual explanation.
- Ground preview: orange takes precedence for a Ground-targeted action; unit damage previews remain red, ordinary buff selections blue and heal/recovery selections green. Orange marks the actual affected footprint, not every tile accepted by the selection helper. Circle is caster-centered, Line uses the selected cardinal lane, Single uses its selected legal tile; authored All remains the explicit whole-field method. Ground targeting does not imply All.
- Escape/input: cancel and dismiss operations return focus to the existing neutral battle root without drawing an action-selection box. Closed controls must not block the next valid combat shortcut. Preserve open-dialog, text-entry, repeat, modifier and pending-command safeguards; preserve intentional accessible focus in reading surfaces and browser shortcuts. Plain Tab must not resume battle focus cycling.
- Post-battle log: opening Review Battle Log switches to a compact result header and a large, dedicated Chronicle reader. Retain Copy Full Log and result actions. Default the full-history review to its beginning, preserve intentional scrolling during updates, and avoid competing nested summary/transcript scrollbars. Desktop and mobile must reserve enough transcript height to read complete actions.

## 2. Continuous effect rail projection

Source evidence:

- `battle-session-service.ts` projects normal views with `projectBattleStatusStateForViewer` and `projectBattleEffectStateForViewer`.
- `battle-recruit-ai-service.ts` returns raw status/effect snapshot fields via a separate `projectBattleSnapshot`.
- `BattleExperience.runRecruitTurn` replaces the mounted snapshot with that Recruit response.
- `BattleCombatantCard` reads only the projected `snapshot.statusState` rows.

This is a concrete explanation for persistent DoT icons vanishing after Recruit actions and pending-to-active rows temporarily disappearing. Prove it with a regression covering the actual service response and mounted update, then route all normal participant-facing responses through one viewer-entitled projection. Do not conceal the bug with a timeout, previous-row cache or synthetic extra duration.

The rail must derive active Burn/Poison/Bleed rows from persisted typed instances for their complete remaining lifetime. Pending and active versions of an effect transition in one committed snapshot; stable presentation identity avoids unnecessary remounts. A valid expiration, removal or defeat immediately removes the row. Reader parity must hold for AI commands, ordinary commands, refresh/poll, reload, PvP and spectators, without leaking private command/dependency information.

## 3. Self/ally terminology and Resonance requirements

Use one target-policy presentation helper across Skill/Essence popups, compact tags, Master previews and Manual readers. It must account for self exclusion, minimum range, shape and recipient/friendly-fire restrictions:

- Self only: `Self`.
- Self plus other friendly units: `Self / Ally`.
- Friendly units excluding the caster: `Ally`.
- Enemies only: `Enemy`.
- Explicit all-unit targeting: name Self/Ally/Enemy eligibility accurately.

Do not convert an ally policy into a new self-damage permission merely to repair its label.

`tempo` in advanced Resonances is an internal matcher tag; it is not the Utility family. The existing Chronist roster assigns it to specific support/control/defense Skills. Generate setup/trigger text from the actual pinned matcher and the qualifying pinned Skill definitions. Show explicit qualifying Skill names where an internal tag would be ambiguous. Measured Flare must name exactly which Chronist Skills arm it and which Cinderweaver attacks consume it. Use this shared explanation for every Resonance, including Profile, battle and Master previews. Preserve setup expiration/consumption mechanics and historical versions. If a trigger has no qualifying current Skill, report it as a content defect instead of inventing a synonym or silently broadening its trigger.

## 4. Persistent ground-area contract

### Definition and authoring

Add explicit immutable Ground metadata to eligible Ground-targeted definitions: duration in global rounds, a registered visual preset and a validated entry-effect payload. Display `Ground [N rounds]` separately from any unit DoT's duration. New persistent damage/status ground content must author its lifetime; direct damage with no duration cannot silently become permanent.

For current conversions, author the duration explicitly from the existing repeated effect's lifetime when present (Flame Burst's three-turn Burn becomes a three-round ground area). For a ground damage skill without a repeated lifetime, propose two rounds. Pure Frozen/Steam terrain operations retain their existing typed lifecycle and do not acquire invented damage ticks. Summons on Empty Ground remain summons.

Reuse the existing Master Combat Content publication authorization, expected-version, reason, semantic diff, preview and audit flow. Ground animation selects a finite registered preset such as embers, frost or arcane pulse. This is the scoped VFX registry/runtime needed to make the currently read-only VFX hook editable for ground areas; no arbitrary JavaScript, CSS or executable uploads. Preview and reduced-motion alternatives come from the same registry.

### Committed state

Each area stores a stable instance ID, pinned source/definition identity, source team, frozen caster combat values needed by its entry payload, exact server-resolved tiles, activation/expiry rounds, recipient policy, pinned visual preset and per-recipient trigger bookkeeping. Validate stored fields during persistence/reload. Tiles never follow the caster after placement and never reroll on preview, reload or spectator reads.

Lifetime uses the authored timing policy: next-round placement is visibly pending until its activation boundary; Instant placement begins in the current round. Expiry is `activationRound + authoredRoundCount`, with the activation round counted once. No decrement occurs just because the cast command was submitted. Pending areas use a quiet static marker; active areas animate and show their remaining lifetime. Both disappear at their recorded expiry/removal, including after reconnect. Direct cast damage retains its separately authored Instant timing.

### Cast hit and entry pulse

- The ordinary cast resolves its current occupants through the canonical attack/hit/resistance pipeline and spends its cost once.
- Placement persists even on empty tiles. A missed unit does not prevent the ground area being created.
- Entry into an active affected tile resolves the pinned entry payload once for that eligible combatant and area during that character's turn cycle. Initial hits reserve that cycle's allowance when the area is active, preventing immediate exit/re-entry double hits.
- Repeated movement inside the same area, leaving/re-entering, and displacement cannot bypass the cap. Overlapping tiles from one cast share one cap. Distinct casts remain distinct areas; this is not an unrequested global immunity against other skills.
- Entry follows each actually traversed tile, including Push/Pull. An instantaneous relocation processes only its landing tile; rejected movement processes nothing. Defeat stops further movement and effect resolution through the existing terminal rules.
- Entry effects support explicitly authored damage, healing/resource changes and permitted status/DoT payloads. They do not rerun AP/MP costs, cooldowns, setup/payoff, actor buffs, summoning, Copy, displacement or action selection. Unsupported entry-effect combinations are rejected in authoring.
- An entry pulse uses frozen caster values and the entrant's current defense, barriers, immunity and applicable modifiers. It has no new critical or accuracy reroll: the committed persistent area's entry effect is deterministic. Ordinary debuff resistance follows an explicitly tested once-per-entry resolution, never a preview draw.
- Percentage DoTs applied by a ground entry capture that pulse's actual hostile HP damage. Self/friendly damage, reflection, backlash and recovery remain excluded. Zero hostile HP loss cannot apply or replace a percentage DoT.
- Entry damage is a separately identified ground pulse in the Chronicle, retaining element and viewer-safe source. It does not recursively create another ground area or trigger direct-command-only Absorb/Reflect/Resonance effects.

Ground expiry ends the area and its animation; it does not retroactively erase a separately applied unit status with its own remaining lifetime.

## 5. Percentage Burn backlash and capped Poison movement

New encounters pin a new DoT-trigger policy rather than changing existing saved battles. Store turn-cycle trigger use on the affected combatant so reapplication, removal/reapply, Copy, reload and a different effect source cannot reset the cap. A cycle begins at that character's turn start; forced movement between their turns belongs to their current cycle. Application before the first turn uses the initial cycle. Scheduled end-turn ticks remain independent.

Burn:

- Capture active Burn eligibility at the start of a damaging command, preserving existing command-start semantics.
- After the command's direct attack damage settles, sum actual hostile HP loss caused by the burning actor across hits/eligible recipients. Apply `floor(total * backlashBasisPoints / 10000)` to the burning actor, once in their cycle. Initial proposed rate is 1000 basis points (10%); expose the authored percentage in the existing Burn editor and all readers.
- Crits and Barrier/remaining-HP clamping are reflected in that captured loss. Exclude friendly/self, ground-entry, periodic, reflected and other reactive damage. Misses/zero direct HP loss cause no backlash and leave the allowance available for a later successful attack.
- A positive eligible damage basis reserves the allowance even if rounding produces zero. Additional attacks in that cycle cause no further backlash. Do not fabricate a minimum of one HP or recursively reflect/absorb backlash.
- Terminal resolution and already-defeated actors remain authoritative; no post-terminal command or duplicate defeat/reward event.

Poison:

- Current movement damage already calls `currentPoisonTickDamage`, which uses the persisted attack percentage when present. Keep that authored percentage rather than adding a second raw-HP amount.
- Five traversed tiles trigger at most one extra percentage tick per affected character's cycle. Include voluntary movement and displacement; relocation does not add traversed distance.
- Retain partial progress modulo five between turns. Thresholds crossed after the cycle cap is used do not bank delayed extra ticks for the next turn. Entry is processed in actual step order and stops on defeat.
- The extra tick does not consume a scheduled end-turn tick or extend the lifetime. Reapplication retains normal basis/duration replacement but does not reopen the cycle allowance. Copy preserves the donor's application profile without importing or resetting recipient turn-use bookkeeping.

Shared tag descriptions explicitly state the percentage basis, rounding and once-per-turn limit. Historical fixed-damage and previous percentage-policy battles keep their pinned semantics.

## 6. Verification and release acceptance

Use focused failing regressions before implementation. Required cases include:

- All arrow directions against open/rough/elevated backgrounds, board edges and identity colors; static reduced motion.
- Empty and occupied Circle centers without glow; out-of-range Single/Line/Circle occupants without incidental red outlines; valid full footprints preserved.
- Orange Ground Single/Line/Circle footprints, empty placement, strict range/elevation/LoS, explicit All, and no cost/RNG mutation from aiming.
- Actual Recruit endpoint projection and mounted rail continuity across pending activation, every DoT tick, replacement, Cleanse, expiry and defeat; PvP/spectator privacy parity.
- Click, Escape, next hotkey and rapid command input; no stale focus lock or Tab cycling, with open readers/text inputs still protected.
- Actual self/ally selection legality and matching labels; all current Resonance matcher descriptions and qualifying names.
- Persistent ground cast/reload/timing/expiry/visuals, once-per-cycle movement cap, multiple tiles, exit/re-entry, displacement, landing, overlapping independent casts, zero damage, dead source/recipient, terminal cleanup and exactly-once persistence.
- Burn actual outgoing damage basis, misses, zero/flooring, multi-hit/AoE/crit/Barrier/overkill, one use per cycle, reapply/Copy/reload cap retention, and historical compatibility.
- Poison percentage movement ticks, five-tile threshold/carry, multiple movement commands, forced movement, cycle reset, no banked excess, expiry and terminal behavior.
- Master registered ground preset/duration/Burn-percent draft, preview, publish, reload, rejection, stale-version, audit, rollback, role authorization and old/new encounter pinning.
- Desktop/mobile PvE/PvP and spectator visual acceptance, including post-battle log reading and copy parity.

Run the repository quality gate and actual database/browser acceptance on the final source. Refresh Main before finalization, reconcile overlapping work, inspect real screenshots and runtime evidence, then merge and publish the verified result under standing authorization. Do not mark this batch complete or live until deployment READY/source matching and production smoke checks succeed. Provide the Owner a complete list of changes to test after that release, including all original corrections, the once-per-turn clarification and Resonance terminology.

## Design limits

This draft establishes the requested combat contract; it does not claim code changes, a new migration, human playtest acceptance or a new production release. No unrelated P5, map-page, progression, login or story work is included.
