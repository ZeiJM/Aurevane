# AUREVANE — Supernatural System Refinement Addendum

**Status:** Owner-approved authoritative refinement of `docs/SUPERNATURAL_SYSTEM_REFINEMENT.md`.

**Direction approved:** 2026-08-18.

This addendum supersedes conflicting wording in the earlier supernatural refinement where necessary. In particular it locks **Mantle charging**, **simultaneous Mantle stacking for approved Anomaly Characters**, **Owner-exclusive Soulmarks**, **the public Anomaly badge**, and **information-control/passive design space**.

---

# 1. Mantle Invocation Includes a Charge State

Mantles do not become active the instant the player selects the invocation command.

The server-owned state flow is conceptually:

```text
READY
  ↓
INVOKE MANTLE + choose attained Manifestation level
  ↓
CHARGING
  ↓
MANIFESTED
  ↓
EXPIRES
  ↓
AFTERSTRAIN
  ↓
RECOVERED
```

The **Charging** state is a deliberate anticipation window. It gives Mantle use weight, makes activation readable to allies/enemies, and prevents a transformation from being a completely untelegraphed instant power spike.

### Baseline charge behavior

Initial implementation target:

- `Invoke Mantle` is a committed server-authoritative combat choice;
- the chosen Mantle and Manifestation level are locked when charging begins;
- the transformation does **not** enhance actions already resolved before charging;
- by default the charge completes at the beginning of the character's next activation, making the decision visible before the power window begins;
- the character may therefore have to survive an opponent response window before receiving the Mantle's benefits;
- exact charge timing may be tuned per Mantle/mode through versioned data if testing proves a shorter or longer interval is healthier;
- charging cannot be shortened by browser timing, reconnecting, animation skipping, or client manipulation;
- only explicitly authored effects may accelerate, delay, protect, interrupt, or otherwise interact with a Mantle Charge;
- a disrupted charge must have a deterministic result defined by the Mantle/ruleset rather than ad-hoc client behavior.

The charge itself is not a new Skill. Mantles still grant **no additional Skills**.

### Charge readability

During Charging, public battle state should clearly communicate at least:

- which character is charging a Mantle;
- which Mantle is being invoked when the ruleset makes that identity public;
- the selected Manifestation level when the mode makes it public;
- the expected completion timing;
- whether the charge is currently interruptible under the active rules.

Do not hide Mantle Charging behind a cosmetic animation that has no authoritative state.

---

# 2. Mantle Manifestation Levels Remain Player Choice

The existing coded levels remain:

```text
I   — Tempered Manifestation
II  — Full Manifestation
III — Transcendent Manifestation (GAME OWNER anomaly grant only)
```

Attaining a higher level adds options; it never replaces lower levels.

A character with Level II can choose I or II when beginning the charge.

A character with Owner-granted Level III can choose I, II, or III.

Charge, Manifestation duration, amplification, and Afterstrain are all versioned per selected level.

---

# 3. Dual-Mantle Anomalies May Stack Mantles Simultaneously

The earlier restriction allowing only one active Mantle at a time for `DUAL_MANTLE` Anomaly Characters is removed.

A Game Owner-approved **Dual-Mantle Anomaly** may:

- possess/equip two Mantles;
- invoke either Mantle independently;
- have both Mantles **Manifested simultaneously** when both charges have legitimately completed;
- choose the attained Manifestation level of each Mantle independently;
- combine the temporary stat/passive/rule effects of both Mantles according to explicit stacking rules;
- incur the Afterstrain of each invoked Mantle independently when each expires.

Example anomaly state:

```text
Mantle A — Full Manifestation II
ACTIVE: 2 turns remaining

Mantle B — Tempered Manifestation I
ACTIVE: 3 turns remaining
```

Both amplification packages may operate at once.

### Stacking rules are explicit

Double Mantle does **not** mean blindly multiplying every coefficient twice.

Each Mantle effect declares a stack behavior such as:

```text
ADDITIVE_BOUNDED
HIGHEST_ONLY
LOWEST_ONLY
MULTIPLICATIVE_CAPPED
INDEPENDENT
REPLACE_IF_STRONGER
SPECIAL_COMPOSITE
```

