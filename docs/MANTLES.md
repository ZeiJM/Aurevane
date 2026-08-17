# AUREVANE — Mantles: Earned Transformation & Specialization States

**Status:** Authoritative feature specification subordinate only to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/COMBAT.md`, `docs/PROGRESSION_RETENTION.md`, `docs/PLAYER_MANUAL.md`, `docs/MASTER_PANEL.md`, `docs/MEDIA_PIPELINE.md`, and `docs/ROADMAP_MANTLES.md`.

**Direction approved:** 2026-08-16.

AUREVANE includes a later-game system of manually activated, temporary combat transformations called **Mantles**.

The defining rule is:

> **Rank I is broadly accessible to every legitimate player. Rank II and Rank III are powers of specialization: the character may earn them permanently, but only builds that accept the required Mantle Path commitments can actually manifest them.**

Mantles are not inherited bloodlines, not passive racial powers, not a second Soulmark system, and not a generic rage meter. They are cultivated higher states that the character deliberately manifests in battle.

The system should create two simultaneous fantasies:

> **“Anyone can learn to open this door.”**

and, at the highest ranks:

> **“This character gave up breadth to become extraordinary at this one thing.”**

---

## 1. Player-Facing Identity

Working terminology:

- **Mantle** — the transformation identity;
- **Manifest Mantle** — activate it in combat;
- **Mantle Ready** — activation requirements are currently satisfied;
- **Mantled** — actor is currently transformed;
- **Afterstrain** — recovery state after manifestation ends;
- **Mantle Rank I / II / III** — mechanical ranks;
- **Mantle Path** — specialization route that permits higher-rank manifestation;
- **Dedication** — explicit build restriction/opportunity cost required by a Mantle Path.

Narrative production may later give individual ranks/path stages more evocative titles, but the mechanical wording must remain understandable.

Do not reuse another game's transformation-system name, lore, effects, acquisition structure, or presentation.

---

## 2. Relationship to Existing AUREVANE Systems

### Disciplines

Disciplines are learned combat traditions. They own Arts, Traits, Reactions, Movement Arts, Mastery, and Ultimates.

Mantles do not replace Disciplines and do not become a second class system.

### Current + Legacy / Confluence

Confluence is the unique interaction produced by Current + Legacy Discipline.

Mantle Paths may care about shared combat/build tags, but AUREVANE must not author bespoke Mantle × every Discipline × every Confluence combinations. That would create another impossible content matrix.

### Soulmarks

Soulmarks represent unusual supernatural potential unique to the person and provide their own passive, Signature Art, branches, and visual identity.

Mantles are different: **an earned temporary state entered deliberately during battle**.

A character may possess a Soulmark and a Mantle simultaneously.

### Ultimates

An Ultimate is a Discipline-owned apex Art.

A Mantle changes the actor's rules/state across several turns or rounds and creates timing, duration, and recovery decisions.

### Veteran Edge

Veteran Edge is bounded Rekindling prestige.

Mantle specialization is part of the normal build ecosystem and must not become uncapped veteran stat stacking.

---

## 3. The Core Model — Earned Rank vs Manifest Rank

Mantles deliberately separate **persistent achievement** from **active-build specialization**.

Every character has two relevant concepts:

### Earned Rank

The deepest rank the character has legitimately unlocked through progression and Mantle rites.

This is durable character history.

### Manifest Rank

The deepest rank the **currently equipped build** satisfies.

Conceptually:

```text
manifest_rank = min(earned_rank, rank_allowed_by_active_mantle_path_build)
```

Example:

```text
Character has permanently earned Mantle Rank III.

GENERALIST LOADOUT
- broad Current + Legacy pairing
- flexible Traits
- broad equipment coverage
- no deep Mantle Dedication
=> manifests Rank I

ATTUNED LOADOUT
- meets Rank II Path pattern
- accepts Rank II Dedication
=> manifests Rank II

