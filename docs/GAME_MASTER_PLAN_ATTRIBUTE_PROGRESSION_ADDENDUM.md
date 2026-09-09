# AUREVANE — Attribute Progression and Stat Guardrails Addendum

**Status:** Owner-approved authoritative addendum to `docs/GAME_MASTER_PLAN.md`.

**Direction approved:** 2026-09-06. **Foundation non-focus cap policy approved:** 2026-09-08. **Level-range adventure scaling and Profile presentation approved:** 2026-09-09.

This addendum supersedes conflicting earlier wording about the current Level cap, per-Level core-attribute growth, attribute redistribution, Discipline-specific attribute ceilings, and the global Critical Chance / Evasion / Movement / Jump limits.

## 1. Current Level cap

The current production Level cap is **50**.

The progression curve remains versioned and server-authoritative. Historical XP above the current cap may be preserved, but current Level resolution cannot exceed 50.

## 2. Core-attribute point growth

Characters gain **1 additional assignable core-attribute point for every Level gained after Level 1**.

The Level-1 creation pool is the existing six-attribute starting allocation. Those starting points are not permanently locked to their original attributes.

At Level 50, a character therefore has the full Level-1 pool plus 49 earned points available for legal allocation.

Unspent earned points may remain unassigned until the player chooses to spend them.

## 3. Full redistribution / reset

An attribute reset returns the character's **entire legal core-attribute pool**, including the points originally distributed during character creation, for redistribution.

The reset does not merely refund points earned after Level 1.

Normal minimum-value validation still applies, as do any active Primary Discipline off-identity ceilings.

Production reset allowance:

- **5 resets per 30-day reset window**;
- the timer begins when the first reset in a fresh window is committed;
- all 5 resets replenish together after the 30-day window expires;
- reset usage and window timing are server-authoritative.

### 3.1 Profile allocation presentation

The permanent Profile layout should not be dominated by the full redistribution controls.

- The normal Profile presents a compact Attribute Management area.
- **Reset / Redistribute Attributes** is a prominent red action that opens the complete allocation workspace in a modal.
- Unspent Level or other earned attribute points use the same modal in point-spend mode.
- An open attribute modal is represented in Profile URL state so a browser refresh does not silently dismiss it.
- The player may dismiss the modal and return later; unspent points remain owned and available until committed.
- Closing by clicking the modal backdrop is supported.
- The modal must display the point pool, unspent count, reset allowance/renewal, Primary focus attributes, active off-identity caps, and authoritative commit controls.

The browser presentation is convenience only. The server remains authoritative for point ownership, legal allocation, reset allowance, and commit validation.

## 4. Discipline caps are identity guardrails, not templates

Primary Discipline may define:

- focus attributes;
- ceilings on off-identity attributes;
- optional bounded derived-stat constraints where specifically authored.

The intent is **not** to make characters of the same Discipline converge on identical stat lines.

A Discipline's focus attributes are the axes it is expected to specialize in and **must not receive restrictive Discipline attribute caps**. Players may distribute heavily or lightly among those focus attributes according to their build goals.

For the current six Foundation Disciplines, every non-focus core attribute has an owner-approved **maximum value of 30 while that Discipline is Primary**. Focus attributes remain uncapped by Discipline identity. This ceiling is deliberately permissive enough for serious hybrid investment while preventing an extreme off-role allocation from functionally replacing the selected Primary Discipline.

Global derived-stat ceilings remain independently authoritative. Reaching a Discipline attribute ceiling does not bypass Critical Chance, Evasion, Movement, Jump, Accuracy, Status Resistance, or any other authored derived-stat limit.

Future Disciplines may define exceptional off-identity policies only when their mechanics justify doing so. An omitted ceiling in a future policy means that attribute is uncapped by that specific Discipline policy.

### 4.1 Foundation starting identities and active ceilings

Choosing a Foundation Discipline at character creation preloads a **recommended starting spread** for the existing six-point creation bonus budget. This makes the Discipline's intended identity immediately visible without locking the player into a template.

