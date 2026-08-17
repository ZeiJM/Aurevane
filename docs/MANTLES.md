# AUREVANE — Mantles: Earned Transformation States

**Status:** Authoritative feature specification subordinate only to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/COMBAT.md`, `docs/PROGRESSION_RETENTION.md`, `docs/NATURAL_PACING.md`, `docs/PLAYER_MANUAL.md`, `docs/MASTER_PANEL.md`, `docs/MEDIA_PIPELINE.md`, and `docs/ROADMAP_MANTLES.md`.

**Direction approved:** 2026-08-16.

AUREVANE includes a later-game system of manually activated, temporary combat transformations called **Mantles**.

The broad fantasy is simple:

> **A Mantle is a higher combat state that a character earns the right to manifest for a short time.**

Mantles are not inherited bloodlines, not passive racial powers, not a second Soulmark system, and not a generic rage button granted at character creation. They are cultivated states of deliberate self-mastery reached through combat knowledge, world experience, personal choices, and difficult rites.

The system should create the feeling:

> **“I have been building toward the right to become this.”**

rather than:

> “My meter filled, so I pressed the glowing button.”

---

## 1. System Identity

The player-facing system name is **Mantles**.

Suggested verbs and UI language:

- **Manifest Mantle** — activate the state;
- **Mantle Ready** — activation requirement is currently satisfied;
- **Mantled** — actor is currently transformed;
- **Afterstrain** — the recovery state after a Mantle ends;
- **Mantle Rank I / II / III** — mechanical progression tiers;
- optional lore-facing rank titles may be authored later, but the rules must remain clear.

The exact terminology may be refined through narrative production, but do not reuse another game's transformation-system name or presentation.

---

## 2. What a Mantle Is Not

Mantles must remain distinct from existing AUREVANE pillars.

### Discipline

A Discipline is a learned combat tradition and owns Arts, Traits, Reactions, Movement Arts, Mastery, and Ultimates.

A Mantle does not replace a Discipline and does not create a second class system.

### Legacy Discipline / Confluence

A Confluence is the interaction created by Current + Legacy Discipline.

A Mantle may interact with combat tags created by the build, but it must not require bespoke Mantle × every Discipline × every Confluence content. Avoid another combinatorial explosion.

### Soulmark

A Soulmark represents unusual supernatural potential unique to the person. It has a passive mechanic, Signature Art, upgrade branches, and visual identity.

A Mantle is instead an **earned temporary state that the character deliberately enters during battle**.

A player may possess both a Soulmark and a Mantle. Neither replaces the other.

### Ultimate

An Ultimate is a Discipline-owned apex Art.

A Mantle is a temporary rules state lasting multiple turns/rounds. Its activation and sustained effects should create a different tactical decision from simply casting an Ultimate.

### Veteran Edge

Veteran Edge is bounded Rekindling prestige, especially relevant to high-level PvP.

Mantles are a normal character-build/progression system and must not become uncapped prestige stacking.

---

## 3. Thematic Role in AUREVANE

AUREVANE's central character theme is deliberate becoming without losing coherent identity.

Mantles reinforce that theme by representing **chosen possibility stabilized through discipline and constraint**.

The character does not become everything at once.

They temporarily embody one earned, coherent higher state.

This lets Mantles sit naturally beside:

- multiple learned Disciplines;
- one Current + one Legacy Discipline;
- Confluence;
- one active Soulmark;
- equipment;
- long-horizon world progression;
- Rekindling.

Do not make every Mantle secretly originate from Aurevane or the central mythology. Different Mantles may arise from different cultures, schools, rites, rare environments, philosophies, Expedition discoveries, mentors, institutions, or supernatural phenomena.

---

## 4. Progression Structure

Mantles use three major ranks.

```text
MANTLE RANK I
    ↓
MANTLE RANK II
    ↓