DEEPLY SPECIALIZED LOADOUT
- meets Rank III Path pattern
- accepts Rank III Hard Dedication
=> manifests Rank III
```

This is intentional.

A player who has earned Rank III is **not permanently forced to play a Rank III specialist build**. They can return to a flexible build and simply manifest the Mantle at a lower effective rank.

This preserves AUREVANE's no-permanent-build-trap principle while allowing true specialization.

---

## 4. Rank I — Universal Access Layer

Rank I is the common foundation.

### Access rule

All legitimate account/payment tiers use the same gameplay eligibility rules.

A non-paying player, supporter, or any future cosmetic/premium account type must have the same ability to earn Rank I through play.

Rank I is never sold, rolled from paid loot, or restricted to premium accounts.

### Character rule

Every serious long-lived character should eventually be able to earn at least one Rank I Mantle through normal gameplay.

Rank I is **broadly accessible, not automatic at creation**.

The character should first understand normal combat and core build systems so manifestation feels meaningful rather than like tutorial clutter.

Representative requirements may include:

- appropriate Level/Horizon progress;
- a meaningful Discipline milestone;
- completion of a Mantle Rite / personal trial;
- a world/story milestone;
- sufficient understanding of normal tactical combat.

### Build rule

Rank I requires the Mantle to be equipped but should not demand severe specialization.

A normal viable build can use it.

This gives every player the transformation fantasy without making every character identical at advanced ranks.

---

## 5. Mantle Paths

Rank II and Rank III are accessed through **Mantle Paths**.

A Mantle Path is not merely an XP bar. It is a declared style of specialization with three parts:

1. **Progression Qualification** — the character has earned the right to attempt/deepen the path;
2. **Build Pattern** — the active build expresses the path's intended identity;
3. **Dedication Cost** — the build gives up meaningful flexibility to access greater manifestation.

Mantle Paths are data-driven and explicit.

The Armory should be able to explain:

> You currently qualify for Rank I.
>
> Rank II requires: [requirements].
>
> Rank III requires: [requirements + sacrifices].

No hidden build score should mysteriously decide this.

---

## 6. Rank II — Specialized Build Access

Rank II is for players who deliberately shape a build around the Mantle.

A character may permanently earn Rank II progression, but **the active build manifests Rank II only while its Mantle Path requirements remain satisfied**.

### Rank II Path Pattern

A Rank II path can require combinations of clearly tagged build elements such as:

- Current Discipline identity/tags;
- Legacy Discipline identity/tags;
- specific kinds of Traits;
- a compatible Movement Art style;
- Soulmark branch/tag where thematically justified;
- weapon/equipment categories;
- combat-role behaviors such as Guard/Intercept, mobility, terrain, summons, control, healing, or status setup;
- other stable typed build metadata.

Do not require one exact Current + Legacy pair unless the individual Mantle is deliberately designed as an exceptional narrow case.

The goal is a **family of qualifying builds**, not one solved combination.

### Rank II Dedication

Rank II must impose at least one meaningful opportunity cost compared with a generalist build.

Valid cost patterns include, where appropriate to the Mantle:

- restrict one flexible equipment category;
- require a specific weapon/armor family;
- require one of the two Traits to satisfy a Mantle-aligned property;
- require a narrower Movement Art family;
- reduce combat-consumable flexibility;
- prohibit an incompatible Soulmark branch/path;
- require Current or Legacy to come from a defined Discipline family/tag set;
- replace one flexible build choice with a Mantle Path component when that subsystem is intentionally authored.

The exact cost is per Path and must be player-readable.

Rank II should feel stronger/more distinctive because the player **built around it**, not because a hidden account flag adds free power.

---

## 7. Rank III — Deep Dedication / Rare Specialist Access

Rank III is the extreme specialization layer.

It should be genuinely uncommon in active builds even after the game is mature.

### Persistent eligibility

A character normally needs:

- Rank II already earned;
- high-Horizon / late-cycle progression;
- multiple relevant Mastery accomplishments;
- advanced PvE/world/build achievements;
- a bespoke Mantle Path rite/challenge that tests the intended playstyle;
- path-specific narrative/discovery qualification;
- explicit server-authoritative completion.

Some Rank III paths may require First Horizon or Rekindling; others may not. This is content-specific rather than a universal rule.

### Active-build requirement

Even after the character has earned Rank III, the build must satisfy a **Deep Dedication** configuration to manifest it.

Rank III requires:

- the complete Rank II pattern;
- stricter synergy/identity requirements;
- **at least one Hard Dedication** that visibly removes flexibility or breadth from the build.

### Hard Dedication

A Hard Dedication is a real build-level sacrifice.

Examples that the content grammar may support:

- one normal flexible Trait slot is replaced/locked by a Mantle Doctrine component;
- one Legacy Art slot is surrendered or converted into a Mantle Path technique slot;
- combat-item capacity is reduced;
- a broader equipment category becomes unavailable;
- the Movement Art is restricted to the Mantle Path's movement family;
- the build must use both Current and Legacy from compatible path families, sacrificing many Confluence possibilities;
- the build must commit to a particular Soulmark branch, losing access to other branch benefits while this specialist configuration is active;
- a path-specific resource/cost constraint limits another area of combat versatility.

**Do not implement every example universally.** Each Mantle Path chooses costs that fit its identity and balance.

But Rank III must always answer:

> **What did this build give up to become this specialized?**

If the answer is “nothing,” the Rank III design is invalid.

---

## 8. Rank III Is Not Strictly Better Than a Generalist

The intended relationship is:

```text
GENERALIST
more build breadth / answers / adaptability
Mantle Rank I

