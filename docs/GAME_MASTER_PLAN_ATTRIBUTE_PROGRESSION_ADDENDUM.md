# AUREVANE — Attribute Progression and Stat Guardrails Addendum

**Status:** Owner-approved authoritative addendum to `docs/GAME_MASTER_PLAN.md`.

**Direction approved:** 2026-09-06. **Foundation non-focus cap policy approved:** 2026-09-08.

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

## 4. Discipline caps are identity guardrails, not templates

Primary Discipline may define:

- focus attributes;
- ceilings on off-identity attributes;
- optional bounded secondary-stat constraints where specifically authored.

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
- the player must be told which allocations are illegal;
- the affected points remain owned by the character and must be redistributed into a legal build before the change can be committed.

Secondary Discipline does not provide a second core-attribute cap profile unless a future explicit rule says otherwise.

## 6. Discipline selection readability

Before committing a Primary Discipline, the player-facing selection/preview experience should expose that Discipline's focus attributes and any active off-identity ceilings so the build consequences are understandable before commitment.

The Profile attribute allocator must also surface the active Primary's off-identity ceilings and prevent the local draft controls from intentionally stepping beyond them. This client behavior is explanatory and preventative only; the server remains authoritative and must independently validate every committed allocation.

The policy model must remain reusable for future Disciplines rather than hard-coding one-off validation into individual UI screens.

## 7. Global and Discipline-specific derived-stat guardrails

Current global caps/defaults:

- **Critical Chance:** maximum **30%**;
- **Evasion:** maximum **15%**;
- **Movement:** baseline **2**, maximum **5**;
- **Jump:** baseline **0**, maximum **3**;
- **Movement Action Economy cost:** **20 AP per terrain-cost point**.

Action Economy does not increase the character's Movement allowance. A character may only traverse up to the server-owned Movement budget for that turn even if sufficient AP remains.

Discipline base profiles, equipment, attributes, and temporary effects may help a build reach a global ceiling, but they do not bypass these global caps unless a future explicitly authored rule supersedes this addendum.

A Primary Discipline may also define an optional derived-stat ceiling where its specific mechanics require one. When both a global maximum and a Primary Discipline-specific maximum exist for the same derived stat, the authoritative effective maximum is **the lower of the two values**. If no Discipline-specific ceiling is authored, the normal global rule applies unchanged.

The current six Foundation Disciplines do **not** receive additional numeric derived-stat ceilings beyond the currently authored global rules. New Discipline-specific values must be deliberately balance-authored rather than inferred.

## 8. Implementation roadmap and balance status

The implementation sequence for this system is:

1. **Authoritative global rules** — Level 50, +1 point per gained Level, global Crit/Evasion/Movement/Jump ceilings, and 20 AP movement cost.
2. **Authoritative allocation persistence** — Level-derived point budget, ordinary point spending, full-pool resets, idempotency, audit history, and five-use 30-day reset-window enforcement.
3. **Profile and creation experience** — available-point allocation, full Reset Attributes workflow, reset count/renewal visibility, Primary focus-stat presentation, and editable Foundation starting-identity presets.
4. **Primary swap compatibility** — proposed Primary changes validate the current allocation first; illegal allocations must be redistributed and are never silently clamped.
5. **Foundation off-identity balance policy** — current Foundation focus attributes remain uncapped by Discipline identity and all four non-focus attributes use the approved **30-point ceiling**.
6. **Derived-stat cap precedence framework** — optional Primary Discipline-specific derived-stat ceilings are supported, and the effective maximum is `min(global maximum, Primary Discipline maximum)` where both exist. Current Foundation Disciplines add no new numeric values.

Items 1–6 are the approved target for the current progression pass. Future exceptional attribute policies or new numeric Discipline-specific derived-stat ceilings remain separate balance-authoring tasks and must be explicitly reviewed rather than inferred from the Foundation rule.
