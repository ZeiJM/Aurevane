# AUREVANE — Supernatural System Refinement

**Status:** Owner-approved authoritative refinement subordinate only to `docs/GAME_MASTER_PLAN.md`.

**Direction approved:** 2026-08-18.

This document supersedes conflicting older wording in `docs/GAME_MASTER_PLAN_BUILD_SYSTEM_ADDENDUM.md`, `docs/MANTLES.md`, and related planning where necessary.

It locks the following direction:

- **Essence** is the final pure-Discipline counterpart to Resonance;
- **Soulmark** remains the canonical supernatural term;
- Soulmarks may use highly variable passive/Skill packages and highly unusual mechanics;
- ordinary characters choose the permanent **Soulmarked vs Soul-Severed** fork;
- AUREVANE has six ordinary Mantle identities;
- Mantles enhance the build already equipped and grant **no additional Skills**;
- Mantles support three coded invocation levels, but only Levels I and II are normally attainable;
- Mantle Level III exists only for GAME OWNER anomaly grants;
- GAME OWNER can create tightly controlled **Anomaly Characters** that break ordinary supernatural limits;
- supernatural acquisitions use minimum level + Horizon/story/mastery/rite gates;
- all persistent supernatural configuration is managed from the Character Profile, while privileged anomaly controls live only in `/master`.

---

# 1. Essence Is Final

The pure-Discipline opposite of Resonance is officially named **Essence**.

```text
PRIMARY + SECONDARY
=> Resonance passive

PRIMARY ONLY
=> Essence Skill
```

Essence is one extra active Skill outside the normal eight Discipline-Skill capacity and represents the undiluted identity of the Primary Discipline.

Essence is not an Ultimate.

Its balance rule remains:

> **The more of an Essence's power budget spent on raw damage, the less remains for control, defense, support, movement, status, terrain, displacement, or other special effect; the stronger/broader the special effect, the lower raw damage should generally be.**

---

# 2. Ordinary Supernatural Fork

Ordinary player characters eventually occupy one of three conceptual states:

```text
UNAWAKENED
Has not made the permanent supernatural choice.

SOULMARKED
Has one current Soulmark.
Cannot ordinarily use Mantles.

SOUL-SEVERED
Underwent The Severance.
Cannot ordinarily bind Soulmarks.
May pursue Mantles.
```

Approved terminology:

- **Soulmark** — canonical supernatural identity term;
- **The Severance** — irreversible rite/choice;
- **Soul-Severed** — formal state/adjective;
- **the Severed** — natural shorthand.

The fork is server-authoritative, heavily confirmed, auditable, and persists through Rekindling.

Merely not yet having a Soulmark never counts as being Soul-Severed.

The only exception to ordinary exclusivity is the explicit GAME OWNER-only Anomaly system defined later in this document.

---

# 3. Soulmarks — One Identity, Many Possible Structures

Soulmarks are the most creatively permissive normal supernatural build layer in AUREVANE.

An ordinary Soulmarked character has **one current Soulmark**.

Binding a different eligible Soulmark permanently removes the prior Soulmark from that character after a strong confirmation flow. This must never be an accidental one-click replacement.

Soul-Severed characters cannot ordinarily bind Soulmarks.

Soulmark branches are **not** forced into one passive + one Skill.

Valid branch packages include:

```text
2 passives / 0 Skills
0 passives / 2 Skills
1 passive / 1 Skill
1 major passive / 0 Skills
0 passives / 1 exceptional long-cooldown Skill
1 passive / 2 deliberately smaller Skills
```

Any active Soulmark Skill sits outside the 6/8 Discipline-Skill capacity.

---

# 4. Soulmark Branch Counts

Soulmarks may have:

- **1 branch** for focused identities;
- **2 branches** for most Soulmarks;
- **3 branches** for rare/complex Soulmarks.

Branches should change the way the Soulmark plays, not merely change a coefficient by a few points.

Example structure only:

```text
SUMMONING SOULMARK

Branch A — Shepherd
support-oriented summon passive + support Skill

Branch B — Legion
multiple weaker entities through passives/rules

Rare Branch C — Avatar
one very powerful long-cooldown summon Skill
```

The example is illustrative, not a locked Soulmark.

---

# 5. Soulmark Creative Design Space

Soulmarks may legitimately explore mechanics such as:

- **summoning** supernatural creatures, echoes, constructs, familiars, spirits, copies, or temporary entities;
- **teleportation / spatial control** including blink, swap, portal, foldspace, range distortion, or forced repositioning;
- **AoE mutation** that conditionally gives eligible existing Skills splash, cones, lines, chains, bursts, or zones;
- **elemental infusion/conversion** such as Fire, Frost, Storm, Shadow, Poison, etc.;
- **poison / DoT identities** involving stacking toxins, delayed damage, spread, detonation, cleansing counterplay, or payoff windows;
- **global Skill mutation** that changes categories of the character's existing Skills instead of merely adding buttons;
- **healing transformation** such as heal-to-barrier, delayed healing, self-heal rules, overheal conversion, or bounded life-drain patterns;
- **defensive transformation** involving Guard, Armor/Ward conversion, damage redirection, thresholds, or counter-defense;
- **movement / Jump / verticality** involving unusual ledges, air control, terrain traversal, landing triggers, or displacement;
- **terrain / zone manipulation**;
- **cooldown/resource relationships** under strict anti-loop caps;
- **combo identity** granting bonuses for authored Skill/tag/action sequences;
- **risk/reward curse packages** with meaningful weaknesses and stronger compensating strengths;
- **temporary supernatural states** that remain Soulmark mechanics rather than becoming Mantle transformations;
- other typed, testable supernatural rules that create a genuinely distinct battlefield plan.

The catalog should make two characters with the same Disciplines capable of approaching combat in radically different ways.

---

# 6. Soulmark Strengths and Weaknesses

A Soulmark may deliberately include negative effects in exchange for stronger positive effects.

Illustrative shapes:

```text
stronger Fire identity
but a relevant defensive weakness
```

```text
high mobility/teleport payoff
but reduced defense immediately after teleporting
```

```text
strong DoT/Poison scaling
but weaker immediate burst
```

```text
powerful healing conversion
but reduced ordinary healing received
```

The weakness must genuinely matter to the intended build. Fake drawbacks that can be trivially ignored do not buy meaningful extra power.

Soulmarks use an internal **Soulmark Power Budget** considering:

- always-on passive value;
- active Skill value;
- cooldown;
- Action Economy cost;
- range/area;
- reliability;
- setup/conditions;
- encounter flexibility;
- stat scaling;
- strengths;
- weaknesses;
- counterplay;
- PvE/PvP results.

Soulmarks aim for comparable overall opportunity value, not identical damage output.

---

# 7. Soulmark Catalog Scale

The architecture/content workflow must support **100+ Soulmarks over the lifetime of the game** without schema redesign.

Quality gates:

- proof set: small and deliberately diverse;
- first broad catalog: approximately **24–36**;
- mature catalog: approximately **48–72**;
- long-term: 100+ only when additional marks remain genuinely distinct.

Branches multiply practical diversity, so the project must never chase `100 shallow percentage bonuses` merely to reach a number.

---

# 8. Mantles — Six Transformation Identities

AUREVANE's mature ordinary catalog contains **six Mantle identities**.

Only the Soul-Severed may pursue Mantles through ordinary progression.

A Mantle is a temporary transformation/buff state that enhances the character's **existing build**.

**Mantles grant no additional active Skills.**

Instead, a Mantle may temporarily modify:

- Might/Finesse/Intellect/Resolve expression or derived stats;
- Physical/Mystic Power;
- HP/MP behavior;
- Armor/Ward;
- Accuracy/Evasion/Critical behavior;
- Status Resistance;
- Initiative;
- Movement/Jump;
- healing/barrier output;
- damage/defense/support coefficients;
- Action Economy efficiency within strict caps;
- cooldown behavior within strict caps;
- existing Skill tags/effects under controlled rules;
- temporary passive effects that exist only while Mantled.

The six Mantles should collectively cover different tactical fantasies rather than six variants of generic damage amplification.

Useful mechanical coverage families include:

1. **Force / Endurance**;
2. **Protection / Defense**;
3. **Velocity / Verticality**;
4. **Mystic / Resource Potency**;
5. **Restoration / Sustain**;
6. **Tempo / Precision**.

Final names/lore may blend these axes; none should become the universal best Mantle.

---

# 9. Mantle Invocation Is a Choice of Attained Level

The combat command is **Invoke Mantle**.

A character chooses the invocation level at activation time from the levels they have legitimately attained or been granted.

Unlocking a higher level never removes the ability to use a lower level.

This is a permanent Mantle design principle:

> **Mantle progression expands tactical choice; it does not replace the safer lower state.**

The coded invocation levels are:

### Mantle Level I — Tempered Manifestation

Normal attainable state.

- meaningful temporary power;
- lowest amplification of the Mantle's defining effects;
- lighter Afterstrain;
- safest choice when a player wants a controlled boost rather than maximum commitment.

### Mantle Level II — Full Manifestation

Normal advanced attainable state.

- significantly greater temporary power/stat/rule amplification;
- stronger enhancement of the Mantle's defining axes;
- serious Afterstrain;
- earned through substantially harder progression/rite/challenge requirements.

A player with Level II chooses at invocation:

```text
TEMPERED MANIFESTATION (I)
or
FULL MANIFESTATION (II)
```

### Mantle Level III — Transcendent Manifestation

**Coded but not normally earnable.**

This state exists exclusively for GAME OWNER anomaly grants.

- extreme version of the Mantle's defining temporary amplification;
- does not create new Skills;
- carries **severe Afterstrain** and may use stricter duration/readiness rules;
- never appears in ordinary quest, loot, event, shop, Rekindling, achievement, profession, or progression reward tables;
- cannot be granted by Moderator, Content Staff, Event Staff, support automation, ordinary admin capability, or player API;
- only the protected stable GAME OWNER principal may grant/revoke Level III eligibility.

A character granted Mantle Level III may deliberately invoke **I, II, or III**.

```text
TEMPERED (I)
lowest risk / lowest peak

FULL (II)
high peak / serious Afterstrain

TRANSCENDENT (III)
extreme peak / severe Afterstrain
Owner-only anomaly
```

Exact coefficients/durations are versioned balance data.

---

# 10. Mantle Afterstrain

Afterstrain is a special server-owned vulnerability/recovery state after a Mantle ends.

Ordinary cleanse effects do not erase it unless a very specific authored rule explicitly says otherwise.

Possible Afterstrain penalties include temporary reductions to:

- Armor/Ward;
- Movement/Jump;
- Accuracy/Evasion;
- healing output/received;
- resource recovery;
- Action Economy efficiency;
- Status Resistance;
- other Mantle-specific properties.

Severity scales by invoked level:

```text
LEVEL I
meaningful but manageable Afterstrain

LEVEL II
serious punishable Afterstrain

LEVEL III
severe anomaly-grade Afterstrain
```

The higher state should not be free power. Timing the transformation and surviving the aftermath are part of Mantle skill expression.

Initial ordinary balance should generally favor one Mantle invocation per battle unless a specific mode/encounter explicitly allows more.

---

# 11. Supernatural Minimum-Level and Progression Gates

Supernatural power must have explicit progression floors.

Every Soulmark, branch, Mantle, and Mantle level has versioned requirements such as:

- minimum Character Level;
- minimum Horizon where relevant;
- story/world milestone;
- Discipline Mastery requirement;
- required rite/challenge;
- prerequisite branch/Mantle level;
- content/source eligibility;
- PvE/PvP mode legality.

