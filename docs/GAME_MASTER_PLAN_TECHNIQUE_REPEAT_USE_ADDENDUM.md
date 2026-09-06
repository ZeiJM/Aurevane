# AUREVANE — Technique Loadouts & Consecutive-Use Falloff Addendum

**Status:** Owner-approved authoritative game-design addendum to `docs/GAME_MASTER_PLAN.md`.

**Direction approved:** 2026-09-06.

This addendum supersedes conflicting earlier wording about selected Discipline Technique capacity, mixed-Discipline slot splits, and ordinary authored Skill cooldowns in `docs/GAME_MASTER_PLAN_BUILD_SYSTEM_ADDENDUM.md`, `docs/COMBAT.md`, `docs/PHASE_3_TICKETS.md`, `docs/ROADMAP_BUILD_SYSTEM_REWORK.md`, `docs/ROADMAP.md`, and older tickets/tests/prose. Existing server authority, Action Economy, targeting, Effect Catalog, build snapshot, AI/PvP parity, progression, and anti-pay-to-win rules remain in force unless explicitly changed below.

---

## 1. Selected Technique loadout

The active combat cockpit carries **up to four selected Discipline Techniques**.

### Pure build

A Primary-only build may select up to four learned Techniques from its Primary Discipline.

```text
PURE SELECTED TECHNIQUES = 0–4 PRIMARY
```

The pure Discipline's **Essence Skill remains outside those four selected Technique slots**.

### Mixed build

A Primary + Secondary build may select up to four learned Discipline Techniques total across the two active Disciplines.

A **full four-Technique mixed loadout** must include at least one Technique from **each** active Discipline. Partial mixed loadouts with fewer than four selected Techniques may temporarily come from one active Discipline while the player configures or transitions the build; they are not treated as a completed four-slot allocation.

For a full four-Technique loadout the legal splits are:

```text
PRIMARY / SECONDARY
1 / 3
2 / 2
3 / 1
```

The following full allocations are illegal:

```text
0 / 4
4 / 0
```

The server must enforce this rule authoritatively. The browser may guide selection but cannot be the legality boundary. Discipline changes must not strand a character in an unreadable or unusable build merely because the previous partial selection belongs to only one of the newly active Disciplines.

Mixed builds retain their resolved Resonance passive and do not gain a pure Essence while a Secondary is active.

---

## 2. Technique source visibility

Character Profile Technique management shows only learned Techniques belonging to the character's **currently active Discipline set**.

- pure build: Primary Discipline Techniques only;
- mixed build: Primary + Secondary Discipline Techniques only;
- inactive Discipline Techniques are not shown as disabled clutter in the active loadout picker.

The selected Technique UI must identify each Technique's source Discipline and cockpit role/type.

---

## 3. Authored Skills no longer use ordinary turn cooldowns

Ordinary authored combat Skills — including Discipline Techniques and Essence Skills — do **not** become unavailable for a fixed number of turns after use.

The previous mature-Skill cooldown rule is retired for these authored Skills.

The canonical anti-spam rule is now **consecutive-use effectiveness falloff**.

### Consecutive-use rule

When an actor uses the same authored Skill twice consecutively:

```text
FIRST USE        = 100% EFFECTIVENESS
CONSECUTIVE USE  = 50% EFFECTIVENESS
```

Every further consecutive use of that same Skill remains at 50% effectiveness until the chain is broken.

Action Economy/AP cost is **not** discounted. The player pays the normal authored AP cost even when the repeated Skill is reduced.

Using a different combat command breaks the consecutive-use chain. Merely ending a turn does not break it: if the actor's last actual command was Skill A and their next actual command on a later turn is also Skill A, the second use is still consecutive and receives the penalty.

The repeated-use state is server-owned combat state and must survive serialization/reconnect exactly like other authoritative battle state.

---

## 4. Effect scaling under repeated use

The 50% rule applies to authored effect strength, not only damage.

For deterministic integer effects:

- damage amount: 50%, rounded down, minimum 1 when the original amount was positive;
- healing amount: 50%, rounded down, minimum 1 when the original amount was positive;
- signed resource change: 50% magnitude, rounded toward zero, minimum magnitude 1 when the original delta was non-zero;
- discrete status stacks: 50%, rounded down; a one-stack application therefore contributes zero stacks on the repeated use and is omitted;
- later effect types must define an explicit deterministic 50% interpretation before they can participate in this system.

Targeting, requirements, AP affordability, friendly-fire rules, PvP normalization, and all other legality checks remain unchanged.

Forecasts/previews must use the same scaled effect list as execution so the client never previews full value and then receives half value unexpectedly.

---

## 5. Resonance interaction

Resonance remains a passive mixed-Discipline interaction.

A Resonance payoff attached to an authored Skill resolves through the same authoritative Skill execution path. Consecutive-use falloff applies to the authored Skill/effect package resolved for that use; Resonance sequencing itself remains governed by its typed setup/payoff rules.

Resonance is displayed in Profile as part of the character's **Build Signature**, with its own artwork and source Discipline context.

---

## 6. Essence interaction

Essence remains the pure-build signature Skill outside the four selected Technique slots.

Profile presentation uses a contextual Build Signature heading:

```text
Build Signature · Essence Skill
{Name}
```

For a mixed build with Resonance the corresponding heading is:

```text
Build Signature · Resonance
{Name}
```

The signature card shows its artwork and relevant source/AP/type metadata without repeating “Essence Skill —” or “Resonance —” before the name.

Essence uses the same no-cooldown / consecutive-use 50% effectiveness rule as other authored Skills.

---

## 7. Basic actions and legacy cooldown infrastructure

This addendum changes **authored Skills**, not every possible timed mechanic in the combat engine.

Basic Recover/MP recovery may retain their existing bounded basic-action cooldown until explicitly revised. The generic cooldown utility may therefore remain available for basic actions or future exceptional systems that explicitly require a cooldown.

Existing mature-Skill definition fields that still contain historical cooldown metadata are **transitional inert metadata** after this addendum. They must not make authored Skills unavailable in runtime combat and should be removed from the mature authoring schema in a focused cleanup once dependent content/tests/tooling are migrated.

No new authored Skill content should rely on those legacy cooldown values for gameplay.

---

## 8. UI contract

The Character Profile Techniques overlay should remain compact and tactical rather than instructional.

It must:

- show only active-Discipline Techniques;
- show source Discipline, AP cost, and cockpit role/type on Technique cards;
- omit learned-version text from ordinary player-facing cards;
- omit retired turn-cooldown chips from authored Skill cards;
- show one pure Discipline selection counter or one counter per active Discipline for mixed builds;
- communicate the mixed 1–3 / 2–2 / 3–1 full-loadout rule without redundant helper copy;
- permit partial mixed selections while a build is being configured;
- present Essence/Resonance in a premium Build Signature surface with artwork;
- label that surface `Build Signature · Essence Skill` or `Build Signature · Resonance` as applicable;
- show the signature name without repeating the signature type in front of it;
- show a pure Active Build as the Discipline name alone, without a redundant “Pure” suffix;
- keep commit/clear actions readable and consistent with the rest of the Profile UI.

---

## 9. Permanent authority requirements

All implementation of this rule must preserve:

- server-authoritative combat and build legality;
- deterministic reconnect/replay behavior;
- stable committed build snapshots;
- AI obeying the same repeated-use effectiveness rule as players;
- PvE and PvP using the same authoritative rule path unless a later explicit mode coefficient is approved;
- client previews never becoming an authority source;
- typed/versioned authored content and effects.