Current Foundation policies:

- **Vanguard** — Focus: Might and Vitality. Starting bonus spread: **+3 Might, +3 Vitality**. Non-focus cap **30** on Finesse, Agility, Intellect, and Resolve.
- **Farstrider** — Focus: Finesse and Agility. Starting bonus spread: **+4 Finesse, +2 Agility**. Non-focus cap **30** on Might, Vitality, Intellect, and Resolve.
- **Shadehand** — Focus: Finesse and Agility. Starting bonus spread: **+2 Finesse, +4 Agility**. Non-focus cap **30** on Might, Vitality, Intellect, and Resolve.
- **Ironfist** — Focus: Might and Agility. Starting bonus spread: **+4 Might, +2 Agility**. Non-focus cap **30** on Finesse, Vitality, Intellect, and Resolve.
- **Aetherist** — Focus: Intellect and Resolve. Starting bonus spread: **+4 Intellect, +2 Resolve**. Non-focus cap **30** on Might, Finesse, Vitality, and Agility.
- **Lifebinder** — Focus: Intellect and Resolve. Starting bonus spread: **+2 Intellect, +4 Resolve**. Non-focus cap **30** on Might, Finesse, Vitality, and Agility.

These starting spreads are **defaults, not caps**. Before creating the character, the player may redistribute the full six-point starting bonus budget however they wish under the active legal rules. Later full attribute resets likewise include these starting points.

Future Foundation or advanced Disciplines must define focus metadata and an intentional starting identity where applicable instead of inheriting a generic stat template by accident.

## 5. Primary Discipline changes never destroy player points

Changing Primary Discipline must validate the character's existing personal allocation against the proposed Discipline policy.

If the new Primary makes the allocation illegal:

- the change must not silently clamp, delete, or reassign points;
- the player must be told **all** currently illegal allocations rather than discovering them one at a time;
- the affected points remain owned by the character and must be redistributed into a legal build before the change can be committed.

Secondary Discipline does not provide a second core-attribute cap profile unless a future explicit rule says otherwise.

## 6. Discipline selection readability and testing access

Before committing a Primary Discipline, the player-facing selection/preview experience must expose that Discipline's focus attributes and active off-identity ceilings so the build consequences are understandable before commitment.

The Profile Discipline Management workspace should:

- present each active Discipline with a distinct AUREVANE sigil and clear focus-stat badges;
- hide the currently proposed Primary from Secondary choices and hide the proposed Secondary from Primary choices;
- show the character's Core Stats as preserved unless the player separately redistributes them;
- show the proposed Primary's authoritative Adventure Stat changes with green increases, red decreases, and neutral/white unchanged values;
- make clear that Secondary Discipline does not apply a second base-stat profile.

During the current owner-approved game testing phase, **every player character receives auditable testing mastery access to every currently active Secondary-enabled Discipline**. Disabled, retired, placeholder, or future Disciplines remain unavailable. This testing entitlement is server/database-authored and must not be implemented as a browser-only bypass.

New player characters created during this testing phase and newly Secondary-enabled active Disciplines must receive the same auditable testing access automatically.

## 7. Global derived-stat and mobility guardrails

Current global caps/defaults:

- **Critical Chance:** maximum **30%**;
- **Evasion:** maximum **15%**;
- **Movement:** baseline **2**, maximum **5**;
- **Jump:** baseline **0**, maximum **3**;
- **Movement Action Economy cost:** **20 AP per terrain-cost point**.

Action Economy does not increase the character's Movement allowance. A character may only traverse up to the server-owned Movement budget for that turn even if sufficient AP remains.

The active committed Primary Discipline is part of the derived-stat calculation used when a battle session is created. Battle Movement, Jump/elevation reach, HP/MP and other derived combat bridge values therefore use the same committed Primary-derived snapshot represented by the Profile rather than a raw-attributes-only approximation.

Projected movement is not a commitment. While planning a move, the player may retract the provisional path tile by tile with directional controls or by selecting an earlier point on the projected path. Only the committed path consumes Movement and AP.

