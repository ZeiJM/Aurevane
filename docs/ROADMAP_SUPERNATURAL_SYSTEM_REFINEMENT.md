# AUREVANE — Roadmap: Essence, Soulmarks, Mantles & Anomaly Characters

**Authority:** Binding roadmap integration for `docs/SUPERNATURAL_SYSTEM_REFINEMENT.md`, subordinate to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/ROADMAP.md` and `docs/ROADMAP_BUILD_SYSTEM_REWORK.md`.

**Direction approved:** 2026-08-18.

Where older roadmap text describes Confluence, provisional Essence naming, Soulmark + Mantle coexistence, Mantle-granted Skills, a universal earnable three-rank Mantle ladder, or ordinary access to multiple Soulmarks/Mantles, this roadmap governs future implementation.

---

# Current Phase 2 / PV-1 — No Supernatural Feature Expansion

Do not pull Soulmarks, Mantles, anomaly characters, or Mantle spectacle into the active combat-usability validation work.

Current compatibility only:

- combat state must support typed temporary buffs/debuffs and special states;
- the cooldown engine must later support Soulmark Skills;
- Skill source tags must remain extensible;
- temporary stat/rule modifiers must be server-owned;
- battle snapshots must be able to pin supernatural configuration;
- the Profile architecture must remain suitable for future `Supernatural` configuration;
- no current combat prototype should hardcode that a character can never have more than one supernatural slot at the database/schema level if a safe bounded representation can avoid that assumption.

PV-1 still succeeds or fails on ordinary tactical combat.

---

# Phase 3 — Build Grammar + Final Essence Naming

Phase 3 continues implementing the Primary/Secondary Discipline redesign.

Lock player-facing terminology:

```text
Primary Discipline
Secondary Discipline
Resonance
Essence
Skill
Soulmark
Mantle
```

### Essence

Implement the generic pure-path contract:

- Primary only;
- eight Discipline Skills available;
- one Essence Skill outside those eight;
- Essence unavailable with Secondary equipped;
- normal Action Economy/cooldown/effect rules;
- damage-versus-effect balance metadata.

No Soulmark/Mantle player feature ships merely because the data model is compatible.

---

# Phase 4 — Resonance vs Essence Buildcraft Proof

Use the first complete Discipline cohort to prove:

```text
PURE
8 Discipline Skills + Essence Skill

MIXED
6 Discipline Skills + Resonance passive
```

The supernatural system must not be required to make this choice interesting.

Validate:

- Essence is not a disguised Ultimate;
- Resonance remains passive;
- pure and mixed builds have genuine tradeoffs;
- Skill/tag/combo grammar is sufficiently expressive for future Soulmark mutations;
- cooldown and Action Economy systems tolerate effects that later alter them within bounded rules.

---

# Phase 5 — Supernatural Fork + First Soulmarks + First Mantle I

Phase 5 is the first player-facing supernatural implementation because the world/story layer can support a meaningful awakening and Severance rite.

## A. Supernatural state machine

Implement:

```text
UNAWAKENED
SOULMARKED
SOUL_SEVERED
```

Requirements:

- server-authoritative permanent choice;
- strong confirmation;
- ordinary respec cannot cross paths;
- Unawakened cannot exploit Mantle eligibility;
- state survives reconnect and future Rekindling;
- Character Profile `Supernatural` section.

## B. Minimum-level gate framework

Implement a reusable requirement grammar for supernatural content:

- minimum Character Level;
- minimum Horizon;
- story/world state;
- Discipline Mastery;
- prior branch/Mantle-level prerequisite;
- rite/challenge;
- source/entitlement;
- mode legality.

Initial production defaults:

```text
Awakening / Severance decision:
Level 10 + early story/combat-understanding checkpoint

Additional ordinary Soulmark:
per-definition; normally Level 15+

Second Soulmark branch:
typically Level 25+

Rare third branch:
typically Level 50+

