# AUREVANE — Discipline Atlas, Acquisition & Mastery Addendum

**Status:** Owner-approved authoritative game-design addendum.

**Direction approved:** 2026-09-12.

**Authority:** Subordinate to `docs/GAME_MASTER_PLAN.md`; complementary to `docs/GAME_MASTER_PLAN_BUILD_SYSTEM_ADDENDUM.md`, `docs/GAME_MASTER_PLAN_TECHNIQUE_REPEAT_USE_ADDENDUM.md`, `docs/PROGRESSION_RETENTION.md`, `docs/REKINDLING_FRONTIER.md`, and `docs/OFFLINE_PROGRESSION.md`.

Where older subordinate text describes the 36-Discipline roster as one flat availability pool, treats listed Mastery prerequisites as the entire mature acquisition model, or represents Phase-4 testing entitlement as earned Mastery, **this addendum controls**.

This document does not change the established build contract:

```text
CHARACTER ATTRIBUTES
+
PRIMARY DISCIPLINE
+
OPTIONAL MASTERED SECONDARY DISCIPLINE
+
UP TO FOUR SELECTED DISCIPLINE TECHNIQUES
+
RESONANCE OR PURE-DISCIPLINE ESSENCE
+
SOULMARK OR SOUL-SEVERED MANTLE PATH
+
EQUIPMENT + EQUIPMENT SKILLS
+
BOUNDED PRESTIGE / VETERAN EDGE
```

It defines how characters discover, unlock, learn and master the Disciplines that feed that contract.

---

# 1. Design thesis

AUREVANE's Discipline roster is a **map of combat knowledge**, not a vertical job-upgrade ladder.

The central rule is:

> **Later Disciplines unlock different rules, greater specialization and higher execution demands — not a larger universal power budget.**

A character who unlocks Bastion has not upgraded Vanguard into “Vanguard II.” Vanguard and Bastion remain separate endgame-capable traditions with different reliability, setup, Technique libraries, Essences, Resonance partners and tactical identities.

The system should create several long-horizon questions at once:

- What do I want to master next?
- What new tradition could that mastery reveal?
- Do I want breadth across several Disciplines or exceptional depth in one?
- Do I remain pure for Essence or master a Secondary for Resonance?
- What does my next Rekindling let me understand that my first journey could not?
- Which rumors in the Atlas are actual traditions rather than ordinary lore?

Acquisition must therefore feel like learning a world rather than clearing a dropdown.

---

# 2. The Discipline Atlas

The player-facing progression map is the **Discipline Atlas**.

It is not a skill tree and must not communicate that downstream nodes replace upstream nodes.

The Atlas records the character's relationship to combat traditions through states such as:

```text
VEILED
  ↓
RUMORED
  ↓
REVEALED
  ↓
UNLOCKED
```

Not every Discipline needs every intermediate state.

## Veiled

The tradition is genuinely secret. Its identity and exact requirements must not be exposed to an ordinary unrevealed client merely because the application is browser-based.

## Rumored

The character has encountered enough evidence to know that an unusual tradition may exist, but does not yet have a complete initiation path.

## Revealed

The Discipline is known and its ordinary requirements can be understood.

## Unlocked

The character has satisfied the authored release requirements and may legitimately acquire/use the Discipline under normal production rules.

## Testing access

During approved development periods, a separate server-owned entitlement may make a **published** Discipline effectively selectable even while its normal release requirements are unmet. Testing access is not an Atlas progression state in character history and must never create false earned Mastery.

---

# 3. Publication and acquisition are separate gates

AUREVANE must distinguish:

```text
CONTENT PUBLISHED
```

from:

```text
CHARACTER ELIGIBLE
```

A planned Discipline may exist in the design Atlas without having a production base profile, eight Techniques, Essence, Resonance coverage, art/audio coverage, AI legality or database definitions.

Testing entitlement **never** makes unpublished content selectable.

A Discipline becomes playable only after its combat content is legitimately published through the normal versioned content pipeline.

This prevents a testing override from exposing half-authored classes or forcing runtime placeholder mechanics.

---

# 4. Long-horizon availability bands

The 36-Discipline target roster is divided into broad acquisition bands.

## Foundation — six creation choices

Available from the beginning:

1. Vanguard
2. Farstrider
3. Shadehand
4. Ironfist
5. Aetherist
6. Lifebinder

These are complete combat identities and remain endgame-viable.

## First Journey

Most advanced Disciplines should be discoverable before the first Rekindling through Mastery combinations and authored world acquisition.