MANTLE RANK III
```

These ranks are **not ordinary character levels** and do not increase automatically from generic XP.

Each rank represents a qualitatively deeper relationship with the Mantle.

### Rank I — Broadly attainable, not automatic

The intended long-term rule is that every legitimate character can eventually earn access to at least one Rank I Mantle.

Rank I should still feel earned.

A representative unlock may require combinations such as:

- sufficient character/Horizon progression;
- understanding of normal tactical combat;
- at least one meaningful Discipline milestone;
- Soulmark or equivalent story-system familiarity where appropriate;
- completion of a dedicated Mantle Rite / personal trial;
- a server-authoritative world or quest milestone.

Do not give Rank I during character creation or the first tutorial battles.

The player should first understand normal combat so Mantling feels like a meaningful expansion rather than baseline clutter.

### Rank II — Path-bound advancement

Rank II is intentionally **not guaranteed to every player merely because time passed**.

A player reaches Rank II by pursuing a compatible advanced path and satisfying authored requirements.

Possible requirement categories include:

- mastery of particular kinds or counts of Disciplines;
- specific tactical accomplishments;
- advanced Expedition clears or challenge modifiers;
- mentor/faction/world-story commitments;
- rare but recurring world discoveries;
- difficult solo rites;
- build-specific demonstrations of mastery;
- Archive/lore reconstruction where the Mantle's fiction supports it;
- competitive accomplishments only for Mantles explicitly designed around competition, with non-PvP alternatives required for broadly useful combat power.

Rank II should create **social identity**: players can recognize that someone invested deeply in a particular path.

A production rule may limit how many Rank II Mantle paths a character can fully deepen within one progression cycle. Any such commitment must be clear before confirmation and must not create an unrecoverable permanent account trap; Rekindling or another approved long-horizon mechanism may allow a different future path.

### Rank III — Sovereign-tier rarity

Rank III is an exceptional achievement.

It should be rare because its requirements are difficult, layered, and path-specific—not because the game secretly rolls a tiny random percentage or sells access.

A Rank III path should normally require:

- Rank II of that Mantle;
- late-cycle / high-Horizon progression;
- multiple relevant mastery accomplishments;
- one or more advanced PvE/world/build milestones;
- a bespoke personal or group challenge that actually tests the Mantle's intended play;
- a path-specific narrative/discovery condition;
- explicit server-authoritative eligibility;
- possibly First Horizon, Rekindling, or another endgame qualification when appropriate to that Mantle.

Not every Mantle must ship with Rank III immediately.

Rank III should be authored deliberately and may arrive only for selected Mantles when the content, balance, art, audio, and progression support it.

The first players to achieve a new Rank III may receive Chronicle recognition or cosmetic prestige, but **first-witness status must never make the combat power permanently unobtainable for later legitimate players**.

---

## 5. Rarity Without Permanent Unfairness

The system should create real rarity while respecting AUREVANE's retention and competitive-fairness rules.

Prefer rarity created by:

- difficult qualification;
- unusual route combinations;
- deep character investment;
- mastery challenges;
- rare-but-recurring discoveries;
- hard Expedition conditions;
- personal rites;
- late-Horizon progression;
- build knowledge;
- meaningful player choice.

Do not use as the default gate:

- paid rolls;
- paid access;
- one-time permanent-exclusive combat power;
- tiny unbounded RNG drop rates with no protection;
- hidden real-time login windows measured in hours;
- staff favoritism;
- first-come-only permanent power.

A player can look at a Rank III Mantle user and think:

> “That person did something extraordinary.”

They should not think:

> “That person happened to be online on one Tuesday three years ago, so I can never compete.”

---

## 6. Combat Activation

Mantles are **manually activated in battle**.

They are not always-on passive states.

A Mantle definition includes concepts equivalent to:

- activation requirement;
- activation Action Cost Class;
- entry effect;
- duration;
- sustained effects;
- rank-specific modifications;
- Afterstrain;
- reactivation/charge rule;
- mode-specific overrides;
- visual/audio presentation;
- AI and counterplay metadata.

### Default activation rhythm

A representative baseline is:

1. meet the Mantle's battle-readiness requirement;
2. choose **Manifest Mantle** from the Signature area of the Command Deck;
3. preview entry effect, duration, sustained effects, and Afterstrain;
4. confirm;
5. server validates and activates the versioned Mantle state;
6. Mantle remains active for its configured duration;
7. state expires or is ended by a specifically authored rule;
8. Afterstrain begins.

The exact numbers are balance data.

### Activation should not be a dead turn

If activation consumes the normal Action, the Mantle should normally have a meaningful **entry effect** so the player is making a tactical action rather than simply skipping a turn to become stronger later.

Examples of entry-effect categories include:

- reposition;
- barrier;
- zone creation;
- cleanse of allowed ordinary statuses;
- mark;
- stance change;
- resource conversion;
- battlefield pulse;
- initiative adjustment within bounded rules.

Do not default every Mantle to a damage explosion.

---

## 7. Readiness / Charge Philosophy

Do not make every Mantle a generic super meter that fills identically from dealing damage.

Mantles should support a data-driven **Readiness Requirement**.

Possible requirement primitives include:

- minimum round;
- combat resource threshold;
- number/type of tagged actions used;
- damage prevented;
- allies supported;
- movement/positioning accomplishment;
- status setup/payoff;
- objective contribution;
- HP/MP state;
- explicitly authored encounter condition;
- once-per-battle availability after a prior prerequisite.

A defensive Mantle may become ready through protective play.

A mobility Mantle may become ready through movement/positioning play.

A control Mantle may become ready through setup and terrain manipulation.

This lets readiness reinforce the Mantle's identity instead of rewarding every build for doing the same thing.

Readiness must be server-authoritative and visible enough that the player can plan around it.

---

## 8. Duration

Mantles are temporary.

A representative first-pass duration may be a small number of rounds, but exact duration is content/balance data.

The UI must always show:

- whether the Mantle is ready;
- whether it is active;
- remaining duration;
- the relevant sustained effects;
- the expected Afterstrain.

Do not hide a transformation timer and surprise the player with expiration.

---

## 9. Afterstrain

A Mantle creates a recovery cost called **Afterstrain**.

Afterstrain is not merely punishment for using the fun button. It creates the tactical question:

> **When is this power worth the recovery window?**

Afterstrain may affect things such as:

- Movement Budget;
- MP/resource recovery;
- defensive effectiveness;
- initiative;
- particular action tags;
- readiness for another special state;
- an authored temporary vulnerability.

Avoid one universal Afterstrain debuff for every Mantle.

The recovery profile should reinforce the transformation's fantasy and counterplay.

Higher ranks do not need to simply reduce Afterstrain. They may alter the relationship: stronger state, different recovery, new management tool, or a more demanding tradeoff.

---

## 10. Mantle State Classification

Mantled and Afterstrain states use explicit combat-system classifications.

They are not ordinary cleanseable status effects by default.

Generic Cleanse / Dispel / Copy / Steal systems should interact only with state categories they explicitly support.

Normal status removal should therefore not accidentally delete a Mantle.

However, AUREVANE should not hard-code absolute mystical immunity into unrelated code paths.

The combat grammar may support explicit interactions such as:

- `MANTLE_STATE`;
- `AFTERSTRAIN_STATE`;
- `can_affect_mantle = true` for an authored rare mechanic;
- specific scenario suppression where deliberately designed.

Any ability capable of directly suppressing or altering a Mantle must say so clearly and receive explicit balance/counterplay review.

Mantles cannot be copied merely by generic effect-copy systems unless a future feature is explicitly designed around that possibility.

---

## 11. Rank Design — More Than Bigger Numbers

Rank progression must not become:

```text
Rank I   +10%
Rank II  +20%
Rank III +30%
```

Each deeper rank should change how the player thinks.

A useful pattern is:

### Rank I

Establish the Mantle's core state and tactical rhythm.

### Rank II

Add one meaningful rule interaction, improve or branch the entry effect, and deepen the relationship with a clear style of play.

### Rank III

Add a genuinely signature rule, transformation payoff, or state-management option that feels legendary while remaining counterable and mode-safe.

Raw coefficients may improve, but rule depth and identity matter more than vertical inflation.

---

## 12. Content Scale / Combinatorial Safety

Mantles must remain a finite authored catalog.

Do **not** define a bespoke Mantle for every:

- Discipline;
- Current + Legacy pair;
- Soulmark;
- equipment set;
- nation;
- combination of the above.

That would create another impossible production matrix.

Instead:

- Mantles have stable tags and Effect Catalog interactions;
- Disciplines/Soulmarks/equipment may interact through shared tags where useful;
- a small number of iconic bespoke interactions may be authored deliberately;
- the Mantle remains mechanically coherent across many builds.

Before expanding the Mantle catalog, measure the marginal burden in:

- PvE balance;
- PvP matchups;
- AI behavior;
- UI/readability;
- VFX/SFX;
- acquisition content;
- Manual/News content;
- test cases;
- Master Panel tooling.

---

## 13. Build Integration

Once the system is released, a combat-ready character may have a concept equivalent to:

```text
CURRENT DISCIPLINE
+
LEGACY DISCIPLINE
+
SOULMARK
+
EQUIPMENT
+
CONFLUENCE
+
EQUIPPED MANTLE
```

Only one Mantle is equipped/manifestable at a time by default.

Mantle selection belongs in the central Build / Armory experience once the system exists.

Saved loadouts should eventually include the equipped Mantle and its valid rank/path state.

Loadout activation remains atomic and server-authoritative.

Changing a Mantle outside allowed preparation rules must not become an in-battle exploit.

---

## 14. Battle UI

The battlefield-first interface should integrate Mantles without creating a second giant command system.

### Command Deck

Add **Manifest Mantle** to the existing Signature area when:

- the actor has a Mantle equipped;
- the battle mode allows it;
- readiness requirements are met.

The action preview must show:

- Mantle name and rank;
- activation cost/action use;
- entry effect;
- duration;
- sustained rule summary;
- Afterstrain;
- relevant targeting if activation has an entry target/area.

### Turn Economy Tracker

Show Mantle readiness/state where relevant:

```text
MANTLE    NOT READY
MANTLE    READY
MANTLE    ACTIVE · 2 ROUNDS
MANTLE    AFTERSTRAIN · 1 ROUND
```

### Combat rails / inspector

The ally rail, enemy inspector, and initiative/context presentation should make an active Mantle recognizable without overwhelming HP/MP/status readability.

### Visual hierarchy

Transformation VFX must be exciting but cannot obscure:

- tile occupancy;
- facing;
- target shapes;
- hazards;
- objectives;
- status icons;
- enemy telegraphs.

Rank III may earn a stronger entrance moment, but action resolution still returns quickly to readable tactical play.

---

## 15. PvP Rules

Rare progression must not make standard competitive play structurally unfair.

PvP queue configuration must support:

- Mantles enabled/disabled;
- maximum effective Mantle rank;
- queue-specific coefficients/effects where necessary;
- normalization to a lower mechanical rank while preserving permitted cosmetics;
- specific Mantle disable/kill switch;
- version pinning for a season/queue.

A sensible default during early competitive validation is to cap standard ranked play at the Mantle rank actually supported by population progression and balance evidence.

Rank III should **not automatically be legal at full strength in standard ranked** merely because it exists in PvE.

Special queues or events may allow unrestricted Mantles if clearly disclosed.

No paid Mantle progression, paid rank unlock, or paid competitive bypass is allowed.

---

## 16. Co-op and PvE

Mantles should create useful team timing without making group content assume every participant owns an advanced rank.

Encounter design should avoid:

- mandatory Rank II/III checks for ordinary progression;
- bosses that are trivial without a Mantle and impossible without one;
- one Mantle becoming required for every difficult Expedition group.

High-end optional challenges may deliberately test Mantle timing once the system is mature.

Bosses and elite NPCs may have their own phase/transformation systems. Do not label every boss phase a player Mantle just to reuse the word.

---

## 17. AI

Combat AI must understand Mantle legality through the same authoritative combat engine.

AI decision logic should consider:

- readiness;
- activation cost;
- expected remaining battle duration;
- entry effect value;
- sustained-state value;
- Afterstrain risk;
- objective timing;
- opponent active Mantle duration;
- public counterplay information.

AI must not know hidden future player choices or secret Mantle eligibility not exposed by the encounter state.

Tactical Hall opponents may use Mantles only when the relevant records/content have been legitimately unlocked and spoiler policy permits them.

---

## 18. Acquisition Content

A Mantle unlock should normally be memorable content, not a silent database flag.

Possible acquisition experiences include:

- personal rite;
- mentor chain;
- difficult combat trial;
- Expedition discovery;
- world landmark interaction;
- faction philosophy/commitment;
- Archive reconstruction followed by a practical rite;
- rare recurring event path;
- high-Horizon challenge.

A Rank II or III unlock should ideally answer:

> **Why did this character earn this state?**

The answer should be visible in their history, not merely their XP total.

---

## 19. Discovery and Secrecy

Some Mantles/ranks may be known publicly; others may be discoverable.

The public Manual may explain:

- what Mantles are;
- how activation/duration/Afterstrain work;
- currently public acquisition paths;
- competitive rules;
- known Mantle effects.

It must not automatically reveal:

- hidden Rank II paths;
- secret Rank III conditions;
- unreleased Mantles;
- lore-gated acquisition steps;
- unrevealed bosses/regions required by a path.

The Archive/Codex may reveal deeper information according to legitimate discovery state.

---

## 20. News Integration

Public News is the official channel for communication such as:

- a newly released Mantle;
- a newly enabled Rank II/III path;
- balance changes;
- PvP rank-cap changes;
- disabled/broken Mantle notices;
- event-linked acquisition windows;
- significant rules corrections.

Patch notes should link to the current Manual entry where public rules changed.

Do not reveal secret acquisition conditions merely to announce that a new mystery exists.

---

## 21. Media / Presentation

Mantles are high-value visual/audio content.

Each released Mantle should define media needs equivalent to:

- Mantle icon;
- transformation/manifestation VFX;
- active-state VFX language;
- expiration/Afterstrain cue;
- activation SFX;
- sustained audio treatment where useful;
- optional signature music stem or mix treatment for exceptional Rank III moments;
- UI presentation assets;
- key art only where justified.

Media follows `docs/MEDIA_PIPELINE.md` and stable Asset IDs.

The Owner must eventually be able to replace Mantle art/audio through Asset Studio without changing combat code.

Cosmetic variants may eventually exist, but they must preserve competitive readability and never change mechanics.

---

## 22. Master Panel — Mantle Studio

The Master Panel must eventually include a safe **Mantle Studio** or equivalent Character/Combat Content editor.

Authorized staff should be able to manage:

- Mantle identity/name/description;
- enabled/disabled state;
- rank definitions;
- acquisition requirements;
- progression-path requirements;
- readiness rules;
- activation/action cost;
- entry effects;
- duration;
- sustained effects;
- Afterstrain;
- reactivation limits;
- shared tags/interactions;
- PvE/PvP overrides;
- ranked rank caps / legality;
- AI metadata;
- Manual visibility/spoiler metadata;
- art/audio Asset IDs;
- content version;
- staged publish;
- rollback;
- emergency disable;
- dependency/impact preview;
- analytics.

No arbitrary JavaScript/SQL is entered into Mantle definitions.

Mantles must reuse typed Target/Requirement/Effect/state grammars where practical.

Owner/support tools may grant or revoke Mantle progression for QA/recovery through explicit audited commands. Routine operation must not require raw database edits.

---

## 23. Analytics

Track enough evidence to detect whether a Mantle is becoming mandatory or oppressive.

Useful measures include:

- unlock rate by character age/Horizon;
- equipped rate;
- Rank I/II/III population distribution;
- activation rate;
- activation round;
- battle completion with/without activation;
- win rate conditioned on Mantle/rank/build/mode;
- damage/healing/prevention/objective contribution during active state;
- Afterstrain survival/value impact;
- duration utilization;
- PvP matchup data;
- queue rank-cap effects;
- acquisition-funnel abandonment;
- Mantle pairing with Current/Legacy/Soulmark/equipment;
- Rank II/III rarity over time.

Do not use one raw win-rate number as the sole balance decision.

---

## 24. Monetization Guardrail

Mantle combat power is earned through gameplay.

Never sell:

- Rank I unlock;
- Rank II eligibility;
- Rank III eligibility;
- Mantle readiness charge;
- duration extensions;
- reduced Afterstrain;
- ranked Mantle power;
- random paid Mantle rolls.

Optional cosmetics may eventually alter safe presentation such as aura treatment, transformation flourish, profile badge/frame, or non-gameplay visual variants subject to readability and monetization rules.

---

## 25. Security / Server Authority

The browser never determines:

- whether a Mantle is owned;
- rank;
- path eligibility;
- readiness;
- activation legality;
- duration;
- effects;
- Afterstrain;
- PvP effective rank;
- acquisition completion;
- reward/progression state.

All such state is server-authoritative and versioned.

Activation commands must be idempotent/retry-safe according to the combat command model.

Persistent unlock/rank changes require durable provenance.

---

## 26. Definition of Success

The system succeeds when:

- Rank I gives most long-lived characters an exciting earned transformation without becoming mandatory button spam;
- Rank II makes committed paths visibly meaningful and not automatic;
- Rank III users are genuinely rare and prestigious because they completed extraordinary requirements;
- the transformation creates tactical timing and counterplay rather than only stat inflation;
- Soulmarks, Disciplines, Confluences, Ultimates, equipment, and Veteran Edge remain distinct and valuable;
- standard ranked PvP remains configurable and fair despite rare high ranks;
- acquisition creates memorable world/story/gameplay moments;
- visuals/audio make manifestation feel exceptional without destroying battlefield readability;
- the Owner can safely edit, publish, disable, rebalance, and replace Mantle content/media through the Master Panel;
- the game can add Mantles over time without creating an impossible combinatorial content burden.