First ordinary Mantle pursuit / Mantle I global floor:
Level 20 + Soul-Severed + Mantle-specific rite/source
```

Individual content can be stricter.

Reaching a level alone never auto-grants the content.

## C. Soulmark vertical slice

Ship a deliberately varied proof set demonstrating multiple structures:

- passive + Skill;
- two passives / no Skill;
- two Skills / no passive;
- meaningful strength + weakness;
- movement/Jump/verticality;
- teleport/spatial behavior;
- one summon-oriented example if technically affordable;
- a global Skill mutation example if technically affordable.

Prove 1- and 2-branch Soulmarks. A 3-branch example is optional during the proof.

Any Soulmark Skills remain outside 6/8 Discipline capacity and obey cooldown/AE rules.

## D. Soulmark power-budget tooling

Internal balance metadata must cover:

- passive value;
- Skill value;
- cooldown;
- AE cost;
- area/range;
- conditions/setup;
- reliability;
- drawback credit;
- stat scaling;
- PvE/PvP metrics.

The budget supports review; it does not pretend radically different mechanics can be perfectly reduced to one scalar.

## E. Severance and first Mantle

A Soul-Severed player should not wait indefinitely for the payoff of their choice.

Implement at least one ordinary Mantle acquisition route and **Mantle Level I — Tempered Manifestation**.

Prove:

- only Soul-Severed ordinary characters can earn it;
- Level 20 global floor plus content requirements;
- no Mantle-granted Skills;
- invoking the Mantle amplifies existing stats/Skills/rules only;
- short duration;
- lighter Afterstrain;
- readable state/timer;
- one invocation/battle initial assumption;
- Soulmarked ordinary character rejected by server.

### Phase-5 gate

Players should be able to explain:

- Resonance = mixed-Discipline passive;
- Essence = pure-Discipline extra Skill;
- Soulmark = persistent supernatural identity;
- Severance = permanent rejection of Soulmarks;
- Mantle = temporary Soul-Severed transformation that enhances the existing build and creates Afterstrain.

---

# Phase 6 — Co-op and Public Build Readability

Add party-safe/public presentation for:

- Soulmark identity where public;
- Soul-Severed identity;
- equipped Mantle identity;
- current Mantle invocation/Afterstrain state in battle where allies need to understand it;
- Soulmark summons/teleports/zones without obscuring teammate decisions;
- cross-player typed combo interactions where authored.

No party state bypasses supernatural level gates or permanence.

---

# Phase 7 — Mantle II + Deeper Soulmark Mechanics

Phase 7 is the first recommended implementation point for **Mantle Level II — Full Manifestation** because Expeditions provide longer, harder encounters where timing/Afterstrain can be validated.

## A. Full Manifestation

Initial global floor:

```text
Level 60
+ Mantle Level I
+ advanced Horizon/content qualification
+ Mantle-specific advanced rite/challenge
```

Individual Mantles may require more.

Requirements:

- significantly stronger temporary amplification than Level I;
- serious Afterstrain;
- no new Mantle Skills;
- player with II may still choose I at invocation;
- clear invocation selector:

```text
Tempered Manifestation I
Full Manifestation II
```

- server snapshots selected level;
- reconnect cannot reset active state or Afterstrain;
- AI understands relative danger windows.

## B. Deeper Soulmark mechanics

Expand into mechanics such as:

- bounded summons;
- teleport/portal identities;
- AoE conversion;
- elemental conversion/infusion;
- poison/DoT setup-payoff;
- healing/defensive mutations;
- terrain/zone alteration;
- combo-sequence Soulmarks;
- risk/reward weaknesses.

Do not expand catalog count faster than combat readability and balance tooling can support.

---

# Phase 8 — PvP Safety

Before mature supernatural systems enter ranked PvP:

- Soulmark branch/state pinned before battle;
- Mantle identity and attained invocation cap pinned;
- invocation level choice is authoritative;
- Level I/II effects and Afterstrain are mode-versioned;
- reconnect cannot restore Mantle or erase Afterstrain;
- queue rules can disable/normalize a specific Soulmark, branch, Mantle, or invocation level;
- public opponent-info policy defines what supernatural identity is visible;
- Soulmark summons/zones/teleports obey spectator-safe projection rules;
- ordinary ranked rejects Owner-only anomaly overrides by default.

Arena Tempering may tune coefficients but should preserve recognizable build identity.

---

# Phase 9 — Mature Catalog Scale + Six Mantles

## A. Soulmark catalog

Grow only when quality warrants it:

```text
proof set           small/diverse
broad catalog       ~24–36
mature catalog      ~48–72
long-term           100+ supported
```

Each additional Soulmark should justify itself by battlefield identity, branch design, acquisition, build interaction, or play pattern.

## B. Branch scale

Support:

- 1 branch focused marks;
- 2 branches for most;
- 3 branches for rare/complex marks.

## C. Six ordinary Mantles complete

By the mature high-level build stage, target **six distinct ordinary Mantles** with different amplification and Afterstrain profiles.

Each supports, once attained:

```text
I — Tempered Manifestation
II — Full Manifestation
```

Higher attainment expands invocation choice rather than replacing the lower state.

No ordinary Mantle grants new Skills.

---

# Phase 10 — Mature Character Profile / Social Presentation

Polish the Profile build headquarters:

```text
Supernatural
├ Soulmarked
│  ├ current Soulmark
│  ├ branch
│  ├ passives
│  ├ Soulmark Skills
│  └ acquisition/history
│
└ Soul-Severed
   ├ Severance history
   ├ Mantle collection
   ├ equipped Mantle
   ├ attained invocation levels
   └ Afterstrain explanation