The first journey should contain enough of the full roster that buildcraft feels expansive rather than withholding the game for months.

## Rekindling I

A smaller group of veteran traditions may require one completed Rekindling because their mechanics assume broad familiarity with AUREVANE combat or because their fiction belongs to later-cycle recognition.

## Rekindling II

Starcaller is the intended deep-horizon R2 apex path.

## Rekindling III

Spellwright is the intended R3 apex metamagic path.

Rekindling may continue beyond three cycles for Veteran Edge breadth, Echo Routes, Hall of Selves history, cosmetics, titles, Chronicle identity and other long-horizon goals. **Discipline gates do not need to keep escalating beyond R3.**

---

# 5. Canonical roster acquisition map

The following identity-level map is approved. World quests, mentor names, exact encounter IDs and secret puzzle details remain separately authored content.

| # | Discipline | Mature acquisition direction |
|---:|---|---|
| 1 | Vanguard | Foundation |
| 2 | Farstrider | Foundation |
| 3 | Shadehand | Foundation |
| 4 | Ironfist | Foundation |
| 5 | Aetherist | Foundation |
| 6 | Lifebinder | Foundation |
| 7 | Bastion | Vanguard Adept |
| 8 | Ravager | Vanguard Adept |
| 9 | Edgedancer | Vanguard Practiced + Shadehand Practiced |
| 10 | Skywarden | Vanguard Practiced + Farstrider Practiced |
| 11 | Blade Saint | Rekindling I + Vanguard Expert + Ironfist Adept + Still Blade initiation |
| 12 | Nightveil | Shadehand Adept + Ironfist Practiced |
| 13 | Wildwarden | Farstrider Adept |
| 14 | Beastbinder | Farstrider Adept + Ironfist Practiced |
| 15 | Runeblade | Vanguard Practiced + Aetherist Practiced |
| 16 | Dawnshield | Vanguard Adept + Lifebinder Adept |
| 17 | Dreadblade | Vanguard Adept + Aetherist Adept |
| 18 | Cantor | Farstrider Practiced + Lifebinder Practiced |
| 19 | Alchemist | Shadehand Practiced + Aetherist Practiced |
| 20 | Warcaller | Rekindling I + Bastion Practiced + Cantor Practiced |
| 21 | Cinderweaver | Aetherist Practiced |
| 22 | Frostweaver | Aetherist Practiced |
| 23 | Stormsinger | Aetherist Practiced + Farstrider Initiate |
| 24 | Stonebinder | Aetherist Practiced + Vanguard Initiate |
| 25 | Tidecaller | Aetherist Practiced + Lifebinder Initiate |
| 26 | Chronist | Rekindling I + Aetherist Adept |
| 27 | Riftwalker | Rekindling I + Aetherist Adept + Shadehand Initiate |
| 28 | Veilweaver | Aetherist Practiced + Shadehand Practiced |
| 29 | Gravebinder | Rekindling I + Aetherist Adept + Lifebinder Practiced + secret initiation |
| 30 | Eidolist | Rekindling I + Aetherist Adept + Lifebinder Adept |
| 31 | Oracle | Rekindling I + Lifebinder Adept + Aetherist Initiate + secret proof |
| 32 | Hexbinder | Aetherist Practiced + Shadehand Adept |
| 33 | Sanguinist | Rekindling I + Lifebinder Practiced + Aetherist Adept + secret initiation |
| 34 | Loreeater | Farstrider Practiced + Aetherist Practiced + first-cycle secret monster-study path |
| 35 | Starcaller | Rekindling II + Aetherist Master + Chronist Adept + Riftwalker Adept + secret celestial/Reach discovery |
| 36 | Spellwright | Rekindling III + Aetherist Master + any three specialist magical Masters + Grand Formula examination |

The exact specialist pool used by Spellwright is data-driven. It should not force one immutable trio.

---

# 6. Secret Disciplines

The approved secret/veiled identities are:

- Loreeater;
- Gravebinder;
- Oracle;
- Sanguinist;
- Starcaller;
- Spellwright.

Secret status means the **in-world discovery path matters**. It does not mean permanent exclusivity, cash gating, one-time live-event gating or account lottery.

Important build-enabling Disciplines must have repeatable legitimate discovery routes.

## Loreeater

The unlock should emerge from repeated monster study. The player first behaves like a scholar/hunter, is noticed for doing so, and only then discovers a tradition built around learning bounded supernatural Techniques from creatures.

## Gravebinder

