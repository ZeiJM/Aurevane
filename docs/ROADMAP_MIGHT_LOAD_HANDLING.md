# AUREVANE — Might & Load Handling Roadmap Clarification

**Status:** Binding clarification to `docs/ROADMAP_EQUIPMENT_LOAD_AND_BUILD_PHYSICS.md` and `docs/STAT_DRIVEN_BUILDCRAFT.md`.

**Authority:** `docs/GAME_MASTER_PLAN.md` remains primary. `docs/EQUIPMENT_LOAD_AND_BUILD_PHYSICS.md` defines Equipment Weight, Equipped Load, Load Handling/Tolerance, and the rule that Might is the intuitive primary attribute candidate for ordinary physical Load Handling without becoming mandatory for every heavy build.

**Direction approved:** 2026-08-16.

The roadmap rule is:

> **Might should provide a natural, understandable route to handling physically heavy equipment, while specialized content must preserve alternate heavy-build paths so Might never becomes a compulsory tax for every armored or high-Load archetype.**

---

## 1. Core Relationship

When the Load system becomes active, **Might may contribute to baseline physical Load Handling/Tolerance**.

This should feel intuitive:

- stronger characters can carry and control heavier combat equipment more effectively;
- sufficient Might may help a build remain below a worse Load breakpoint;
- sufficient Might may preserve some Movement/Jump capability while wearing heavier gear;
- selected heavy weapons/shields/equipment may use Might-linked handling requirements or bonuses where that meaningfully supports their physical identity.

The exact formula is balance data and must not be treated as fixed until combat testing proves it.

Might is **not** a new carry-capacity inventory stat and does not make backpack loot encumbrance a normal system.

---

## 2. Alternate Heavy-Build Paths Are Required

AUREVANE must support coherent non-Might solutions to heavy equipment when the content justifies them.

Possible routes include:

- Discipline Traits that improve Load Handling;
- Movement Arts that compensate for heavy mobility;
- equipment that redistributes/reduces effective Load;
- Confluence interactions;
- Soulmark effects;
- Mantle Path specialization;
- temporary combat effects;
- authored movement profiles or equipment-specific handling rules.

These alternatives must have real opportunity costs.

The goal is not to let every build ignore Weight for free; the goal is to prevent one attribute from becoming mandatory merely because a player likes armor or heavy weapons.

---

## 3. Phase 2 — Prototype Relationship, Not Final Formula

If Phase 2 contains enough representative equipment to test Load meaningfully, include at least one comparison where Might changes the handling of the same or similar Load.

Questions to test:

- does the relationship feel intuitive to players?;
- does it create a meaningful Movement/Jump breakpoint rather than invisible arithmetic?;
- does higher Might help without erasing the tradeoff of heavy equipment?;
- can a lower-Might build still exist coherently through lighter gear or another authored solution?;
- does the battle forecast explain why movement/vertical legality differs?

If the vertical slice is too narrow, defer the complete proof to Phase 3 rather than inventing a fake permanent formula.

---

## 4. Phase 3 — Armory / Buildcraft Proof

When the real Armory and loadout system arrives:

- show how Might contributes to Load Handling where applicable;
- show current Equipped Load and effective Load State;
- preview before/after Movement and Jump breakpoints when changing gear or attributes/build components;
- identify which source is providing Load Handling (`Might`, Trait, equipment, Movement Art, etc.) where useful;
- support at least one heavy non-Might solution with a meaningful cost;
- avoid hidden handling thresholds;
- ensure saved loadouts recompute Load Handling authoritatively.

A player should be able to understand both:

> “My Might lets me wear this without becoming Heavy.”

and:

> “This other build has less Might, but spends a Trait and equipment slot to solve the same problem differently.”

---

## 5. Phase 4 — Representative Archetype Validation

The first deliberate buildcraft suite should include at least:

- a naturally strong/heavy build where Might contributes meaningfully to Load Handling;
- a light/mobile build that avoids the problem instead of solving it;
- a hybrid or specialist heavy build that compensates for lower Might through authored build choices.

This validates that Might is useful but not compulsory.

Content review should reject two failure modes:

1. **Might is irrelevant** — heavy equipment ignores physical capability and the stat loses an intuitive expression path.
2. **Might is mandatory** — every viable heavy/armored build must maximize Might regardless of Discipline or concept.

---

## 6. PvP / Balance Gate

Before ranked PvP trusts mature Load rules, specifically inspect:

- win/use rate by Might bands within Heavy builds;
- whether high-Might heavy builds retain too much mobility for their protection;
- whether lower-Might heavy builds are nonviable;
- whether alternative Load-Handling sources cost enough;
- whether a single Might breakpoint dominates equipment choices;
- whether Heavy + high Might creates unstoppable objective holders, charge builds, or high-ground access;
- whether players can understand the tradeoff from public information and combat forecasts.

If Might becomes a hidden tax, rebalance Load Handling sources rather than adding another attribute.

---

## 7. Phase 13 — Balance Lab Visibility

The Master Panel / Balance Lab should eventually expose enough data to evaluate the relationship, including:

- Might distribution by Load State;
- Load Handling contribution by source;
- common Might breakpoint values;
- equipment use/rejection rates around those breakpoints;
- Movement/Jump outcomes by Load State and Might band;
- PvE/PvP performance of heavy builds using natural Might handling versus alternate solutions.

Authorized staff should be able to tune versioned Load-Handling coefficients and related equipment/content values without direct production SQL, with dependency preview, Manual/News impact, rollback, and audit.

---

## 8. Public Explanation

Once released, the Manual should explain the relationship plainly:

> **Might helps a character physically handle heavier combat equipment, but specialized builds can sometimes compensate through other tools.**

Do not advertise exact hidden anti-exploit thresholds or imply that Might is required for all armor.

---

## 9. Success Condition

The relationship succeeds when Might creates an intuitive physical advantage that inspires builds such as a powerful armored climber, lancer, shield-user, or heavy-weapon specialist, while the wider AUREVANE build system still supports clever alternative solutions.

In short:

> **Might should make heavy gear easier to live with — not make heavy gear belong exclusively to Might characters.**