A level floor is a **minimum**, not the complete requirement. Reaching the number alone never automatically grants the power.

### Recommended production global floors

Initial defaults for validation:

```text
Soulmark Awakening / Severance decision:
Level 10 minimum + early-story combat-understanding checkpoint

Additional ordinary Soulmark binding:
per-Soulmark minimum; normally Level 15+ with source/rite requirements

Second branch on a multi-branch Soulmark:
typically Level 25+ plus Soulmark-specific progression

Rare third branch:
typically Level 50+ plus advanced Soulmark rite/challenge

First ordinary Mantle pursuit:
Level 20 minimum + Soul-Severed + required Mantle rite/source

Mantle Level I — Tempered Manifestation:
Level 20 global floor; individual Mantles may require substantially higher levels

Mantle Level II — Full Manifestation:
Level 60 global floor + advanced Horizon/content + Mantle Level I + difficult Mantle-specific rite/challenge

Mantle Level III — Transcendent Manifestation:
NO normal level/progression acquisition path; GAME OWNER grant only
```

These are production starting defaults, not immutable lore laws. They are Master Panel configurable/versioned within safe boundaries.

### Individual content may be stricter

One Mantle might be available at Level 20 while another may legitimately require Level 45, 70, or later content because of its narrative/power identity.

Likewise a simple Soulmark may be early while a rare world/boss/event Soulmark may carry a much higher minimum level and Horizon requirement.

### Owner anomaly bypass

The GAME OWNER Anomaly system may explicitly bypass normal level/Horizon gates when the Owner chooses to do so. Such a bypass must be a visible deliberate flag in the grant operation and fully audited; it is never inferred automatically.

---

# 12. Ordinary Character Profile Configuration

All persistent ordinary build/supernatural configuration is managed from the Character Profile.

Recommended structure:

```text
CHARACTER PROFILE
├ Attributes
├ Disciplines
│  ├ Primary / Secondary
│  ├ Mastery
│  ├ 4-hour attunement timers
│  ├ Discipline Skills
│  └ Resonance / Essence
├ Supernatural
│  ├ Unawakened / Soulmarked / Soul-Severed
│  ├ Soulmark + branch
│  └ OR Mantle + attained invocation levels
├ Equipment
│  ├ gear
│  └ Equipment Skills/effects
├ Loadouts
└ Prestige
```

For a Mantle character, the Profile shows which invocation levels are attained, but the player selects **which attained level to invoke during battle**.

All persistent writes are server-authoritative.

---

# 13. GAME OWNER-Only Anomaly Characters

AUREVANE deliberately supports an exceptional **Anomaly Character** override for rare Owner-created characters, special experiments, unique story figures, rewards, spectacles, or explicit cheatcode-like cases.

Anomaly status is **not normal progression**.

It cannot be earned, purchased, rolled, referred into, crafted, traded, inherited, obtained through Rekindling, or granted by normal staff/support workflows.

Only the stable protected **GAME OWNER** principal can create, modify, or revoke an Anomaly override from `/master`.

This authority is intentionally **not delegable** to Moderator, Content Staff, Event Staff, or an Owner-granted generic capability.

### Approved anomaly shapes

The Master Panel may grant one of the following controlled supernatural exceptions:

#### DUAL_SOULMARK

- character may have two active Soulmarks;
- both active branch packages may function simultaneously;
- any Soulmark Skills remain separately tagged outside the Discipline cap;
- ordinary one-Soulmark replacement rules do not automatically destroy the anomaly slot.

#### DUAL_MANTLE

- character may equip/access two Mantles;
- character can choose which equipped Mantle to invoke;
- default anomaly behavior permits **only one Mantle active at a time**;
- simultaneous double-Mantle stacking is not part of the approved baseline override and would require a separate future Owner rule.

#### SOULMARK_AND_MANTLE