## 8. Level-50-aware Adventure Stat scaling

The Level-1 experience must not begin near endgame reliability or mobility. Adventure reliability/mobility therefore uses **Derived Stat Ruleset V2**, while the established hard caps remain unchanged.

Ruleset V2 intentionally spreads growth across the Level 1–50 range. Core attributes remain meaningful from Level 1, but Level contributes materially to reliability and mobility so early characters cannot front-load near-cap percentages from the small starting attribute pool.

Current V2 formulas before Primary Discipline offsets and final clamping are:

- **Accuracy (basis points):** `6200 + 20 × (Level - 1) + 60 × Finesse + 15 × Intellect`, maximum 9500.
- **Evasion (basis points):** `50 + 6 × (Level - 1) + 15 × Agility + 5 × Resolve`, maximum 1500.
- **Critical Chance (basis points):** `100 + 14 × (Level - 1) + 25 × Finesse`, maximum 3000.
- **Initiative:** `floor((10 + 1 × (Level - 1) + 2 × Agility + Resolve) / 2)`.
- **Movement:** `floor((40 + 1 × (Level - 1) + Agility) / 25)`, minimum 2, maximum 5.
- **Jump:** `floor((-20 + 1 × (Level - 1) + Might + Agility) / 30)`, minimum 0, maximum 3.
- **Status Resistance (basis points):** `30 × (Level - 1) + 70 × Resolve`, maximum 7500.

Maximum HP, Maximum MP, Physical Power, Mystic Power, Armor, and Ward retain their established formulas because they already scale through Level and core attributes without the same Level-1 percentage-cap compression problem.

Primary Discipline offsets are applied after the base calculation and the final result is re-clamped. They may accelerate a class toward its identity but do not bypass the approved global hard caps.

### 8.1 Optional Primary-derived ceilings

A Primary Discipline may define an optional derived-stat ceiling when its mechanics specifically require one. If both a global maximum and a Primary-specific maximum exist, the authoritative effective maximum is:

`min(global maximum, Primary Discipline maximum)`

If no Primary-specific ceiling is authored, the normal global rule applies unchanged.

The current six Foundation Disciplines receive **no new arbitrary numeric derived-stat ceilings** in this progression pass. Future values require explicit balance authoring.

## 9. Implementation roadmap and balance status

The approved current progression pass consists of:

1. **Authoritative global rules** — Level 50, +1 point per gained Level, global Crit/Evasion/Movement/Jump ceilings, and 20 AP movement cost.
2. **Authoritative allocation persistence** — Level-derived point budget, ordinary point spending, full-pool resets, idempotency, audit history, and five-use 30-day reset-window enforcement.
3. **Profile and creation experience** — available-point allocation, refresh-stable modal redistribution, reset count/renewal visibility, Primary focus-stat presentation, and editable Foundation starting-identity presets.
4. **Primary swap compatibility** — proposed Primary changes validate the current allocation first; illegal allocations must be redistributed and are never silently clamped.
5. **Foundation off-identity balance policy** — current Foundation focus attributes remain uncapped by Discipline identity and all four non-focus attributes use the approved **30-point ceiling**.
6. **Level-range derived scaling** — V2 reliability/mobility scaling prevents Level-1 builds from starting near Level-50 performance while preserving the approved global ceilings.
7. **Battle Movement authority** — battle creation consumes the committed Primary-derived Movement/Jump snapshot and Movement remains an independent hard limit from AP.
8. **Testing Discipline access** — every active player character can choose every currently active Discipline in either supported slot while testing, without exposing disabled/future content or bypassing server authority.
9. **Derived-cap framework** — optional Primary-specific derived ceilings are supported with lower-of-global-and-Primary precedence; current Foundation numeric ceilings remain unchanged.

Future exceptional attribute policies or new numeric Discipline-specific derived-stat ceilings remain separate balance-authoring tasks and must be explicitly reviewed rather than inferred from the Foundation rule.