SPECIALIST
less breadth, stronger Mantle identity
Mantle Rank II

DEEP SPECIALIST
significant restrictions, exceptional Mantle expression
Mantle Rank III
```

A Rank III build should dominate **its intended specialty window**, not every battlefield question.

Examples:

- a Rank III protection Mantle may be extraordinary at holding territory but give up mobility/offensive flexibility;
- a Rank III pursuit Mantle may have terrifying chase potential but sacrifice defensive/utility options;
- a Rank III ritual/control Mantle may reshape zones exceptionally but require slower setup and narrower equipment/Art choices.

This produces counters, scouting value, team composition decisions, and recognizable player identities.

---

## 9. Mantle Path Diversity

A Mantle may eventually support more than one advanced Path if doing so creates meaningful choices.

For example, one Mantle could hypothetically have:

```text
RANK I — common core

PATH A
Rank II → Rank III
focuses defensive embodiment

PATH B
Rank II → Rank III
focuses mobility/control embodiment
```

However, **multiple Paths are optional, not mandatory**.

Do not multiply every Mantle into three branches before the base system proves fun.

Initial production should use the minimum number of Paths needed to validate specialization.

---

## 10. Acquisition Rarity vs Build Rarity

Mantles have two independent rarity dimensions.

### Acquisition rarity

How difficult it is to earn the deeper rank/path permanently.

Created through:

- difficult qualification;
- Mantle Rites;
- advanced Expeditions;
- recurring rare discoveries;
- world/faction/mentor paths;
- Archive reconstruction;
- high-Horizon content;
- exceptional mastery challenges.

### Manifestation rarity

How restrictive the active build is.

Even if many veteran players eventually **own** Rank III progression, relatively few active builds should satisfy Deep Dedication at a given time.

That is a powerful safety valve: prestigious specialist states can remain uncommon in actual combat without permanently denying progression to later players.

---

## 11. Rarity Guardrails

Do not create higher-rank rarity through:

- premium account type;
- paid rolls;
- paid unlocks;
- paid progression bypass;
- one-time permanent-exclusive combat power;
- tiny unbounded random drops with no protection;
- staff favoritism;
- first-come-only permanent power;
- hidden hour-scale login windows.

First achievers may receive Chronicle recognition, titles, cosmetics, or history prestige.

Later legitimate players must still have a fair route to the combat capability.

---

## 12. Combat Activation

Mantles are manually activated.

A Mantle definition contains data for:

- readiness requirements;
- activation Action Cost Class;
- entry effect;
- duration;
- sustained effects;
- rank/path modifications;
- Afterstrain;
- reactivation rules;
- PvE/PvP overrides;
- VFX/audio;
- AI/counterplay metadata.

Representative flow:

```text
BUILD DETERMINES MANIFEST RANK
        ↓
BATTLE BUILDS READINESS
        ↓
MANIFEST MANTLE
        ↓
ENTRY EFFECT
        ↓
TEMPORARY MANTLED STATE
        ↓
EXPIRATION
        ↓