The unlock should grow from funerary contradiction, unresolved death and the character's knowledge of both Aetherist and Lifebinder principles. It must feel native to AUREVANE's continuity themes rather than a generic “necromancer trainer.”

## Oracle

The player should prove they can act correctly on incomplete information before receiving a Discipline built around prediction and pre-emption.

## Sanguinist

The initiation should teach that life can be exchanged as a tactical resource without rewarding mindless self-destruction.

## Starcaller

The deep Reach can expose mutually incompatible skies or celestial observations. Aetherist mastery plus Chronist and Riftwalker understanding gives the player the conceptual tools to resolve the contradiction.

## Spellwright

Spellwright is the R3 apex metamagic tradition. Its final Grand Formula examination proves understanding of magical structure. It manipulates spells rather than receiving a universal “stronger mage” coefficient.

---

# 7. Mastery stages

The canonical stages remain:

```text
Initiate
  ↓
Practiced
  ↓
Adept
  ↓
Expert
  ↓
Master
```

Current numerical milestones remain:

```text
Initiate       0 XP
Practiced    100 XP
Adept        300 XP
Expert       600 XP
Master     1,000 XP
```

Numerical XP is necessary progression, but the mature system must not reduce true Master status to one grind bar.

The long-term mastery contract is:

```text
MASTERY XP
+
TECHNIQUE DEMONSTRATION
+
DISCIPLINE-PRINCIPLE CHALLENGES
+
STAGE QUALIFICATIONS
+
FINAL MASTERY RITE
```

The current Phase-4 implementation is an incremental proof of this contract, not the final world acquisition loop.

---

# 8. What each stage means

## Initiate

The character has learned the Discipline and begun using its basic language.

## Practiced

The character has demonstrated normal tools rather than merely owning/equipping them.

## Adept

The character can execute the Discipline's core tactical principle under a meaningful objective.

## Expert

The character can adapt when the Discipline's obvious plan is disrupted by map, opponent or encounter rules.

## Master

The character has demonstrated broad command of the full tradition and completed its authored Mastery Rite.

Stage challenges should vary by Discipline. AUREVANE must not turn 36 mastery journeys into the same arena fight with different icons.

---

# 9. Technique learning and demonstration

Every mature Discipline teaches eight regular Techniques.

The battle selection contract remains **up to four selected Discipline Techniques**.

For advanced Disciplines, the current approved learning cadence is:

```text
Initiate     4 learned Techniques
Practiced   +2
Adept       +2
----------------
             8 total by Adept
```

This is intentional.

Players should receive the complete tactical toolbox by Adept, then spend Expert/Master progression proving that they understand it. Mastery should not mean playing an intentionally incomplete class for the whole journey.

Technique demonstration is tracked from authoritative committed combat events. Repeatedly owning or selecting a Technique is not proof of use.

Normal Master status should require all eight regular Techniques to have been meaningfully demonstrated across legitimate qualifying play.

---

# 10. Discipline-specific Mastery Rites

Mastery Rites are authored expressions of each Discipline's philosophy, not a universal damage check.

Approved example directions include:

- **Vanguard — The Unbroken Line:** hold position, manage threat and protect an objective rather than chase kills;
- **Farstrider — The Long Hunt:** track and defeat an elusive target through positioning and firing lanes;
- **Shadehand — The Perfect Opening:** create the correct vulnerability against an enemy that punishes direct engagement;
- **Ironfist — The Empty Hand:** win through close-range sequencing and counters under constrained equipment/rules;
- **Lifebinder — No One Falls:** stabilize several vulnerable allies through escalating pressure;
- **Bastion — Last One Standing:** choose when to absorb, reposition and counterattack instead of turtling forever;
- **Chronist — The Borrowed Minute:** solve an encounter through initiative/timing manipulation;
- **Riftwalker — No Straight Road:** use spatial reasoning where normal pathing cannot solve the objective;
- **Loreeater — What Have You Learned?:** respond using accumulated creature knowledge;
- **Spellwright — The Grand Formula:** manipulate changing magical rules rather than win through raw spell damage.

Other rites should be authored when their Disciplines enter production.

---

# 11. Mastery XP sources

The mature game should award Mastery through legitimate use rather than merely having a Discipline equipped.

Eligible sources may include:

- appropriate world combat;
- quests;
- Expeditions;
- bosses;
- Battle Hall mastery challenges;
- selected PvP where abuse controls are sufficient;
- Discipline-specific mentorship/training;
- authored stage trials.

