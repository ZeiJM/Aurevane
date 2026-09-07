# Foundation Trio Skill Catalog — Aetherist, Farstrider, Shadehand

**Status:** Owner-approved implementation direction  
**Date:** 2026-09-07

This catalog fleshes out the three Foundation Disciplines that previously had no authored combat Technique catalog. It follows the current four-selected-Technique loadout, active-source-only picker, pure Essence, mixed Resonance, AP economy, and 50% consecutive-use falloff rules.

## Shared rules

- Each authored Discipline has **8 regular Techniques**. A character may still equip only the current authoritative four-Technique loadout.
- Pure builds receive their Discipline's **Essence Skill** outside those four slots.
- Every mixed pair among the currently authored Aetherist, Farstrider, Lifebinder, Shadehand, and Vanguard catalogs resolves to a **Resonance** outside the four slots.
- Normal authored Skill cooldown metadata remains transitional/inert in PV-1F. Consecutive use of the same Skill is governed by the canonical 50% repeat-use rule.
- **Exposed** is an authoritative combat status: one stack, two owner-turn starts, and 115% incoming damage.
- Immediate repeated use of a one-stack Exposed setup Skill still follows the discrete-effect repeat rule, so the repeated status application is omitted at 50% effectiveness.

## Aetherist — Spell Offense / Arcane Pressure

Aetherist wins by creating pressure at range, shaping small areas, and opening defenses for follow-up attacks. The current combat engine does not yet have damage schools or a literal Ward-bypass primitive, so **Ward Pierce** expresses that fantasy by applying Exposed instead of pretending to bypass a mechanic that does not yet exist.

| Technique | AP | Tactical role |
| --- | ---: | --- |
| Arc Bolt | 35 | Reliable ranged single-target damage |
| Mana Burst | 50 | Small-area ranged burst |
| Ward Pierce | 45 | Damage + Exposed setup |
| Arcane Field | 55 | Area damage + area Exposed setup |
| Channel | 25 | Self MP recovery |
| Mana Shield | 35 | Self Guarded defense |
| Chain Spark | 50 | Line-area damage |
| Overchannel | 65 | High-commitment ranged finisher |

**Pure Essence — Aether Nova:** 60 AP wide-area destructive nova (65 AP in PvP).

## Farstrider — Range / Awareness / Keen Sight

Farstrider's identity is encoded directly into targeting: longer ranges and greater elevation tolerance than ordinary ranged skills, plus mark/setup play.

| Technique | AP | Tactical role |
| --- | ---: | --- |
| Aimed Shot | 40 | Precise 2–5 range strike |
| Pinning Shot | 40 | Damage + Exposed setup |
| Volley | 55 | Ranged area pressure |
| Scout's Mark | 30 | Long-range Exposed mark |
| Longshot | 55 | 3–6 range high-damage shot |
| Piercing Barrage | 55 | Long line-area attack |
| Fieldcraft | 30 | Self HP + MP recovery |
| Keen Focus | 35 | Defensive awareness / Guarded |

**Pure Essence — Deadeye Barrage:** 60 AP long-range line finisher (65 AP in PvP).

The early-plan **Quickstep** concept is intentionally not faked: the current Skill effect schema has no authoritative movement effect. It can return when a real forced/self-movement primitive exists.

## Shadehand — Mobility / Utility / Opportunist

Shadehand turns positioning and openings into damage. Rear and side attacks receive explicit authored facing multipliers, while Feint and Crippling Cut can create Exposed for Exploit Opening.

| Technique | AP | Tactical role |
| --- | ---: | --- |
| Backstab | 40 | Facing-sensitive melee burst |
| Feint | 35 | Light damage + Exposed setup |
| Smoke Vial | 35 | Self Guarded defense |
| Crippling Cut | 45 | Damage + Exposed setup |
| Exploit Opening | 45 | Requires Exposed; high payoff |
| Fan of Knives | 50 | Adjacent area damage |
| Quick Hands | 25 | Self MP recovery |
| Execution Cut | 60 | Heavy facing-sensitive finisher |

**Pure Essence — Perfect Opening:** 60 AP melee finisher with 120% front / 160% side / 220% rear facing scaling (65 AP in PvP).

The early-plan **Disengage** concept is likewise deferred until the combat engine has an authoritative movement-effect primitive; it is not represented by a misleading fake movement buff.

## Mixed Resonance coverage

The existing Lifebinder + Vanguard **Mercy's Edge** remains unchanged. Nine additional Resonances complete the pair matrix for the five currently authored class catalogs:

- Aetherist + Farstrider — **Arcane Hunt**
- Aetherist + Lifebinder — **Vital Circuit**
- Aetherist + Shadehand — **Veiled Conduit**
- Aetherist + Vanguard — **Spellsteel Rhythm**
- Farstrider + Lifebinder — **Guided Renewal**
- Farstrider + Shadehand — **Marked Opening**
- Farstrider + Vanguard — **Covering Break**
- Lifebinder + Shadehand — **Mercy in Shadow**
- Shadehand + Vanguard — **Broken Line**

These use the existing server-authoritative two-Skill sequence framework and bounded bonus damage. They do not consume Technique slots.

## Provisioning

The active-Discipline provisioning authority is expanded so Aetherist, Farstrider, and Shadehand characters receive their eight authored Techniques exactly like Vanguard and Lifebinder. Existing eligible characters are backfilled by migration; future active-Discipline changes provision automatically.

## Media presentation

The expanded Techniques, Essences, and Resonances receive deterministic class-colored interim artwork so every card has a distinct visual identity while the dedicated production-art pass is still pending. Lifebinder's newly added **Vital Sever**, **Searing Bloom**, and **Verdant Rupture** likewise use distinct artwork instead of reusing existing Lifebinder card images.

## Content boundary

Ironfist is not part of this expansion. Its catalog should be authored as its own focused class-content ticket rather than filled with placeholders. Dedicated production illustration and audio can replace the interim generated presentation later without changing the authoritative Skill IDs or mechanics.