High-risk categories such as Action Economy, cooldown manipulation, turn acceleration, damage multiplication, invulnerability, and resource regeneration require hard caps and dedicated anomaly tests.

### Dual charge behavior

Unless an explicit anomaly configuration says otherwise:

- each Mantle must be charged separately;
- beginning the second charge does not cancel the first active Mantle;
- both charge/active/Afterstrain states are independently server-owned;
- the Owner may create special exhibition configurations that alter charge timing, but these are explicit anomaly rules, never ordinary progression behavior.

### Double Afterstrain

If both Mantles expire near the same time, their Afterstrain states may overlap.

Afterstrain stacking uses explicit typed rules and can become extremely dangerous. This is intentional for anomaly-grade power, but the result must remain deterministic and inspectable.

---

# 4. Anomaly Badge Is a Public Character Identity Marker

A character with an active Anomaly override receives the official profile badge:

> **ANOMALY**

The badge is a presentation marker, not an authority grant.

### Badge behavior

- displayed on the character's Profile while any Anomaly override is active;
- visually distinct from staff Official Badges such as `WORLDWRIGHT`;
- must not imply staff authority, moderation authority, ownership, or account trust;
- tooltip/help copy explains that the character possesses an exceptional Game Owner-granted rules exception;
- may appear on public/shareable character cards where profile badges are shown;
- cannot be manually selected as a cosmetic by ordinary players;
- automatically disappears when all Anomaly overrides are revoked, while Chronicle/history may preserve that the character previously held anomaly status if the Owner chooses that history to be public;
- standard Ranked/tournament restrictions caused by Anomaly state are shown separately from the badge itself.

The Anomaly badge is derived from authoritative anomaly entitlement state. A client flag, character name, title, cosmetic, or copied badge asset cannot create Anomaly powers.

---

# 5. Game Owner-Exclusive Soulmarks

The Game Owner may create special Soulmarks that exist **outside the normal rollable/acquisition pool**.

Canonical classification:

```text
NORMAL_SOULMARK
OWNER_EXCLUSIVE_SOULMARK
```

An Owner-exclusive Soulmark is a full Soulmark content definition. It can use the same expressive grammar as any other Soulmark:

- 1–3 branches;
- passives;
- active Soulmark Skills;
- summons;
- teleports;
- Skill mutation;
- elemental conversion;
- healing/defense/resource effects;
- information-control effects;
- strengths/weaknesses;
- combo sequences;
- custom VFX/SFX/media;
- unusual typed effects approved by the Effect Catalog.

### Owner-exclusive acquisition rule

An `OWNER_EXCLUSIVE_SOULMARK`:

- is never included in ordinary story random-roll pools;
- is never included in normal event reward tables;
- is never dropped by ordinary enemies/Expeditions;
- is never sold through player commerce, premium shop, Trade House, or profession systems;
- is never granted by referral, Rekindling, achievement, or ordinary support compensation;
- may be hidden entirely from the public Soulmark catalog until the Owner chooses to reveal it;
- can only be granted/revoked by the stable protected **GAME OWNER** principal through `/master`;
- requires an exact character target, reason, preview, confirmation, and audit record.

Moderator, Content Staff, Event Staff, automation, generic support tooling, and special delegated capabilities cannot grant an Owner-exclusive Soulmark unless this rule is explicitly redesigned later. The default is truly Owner-only.

### Owner-exclusive does not automatically mean Anomaly

If a normal Soulmarked character receives one Owner-exclusive Soulmark as their single legal Soulmark, the character does **not** automatically become an Anomaly merely because the content source is exclusive.

Anomaly status is granted only when the Owner intentionally enables a rules exception such as:

```text
DUAL_SOULMARK
DUAL_MANTLE
SOULMARK_AND_MANTLE
MANTLE_LEVEL_III
other future explicit anomaly override
```

If an Owner wants a Soul-Severed character to use an Owner-exclusive Soulmark while retaining Mantle access, the Owner must explicitly grant the appropriate Anomaly override.

---

# 6. Owner Soulmark Studio

`/master` eventually includes a protected **Owner Soulmark Studio** capability.

The Game Owner can:

- create a Soulmark definition from scratch or duplicate a safe draft;
- classify it `NORMAL_SOULMARK` or `OWNER_EXCLUSIVE_SOULMARK`;
- define branch count and branch packages;
- attach passives and Skills from approved typed effect grammar;
- create new Soulmark-specific Skills/effects through validated content tooling;
- define strengths and weaknesses;
- define cooldown/Action Economy/resource behavior;
- define acquisition visibility and roll-pool eligibility;
- define minimum Level/Horizon/story/rite gates for normal Soulmarks;
- mark an Owner-exclusive Soulmark as hidden/public/teased;
- preview/simulate;
- publish/retire/rollback;
- directly grant/revoke Owner-exclusive Soulmarks to exact characters;
- inspect all holders and anomaly interactions;
- emergency-disable a broken Soulmark without deleting history.

Creating or granting an Owner-exclusive Soulmark is always audited.

---

# 7. Information-Control Mechanics Are Valid Build Effects

AUREVANE may include Skills/passives/Soulmarks/equipment/Resonances and other approved effects that alter **what combat information an opponent can see**.

This is an explicit tactical design space, not a client-side concealment trick.

Possible effects include:

- hiding exact MP and showing only a broad band;
- hiding selected derived-stat values;
- obscuring exact cooldown readiness while still showing legally required visible effects;
- hiding or partially masking resource pools;
- replacing exact HP/MP numbers with percentage bands where the rules permit;
- concealing the exact magnitude of certain temporary buffs/debuffs;
- hiding selected equipment/stat details from enemy inspection;
- false/masked inspection information only when an explicit deceptive mechanic defines exactly what may be falsified;
- revealing more opponent information than normal as the inverse/scrying design space.

### Information concealment never changes authority

The server still knows the real values.

Forecasts, damage resolution, AI legality, reconnects, spectators, and replays use authoritative hidden state and the correct visibility projection for the viewer.

### Non-hideable battle facts

Ordinary information-control effects should not conceal facts required to make legal tactical decisions, including:

- unit position;
- battlefield occupancy;
- visible terrain/hazards;
- whether a character is alive/defeated;
- public statuses whose existence changes target legality;
- a visible Mantle Charge/Manifestation when the rules require telegraphing;
- committed outcomes already revealed by play;
- objective ownership/state that the mode defines as public.

Ranked PvP may normalize, cap, or disable specific concealment effects if testing shows they undermine competitive readability.

The AI Knowledge Filter must obey the same visibility rules rather than reading concealed player data simply because it exists on the server.

---

# 8. Resource-Pool and Capacity Passives

Passives may legitimately modify resource capacities and other bounded pools.

Examples include:

- larger/smaller maximum MP;
- larger/smaller HP;
- increased summon capacity where a summon system defines a bounded cap;
- extra charges for a specific tagged mechanic;
- larger shield/barrier storage cap;
- altered status-stack caps;
- expanded temporary resource pools;
- reduced pool in exchange for stronger output;
- converting one pool into another under explicit rules.

These effects must not silently change the **6/8 Discipline Skill capacity**. Skill-cap changes are not part of ordinary passive design unless a future explicitly approved system says otherwise.

Pool modification is included in the same effect-budget, cap, simulation, PvP, and anti-loop review as other build effects.

---

# 9. Supernatural Distinctions Remain Clear

The mature identities remain:

### Resonance
Primary + Secondary => passive class-interaction effect.

### Essence
Primary only => one extra active pure-Discipline Skill.

### Soulmark
Persistent supernatural identity => highly variable branch package, potentially passives, Skills, summons, teleports, mutations, concealment, strengths/weaknesses, and more.

### Mantle
Soul-Severed transformation => charged, temporary amplification of the existing build; no new Skills; chosen Manifestation level; Afterstrain after expiry.

### Anomaly
Game Owner-granted exception => may break ordinary supernatural exclusivity/limits, including dual Soulmarks, simultaneous dual Mantles, Soulmark + Mantle, and Owner-only Mantle Level III.

### Owner-exclusive Soulmark
Special Soulmark content that only the Game Owner can grant. It does not itself imply Anomaly unless a normal character rule is also being broken.