Trivial low-risk farming should not be the optimal Mastery route.

Encounter provenance, difficulty, authoritative build snapshot and committed actions must be server-owned.

A character who equips Lifebinder and spends every encounter performing unrelated Basic Attacks should not become a Lifebinder Master merely because time passed.

---

# 12. Secondary eligibility

Under normal production rules, a Secondary Discipline requires legitimate Mastery unless an explicit temporary/test rule says otherwise.

Mastery therefore creates build breadth:

```text
MASTER DISCIPLINE
  ↓
SECONDARY ELIGIBILITY
  ↓
NEW MIXED BUILDS
  ↓
NEW RESONANCE PAIRINGS
```

Mastery must not primarily reward blanket percentage power.

Avoid:

- +20% damage because a Discipline reached Master;
- permanent stat stacking per mastered Discipline;
- account-wide combat coefficients for collecting the roster.

Prefer:

- Secondary eligibility;
- Atlas branches;
- Resonance discovery/build access;
- Master-specific quests and recognition;
- Essence challenges;
- titles/cosmetics;
- Rekindling Echo Routes;
- bounded later progression.

---

# 13. Class-budget philosophy

All Disciplines target comparable overall combat viability.

The Atlas may describe qualitative identity axes such as:

- Reliability;
- Flexibility;
- Setup burden;
- Rule Access;
- Execution difficulty.

These are **not strength ratings**.

A Foundation may spend more of its design budget on reliability and low setup. An apex Discipline may spend more on unusual rule access but demand more setup, precision, information or resource management.

Illustrative shape:

```text
FOUNDATION
high reliability
low setup
clean action economy
broad usefulness

ADVANCED
more specialization
more setup
more tactical exceptions
higher execution ceiling

SECRET / APEX
unusual rule access
high preparation/knowledge burden
high execution ceiling
lower default reliability
```

No unlock band receives an automatic raw-stat multiplier merely for being later.

This is the central anti-obsolescence rule for the roster.

---

# 14. Breadth and depth

AUREVANE should recognize two legitimate long-term identities.

## Breadth

A character may master many Disciplines, opening broad Secondary options, Atlas routes and specialist prerequisites.

The game may display total Mastered Disciplines and award prestige recognition at meaningful breadth milestones.

Do not attach uncapped raw combat stats to that count.

## Depth

A player may remain devoted to one or a few Disciplines.

Depth can be recognized through:

- Essence accomplishments;
- difficult Mastery Rite variants;
- Discipline-specific Expedition feats;
- PvP records;
- Rekindling Echo challenges;
- cosmetics, titles and Chronicle identity.

A player must not feel forced to collect every Discipline merely to remain numerically viable.

---

# 15. Rekindling and Mastery memory

Rekindling preserves character history.

The game should distinguish, where later implementation requires it, between:

- **Historical Mastery** — this character has truly mastered the tradition before;
- **Current-cycle proficiency** — how far the character has rebuilt that tradition in the present cycle.

A prior Mastery achievement is not erased from Hall of Selves/history.

Later-cycle Echo Routes may replace repeated beginner instruction with shorter but harder veteran examinations.

A later cycle should not require players to repeat every first-cycle tutorial verbatim merely to restore something they have already proven they understand.

Exact carryover percentages and current-cycle thresholds remain subject to pacing validation.

---

# 16. Passive Training / Discipline Focus

Future Passive Training may support a deliberate Discipline Focus only after the active system is mature.

Guardrails remain:

- passive Mastery has a configurable numerical ceiling;
- passive progress cannot check off Technique demonstrations;
- passive progress cannot complete stage challenges;
- passive progress cannot complete a Mastery Rite;
- passive progress cannot create true Master status without active proof;
- no player should become Spellwright-qualified by never actually playing the prerequisite Disciplines.

The exact passive ceiling is a tuning parameter, not locked by this addendum.

---

# 17. Supernatural identity remains separate

Normal Discipline acquisition must not be hard-locked behind Soulmarked versus Soul-Severed status unless a future explicit design revision says otherwise.

Disciplines are learned combat traditions.

Soulmark / Severance / Mantle is a separate supernatural identity layer.

Therefore both a Soulmarked Dawnshield and a Soul-Severed Dawnshield can exist and differ because of their supernatural layer rather than because one path secretly owns the class.

This avoids turning the irreversible supernatural fork into an undocumented class-selection trap.

---

# 18. Phase-4 testing policy

During the current development/testing period:

> **Every published Discipline remains effectively available for testing.**