AFTERSTRAIN
```

### Activation should not be a dead turn

If manifestation consumes the actor's normal Action, it should normally include an appropriate entry effect such as reposition, barrier, zone, stance change, resource conversion, bounded cleanse, mark, or initiative interaction.

Do not make every entry effect a damage explosion.

---

## 13. Readiness Should Reflect Playstyle

Do not use one universal “deal damage to fill super meter” rule.

Mantles support typed readiness requirements such as:

- round threshold;
- tagged actions used;
- damage prevented;
- allies supported;
- movement/positioning achievements;
- statuses created/exploited;
- terrain/objective contribution;
- HP/MP/resource state;
- explicit encounter condition.

A protective Mantle should tend to become ready through protective play.

A movement Mantle should tend to become ready through movement play.

A control Mantle should tend to reward control/setup play.

Readiness is server-authoritative and visible enough to plan around.

---

## 14. Duration and Afterstrain

Mantles are temporary.

The UI always communicates:

- readiness;
- manifest rank;
- active state;
- remaining duration;
- important sustained rules;
- expected Afterstrain.

**Afterstrain** creates the question:

> When is this transformation worth the recovery window?

Afterstrain can affect Movement, MP/resource recovery, initiative, defenses, particular action tags, or another authored vulnerability.

It is not one universal debuff and higher rank does not automatically mean “less downside.”

A Rank III specialist may gain a much stronger state while accepting a more dangerous recovery profile.

---

## 15. State Classification

Mantled and Afterstrain states are explicit combat-state categories, not ordinary generic buffs/debuffs.

Normal Cleanse/Dispel/Copy/Steal behavior does not affect them unless a specific authored mechanic explicitly supports that state category.

This prevents accidental interaction while still allowing future deliberate counters.

---

## 16. Higher Ranks Must Change Rules, Not Only Numbers

Invalid progression:

```text
Rank I   +10%
Rank II  +20%
Rank III +30%
```

Preferred progression:

### Rank I

Establishes the Mantle's core tactical state.

### Rank II

Deepens the state through specialization: new rule interaction, altered entry effect, or stronger identity tied to the Mantle Path.

### Rank III

Adds a signature mechanic/state-management option powerful enough to justify Deep Dedication while remaining counterable.

Raw coefficients may change, but deeper ranks must create different decisions.

---

## 17. Content / Combinatorial Safety

Mantles are a finite authored catalog.

Do not create a bespoke Mantle for every Discipline, Confluence, Soulmark, nation, item set, or combination thereof.

Use:

- stable build/content tags;
- reusable Effect Catalog behavior;
- typed Path requirements;
- typed Dedication constraints;
- a small number of deliberately authored iconic interactions.

Before expanding the Mantle catalog, account for added burden across PvE, PvP, AI, acquisition content, UI, VFX/SFX, Manual/News, analytics, and regression testing.

---

## 18. Armory / Saved Loadout Integration

Once Mantles exist, the Build / Armory experience shows:

- equipped Mantle;
- permanently earned rank;
- current Mantle Path;
- **current manifest rank**;
- satisfied/unsatisfied Path requirements;
- Dedications currently imposed;
- what the player gains at the next rank;
- what flexibility they give up.

Saved combat loadouts include Mantle configuration.

A loadout may intentionally be saved as:

- Generalist / Rank I;
- Rank II specialist;
- Rank III deep specialist.

Loadout activation remains atomic and server-authoritative.

This turns Mantle specialization into actual theorycrafting instead of a permanent irreversible choice.

---

## 19. Battle UI

The battlefield-first interface integrates Mantles through the existing **Signature** area of the Command Deck rather than adding another giant menu.

The action preview displays:

- Mantle + Path;
- manifest rank;
- readiness;
- activation cost;
- entry effect;
- duration;
- sustained rule summary;
- Afterstrain.

The Turn Economy Tracker/context can show:

```text
MANTLE I     READY
MANTLE II    ACTIVE · 2 ROUNDS
MANTLE III   PATH REQUIREMENT NOT MET
MANTLE       AFTERSTRAIN · 1 ROUND
```

Transformation VFX may be spectacular but must return quickly to readable tile occupancy, facing, hazards, objectives, target shapes, and enemy telegraphs.

---

## 20. PvP Safety

Rare specialist progression must not make standard competitive play structurally unfair.

Queue configuration must support:

- Mantles on/off;
- maximum effective rank;
- specific Mantle/Path legality;
- rank normalization;
- queue-specific coefficients/rules;
- seasonal version pinning;
- emergency disable.

Rank III should not automatically be legal at full power in standard ranked merely because PvE supports it.

If Rank III is permitted, its Hard Dedication must remain part of the validated competitive loadout—players do not receive the upside while bypassing the sacrifice.

No paid Mantle combat advantage is allowed.

---

## 21. PvE / Co-op

Ordinary progression must not assume everyone uses Rank II/III.

High-end optional content may deliberately reward good Mantle timing or specialist teams, but no single advanced Mantle Path should become compulsory for all difficult Expeditions.

Generalists and specialists should each have legitimate roles.

---

## 22. AI

Combat AI uses the same authoritative rules and understands:

- manifest rank derived from its legal build;
- readiness;
- entry/sustained value;
- duration;
- Afterstrain;
- objective timing;
- opponent visible Mantle state;
- Path-specific role.

AI cannot ignore Dedications that a human build must obey.

Tactical Hall Mantle access remains progression/spoiler gated.

---

## 23. Manual / News / Discovery

The public Manual can explain:

- what Mantles are;
- Rank I vs advanced specialization;
- Manifest Rank;
- activation/duration/Afterstrain;
- public Paths and competitive rules.

It must not automatically spoil secret Rank II/III requirements or unreleased acquisition content.

News is the official channel for released Mantles/Paths, balance changes, rank-cap changes, temporary disablement, and relevant event announcements.

Archive/Codex discovery may expose deeper lore/path clues according to legitimate player discovery.

---

## 24. Media

Mantles are premium presentation moments.

A released Mantle can require stable Asset IDs for:

- icon;
- transformation VFX;
- active-state visual language;
- rank/path distinctions;
- Afterstrain cue;
- activation/expiration SFX;
- optional Rank III signature audio/music treatment;
- Manual/News/key-art needs.

All remain owner-replaceable through the Asset Studio/media pipeline later.

---

## 25. Master Panel — Mantle Studio

The Master Panel eventually exposes controlled Mantle authoring for:

- Mantle identity;
- ranks;
- Mantle Paths;
- progression qualification;
- build-pattern requirements;
- Dedications / Hard Dedications;
- manifest-rank resolution;
- readiness;
- activation;
- entry/sustained effects;
- duration;
- Afterstrain;
- PvE/PvP overrides and caps;
- AI metadata;
- spoiler/Manual metadata;
- Asset IDs;
- analytics;
- staged publish/version diff/rollback/emergency disable.

No arbitrary JavaScript/SQL is entered into content definitions.

Owner/support QA grants or corrections require explicit audited commands.

---

## 26. Analytics and Balance Questions

Track enough evidence to answer:

- How many players own each earned rank?
- How many **active builds** actually manifest Rank II/III?
- What are the most common Dedications?
- Are Rank III generalists somehow bypassing intended sacrifices?
- Are Rank II/III builds overperforming outside their intended specialty?
- Are generalist Rank I builds still viable?
- How often is each Mantle activated, and in what round?
- Is Afterstrain actually creating risk?
- Which Current/Legacy/Soulmark/equipment combinations dominate each Path?
- Does PvP normalization preserve meaningful tradeoffs?

Rarity should be measured both as **ownership rarity** and **manifestation rarity**.

---

## 27. Monetization Guardrail

Mantle power is gameplay-earned.

Never sell:

- Rank I access;
- Rank II/III qualification;
- Mantle Path eligibility;
- reduced Dedication requirements;
- readiness charge;
- duration extensions;
- reduced Afterstrain;
- ranked effective rank;
- paid Mantle rolls.

Cosmetic transformation flourishes may eventually be monetized only if they preserve battlefield readability and never change mechanics.

---

## 28. Server Authority

The server owns:

- Mantle ownership;
- earned rank;
- Path unlocks;
- active build Path;
- build-pattern validation;
- Dedication enforcement;
- manifest rank;
- readiness;
- activation legality;
- duration/effects;
- Afterstrain;
- PvP effective-rank policy;
- progression provenance.

The client submits intent and previews authoritative rules; it never chooses its own Mantle rank or removes its specialization costs.

---

## 29. Definition of Success

The system succeeds when:

- every legitimate player can eventually experience Rank I without payment gating;
- Rank I remains useful and exciting for flexible builds;
- Rank II visibly identifies builds that chose to specialize;
- Rank III is rare primarily because both the achievement and the active-build sacrifice are demanding;
- a Rank III character can still choose a broad build and intentionally fall back to Rank I/II;
- specialists are exceptional at their specialty but demonstrably lack other forms of flexibility;
- higher ranks change tactical rules rather than merely multiplying numbers;
- Soulmarks, Confluences, Disciplines, Ultimates, equipment, and Veteran Edge remain distinct;
- PvP can normalize/disable ranks safely;
- the Owner can author, rebalance, replace media, publish, rollback, and emergency-disable Mantle content through the Master Panel;
- Mantles deepen AUREVANE theorycrafting without creating another unmanageable combinatorial system.