- character may keep an active Soulmark and also equip/use a Mantle;
- this bypasses the ordinary Soulmarked/Soul-Severed exclusivity only through the anomaly entitlement.

An anomaly character remains clearly marked internally as exceptional rather than rewriting the ordinary supernatural state machine for everyone.

---

# 14. Owner-Only Mantle Level III Grant

The Master Panel also exposes a specific Owner-only grant:

```text
MANTLE_LEVEL_CAP_OVERRIDE = 3
```

It applies to a selected Mantle on the selected character.

Rules:

- Level III is never normally earnable;
- granting III automatically permits choosing I, II, or III for that Mantle;
- Owner can optionally bypass normal Level/Horizon prerequisites, but must explicitly confirm the bypass;
- grant/revoke requires a written reason;
- every change is audited with Owner principal, target character, Mantle, previous/new cap, bypass flags, time, and reason;
- revocation cannot delete legitimate Level I/II attainment;
- if the character legitimately earned II, removing the III override returns their cap to II.

---

# 15. Competitive Integrity for Anomaly Characters

Anomaly builds are **nonstandard**.

Default policy:

- standard Ranked PvP rejects active anomaly supernatural overrides;
- official tournaments reject them unless the tournament rules explicitly define a special anomaly exhibition mode;
- leaderboards/statistics that represent ordinary competitive balance exclude anomaly-enabled matches or label them separately;
- Casual/custom/event modes may allow anomalies only when their rules explicitly opt in;
- spectators/participants receive enough public legality information to understand that an anomaly ruleset is active where relevant;
- anomaly state never grants hidden command authority or bypasses battle server validation.

The Owner may create explicit exhibition/test/event modes where anomaly characters are expected, but must not silently contaminate ordinary competitive balance data.

---

# 16. Master Panel Anomaly Controls

`/master` eventually contains a protected **Character Anomaly Override** surface visible only to GAME OWNER.

Required controls:

- search/select exact stable character/account identity;
- view ordinary supernatural state;
- grant/revoke `DUAL_SOULMARK`;
- grant/revoke `DUAL_MANTLE`;
- grant/revoke `SOULMARK_AND_MANTLE`;
- assign/remove anomaly-only second Soulmark/Mantle slot content;
- grant/revoke Mantle Level III for a specific Mantle;
- explicitly choose whether normal level/Horizon gates are bypassed;
- preview resulting effective build before commit;
- show PvP/queue restrictions caused by anomaly state;
- mandatory reason field;
- high-friction confirmation for destructive/revocation changes;
- full immutable audit history;
- emergency revoke/disable.

No arbitrary SQL, client flag, character-name check, or browser-owned authority may create an anomaly.

The character name `Zei` never grants anomaly power by itself; only the protected Owner principal controls these commands.

---

# 17. Anomaly Revocation Safety

Revoking an anomaly must not accidentally destroy legitimate permanent progression.

If an override is removed while the build would become illegal:

- the server marks extra anomaly-only supernatural slots inactive;
- the ordinary legal slot remains or must be selected through an Owner-reviewed correction flow;
- legitimate Soulmark/Mantle ownership/progression is preserved according to its normal rules;
- no duplicate benefits remain active;
- queued/battle sessions use their versioned snapshot rules and cannot exploit revoke/reconnect races.

---

# 18. Distinct System Identities

The mature systems must remain easy to explain:

### Resonance
Two Disciplines mixed together => passive interaction.

### Essence
One pure Primary Discipline => extra active signature Skill.

### Soulmark
Persistent supernatural identity => variable branch package, potentially passives, Skills, summons, teleportation, mutations, strengths/weaknesses, etc.

### Mantle
Soul-Severed transformation => temporarily amplifies the existing build, adds no Skills, player chooses among attained invocation levels, followed by Afterstrain.

### Anomaly
Owner-only cheatcode/exception => may break ordinary supernatural slot/fork/level rules; nonstandard competitive legality.

These systems should never become cosmetic reskins of one another.