This is an explicit temporary server-authoritative testing policy.

It does **not** mean:

- every planned Discipline is implemented;
- every character has earned Mastery;
- every release prerequisite is satisfied;
- testing access becomes permanent character progression;
- secret planned identities must be exposed to the normal Profile client.

The system must separately compute and expose, where appropriate:

```text
EARNED MASTERY
RELEASE ELIGIBILITY
EFFECTIVE TESTING ACCESS
```

These concepts must not collapse into one boolean/fact.

The owner-approved testing overlay remains enabled until the game reaches the explicit final acquisition-enablement milestone.

---

# 19. Testing-data separation

The earlier Phase-4 support mechanism represented testing access by writing support-origin Mastery facts. Once earned Mastery XP became real, that shape could contaminate progression because support Mastery could appear as 1,000 XP / Master.

The approved architecture therefore separates testing entitlement from earned Mastery.

Testing may grant:

- effective Primary availability for published content;
- effective Secondary selection for published content;
- temporary/full published Technique access needed for testing.

Testing must not grant:

- earned Mastery XP;
- earned Master stage;
- historical legitimate Mastery;
- release prerequisite completion.

Existing explicit Owner/system/gameplay Mastery facts remain authoritative according to their provenance.

---

# 20. Final release normalization requirement

Disabling `testing_open` is necessary but not sufficient for final release.

Because development characters may have received full published Technique libraries for testing, the final acquisition-enablement release must run a dedicated normalization audit/migration that:

1. disables the testing policy;
2. verifies no old support-Mastery facts remain capable of satisfying release gates;
3. evaluates every character against earned Mastery and Atlas requirements;
4. removes or deactivates **testing-only Technique unlocks that exceed the character's legitimate earned stage**, without deleting legitimately earned/Owner-granted facts;
5. repairs active Primary/Secondary/loadout state that would be illegal under release rules through a safe, player-readable migration path;
6. preserves permanent identity, cosmetics, Chronicle/history and legitimate achievements;
7. validates all 36 publication/acquisition states before production unlock rules are declared active.

Do not silently flip the policy flag and assume development data has become release-valid.

---

# 21. Data-driven unlock evaluator

The mature unlock model must support composable server-owned conditions such as:

```text
ALL
ANY
COUNT-OF
Mastery stage
Rekindling count
quest / rite flags
Archive discoveries
world/story flags
boss / Expedition accomplishments
authored behavior achievements
```

Reveal rules and unlock rules are separate.

A secret Discipline can therefore be hidden until discovery, then show a readable remaining path without exposing the secret in advance.

Content definitions are versioned/audited. Stable identifiers are used for rules and achievements; display text is not authority.

---

# 22. Browser secrecy boundary

AUREVANE is a browser game. “Secret” cannot mean “render the hidden class into the client and hide it with CSS.”

Until the reveal boundary is satisfied, normal character-facing API projections should avoid transmitting secret planned Discipline identity, exact hidden requirements and spoiler content.

Public Manual/lore communication may intentionally acknowledge that secret Disciplines exist and may name broad long-term roster identities when the Owner chooses, but the interactive character Atlas must preserve in-world disclosure rules.

---

# 23. Master Panel / operations requirements

The mature operations surface should eventually control or inspect:

- testing-open policy;
- Discipline publication state;
- unlock/reveal rule versions;
- Mastery XP thresholds/rates;
- passive Mastery ceiling;
- stage challenge publication;
- Mastery Rite publication;
- prerequisite graph validation;
- secret reveal telemetry;
- per-Discipline Mastery distribution;
- unlock funnel/drop-off telemetry;
- kill switches and rollback;
- final-release normalization reports.

Do not hardcode operational tuning that belongs in versioned content/configuration when the corresponding Master Panel surface exists.

---

# 24. Acceptance principles

The Discipline Atlas is healthy when:

- Foundations remain represented in serious endgame builds;
- later Disciplines are desired for identity rather than mandatory coefficients;
- players can understand visible requirements without a wiki for ordinary paths;
- secret paths create discovery rather than permanent exclusion;
- Mastery cannot be completed by mindless one-button farming;
- Secondary buildcraft rewards learning without forcing universal class collection;
- Rekindling changes learning routes without erasing history;
- development testing remains convenient without corrupting earned progression;
- adding a future Discipline is a data/content operation rather than a schema redesign.

The system is not complete merely because all 36 nodes can be drawn on a page. It is complete when learning them produces different stories, different tactical questions and a durable sense that the character has accumulated knowledge.