```

Add public/shareable build treatment where privacy and competitive rules allow.

Anomaly status remains an Owner-operational concept rather than a normal progression menu.

---

# Phase 11 — Economy Safety

If equipment/crafting/enchantments interact with Soulmark/Mantle tags:

- no item can bypass Soulmarked/Soul-Severed exclusivity;
- no Trade House item can grant a Soulmark/Mantle entitlement directly unless an explicit legitimate content contract exists;
- no enchantment removes Mantle Afterstrain;
- no crafted effect creates infinite Soulmark cooldown/resource loops;
- Soulmark/Mantle power is not laundered through tradeable cash-value entitlements.

---

# Phase 12 — Nations / Homestead / World Identity

Allow cosmetic/lore/social reflection of supernatural identity:

- Soulmark-themed trophies;
- Severance/Mantle accomplishments;
- Mantle rite trophies;
- Homestead display;
- nation/world NPC reactions where authored.

No housing system bypasses supernatural gates.

---

# Phase 13 — GAME OWNER Anomaly Studio + Mantle Level III

This is the main implementation phase for the exceptional cheatcode/Owner override system.

Do not expose these controls through normal staff roles or ordinary player Profile UI.

## A. Owner-only Anomaly Character override

Protected `/master` surface, stable GAME OWNER principal only.

Supported presets:

```text
DUAL_SOULMARK
DUAL_MANTLE
SOULMARK_AND_MANTLE
```

Rules:

- not earnable;
- not purchasable;
- not tradeable;
- not granted by events/referrals/Rekindling;
- not delegable to Moderator/Content Staff/Event Staff;
- not obtainable through a generic capability grant;
- mandatory reason + audit;
- exact account/character resolution;
- resulting build preview;
- safe revocation.

### DUAL_SOULMARK

Both Soulmark branch packages may function simultaneously.

### DUAL_MANTLE

Character can equip/access two Mantles and choose which to invoke; ordinary anomaly baseline allows only **one active Mantle at a time**.

### SOULMARK_AND_MANTLE

Character may keep an active Soulmark and also access a Mantle despite the normal fork.

## B. Mantle Level III — Transcendent Manifestation

The code/content model supports a third invocation level:

```text
I   Tempered Manifestation
II  Full Manifestation
III Transcendent Manifestation
```

Level III has **no normal acquisition path**.

Only GAME OWNER can grant a selected character Level-III eligibility for a selected Mantle.

A character granted III can still choose I, II, or III during invocation.

Transcendent principles:

- extreme temporary amplification of the same Mantle identity;
- no new Skills;
- severe Afterstrain;
- potentially stricter duration/readiness;
- excluded from ordinary reward/source tables;
- standard ranked/tournaments reject it by default.

## C. Owner level-gate bypass

The Owner Anomaly Studio may deliberately bypass normal minimum Level/Horizon requirements for an anomaly grant.

Requirements:

- explicit `bypass progression gates` control;
- never default-on;
- mandatory warning/confirmation;
- mandatory reason;
- immutable audit entry;
- ordinary legitimate Level I/II attainment preserved when anomaly override is later removed.

## D. Competitive isolation

Standard Ranked and ordinary official tournaments reject active anomaly supernatural overrides by default.

Custom/exhibition/event rulesets may opt in explicitly.

Matches using anomalies are separated/labeled for analytics so ordinary balance data is not polluted.

---

# Phase 14 — Art / Audio / Transformation Polish

Produce premium visual language for:

- Soulmark icon families and branch identity;
- Soulmark Skill/VFX signatures;
- summons/teleports/zones;
- The Severance;
- each of six Mantles;
- Tempered vs Full manifestation intensity;
- Owner-only Transcendent manifestation;
- Afterstrain readability;
- reduced-motion/accessibility treatment.

Level III should look exceptional without becoming unreadable or visually concealing tactical information.

---

# Phase 15 — Hardening

Explicitly attack:

### Soulmarks

- duplicate bind;
- replacement races;
- branch spoofing;
- extra-Skill duplication;
- summon duplication/reconnect;
- teleport legality;
- AoE conversion edge cases;
- DoT recursive loops;
- fake-drawback balance exploits;
- PvP/version mismatch.

### Mantles

- invocation-level spoofing;
- II without I/prerequisites;
- ordinary acquisition of III;
- multiple invocation race;
- reconnect duration reset;
- Afterstrain cleanse/reset bypass;
- stat overflow;
- cooldown/AE loops;
- one-invocation-per-battle bypass where applicable.

### Anomaly Characters

- non-Owner grant attempts;
- delegated-capability bypass;
- staff-role bypass;
- forged browser flags;
- stale Owner session;
- dual-slot duplication;
- illegal dual-Mantle simultaneous activation;
- ranked/tournament queue bypass;
- revoke/reconnect races;
- ordinary progression accidentally granting III;
- Owner level-bypass audit correctness;
- audit tampering/reason omission.

---

# Locked Roadmap Decisions

1. **Soulmark** is canonical terminology.
2. **Essence** is final pure-Discipline branding.
3. Soulmarks can be extremely varied: passives, Skills, summons, teleports, AoE/elemental/DoT mutations, weaknesses, combos, movement, terrain, etc.
4. Ordinary characters have one Soulmark or are Soul-Severed; the paths are mutually exclusive.
5. Six ordinary Mantles are the mature target.
6. Mantles grant **no new Skills**; they amplify/modify the existing build temporarily.
7. Mantle progression preserves player choice: higher levels add invocation choices rather than replacing lower ones.
8. Normal players may attain Mantle I and II.
9. **Mantle III — Transcendent Manifestation is coded but GAME OWNER-only and never normally earnable.**
10. Supernatural content uses minimum-level floors plus Horizon/story/mastery/rite requirements.
11. Initial global starting floors are Level 10 Awakening/Severance, Level 20 Mantle I, Level 60 Mantle II; individual content may be stricter and all values remain versioned/configurable.
12. GAME OWNER-only Anomaly Characters may have two Soulmarks, two Mantles, or Soulmark + Mantle.
13. Dual-Mantle anomaly characters choose between equipped Mantles; simultaneous double-Mantle activation is not approved by default.
14. Anomaly and Level-III grants are not delegable and standard ranked/tournaments reject them by default.
15. Normal build/supernatural setup remains centered on the Character Profile; anomaly controls exist only in protected `/master` operations.
