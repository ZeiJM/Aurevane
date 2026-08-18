# AUREVANE — Build System Rework: Disciplines, Skills, Resonance, Soulmarks, Severance & Mantles

**Status:** Owner-approved authoritative game-design addendum to `docs/GAME_MASTER_PLAN.md`.

**Direction approved:** 2026-08-18.

This addendum supersedes conflicting earlier wording for Current/Legacy Disciplines, Arts, Traits, Reactions, Movement Arts, Ultimates, Confluences, Soulmark structure, and Mantle/Soulmark coexistence. Existing server-authority, anti-pay-to-win, PvP readability, Effect Catalog, progression, and Master Panel principles remain in force unless explicitly changed here.

The new build-system goal is:

> **Deep build expression from a small number of understandable layers, with every extra layer having a distinct job.**

The intended mature combat identity is:

```text
CHARACTER ATTRIBUTES
+
PRIMARY DISCIPLINE
+
OPTIONAL SECONDARY DISCIPLINE
+
DISCIPLINE SKILLS
+
RESONANCE OR PURE-DISCIPLINE ESSENCE
+
SOULMARK OR SOUL-SEVERED MANTLE PATH
+
EQUIPMENT + EQUIPMENT SKILLS
+
BOUNDED PRESTIGE/VETERAN EDGE
```

Do not reintroduce separate player-facing Trait, Reaction, Movement Art, or Ultimate slot systems.

---

## 1. Primary Discipline / Secondary Discipline

Player-facing terminology is now:

- **Primary Discipline** — the character's current principal combat tradition;
- **Secondary Discipline** — an optional mastered combat tradition mixed into the active build.

The previous player-facing terms `Current Discipline` and `Legacy Discipline` are retired.

A Secondary Discipline must be legitimately mastered before it can be equipped as Secondary unless a future explicitly authored temporary/test rule says otherwise.

The Primary Discipline does not need to be mastered merely to be used as Primary.

### Primary Discipline determines the base stat distribution

The Primary Discipline defines the character's **base Discipline stat profile**.

This profile shapes the innate/base distribution that exists before the player's separately assigned attribute investment and other effects.

Conceptually:

```text
PRIMARY DISCIPLINE BASE STAT PROFILE
+
PLAYER-ASSIGNED ATTRIBUTE INVESTMENT
+
EQUIPMENT
+
TEMPORARY EFFECTS
=
FINAL COMBAT STATS
```

The Primary Discipline must not erase or rewrite the player's separately earned/assigned attribute points.

Changing Primary changes the Discipline base profile; it does not silently reassign the player's personal attribute investment.

The Secondary Discipline grants **no second base-stat profile**.

This preserves a meaningful difference between:

```text
Skywarden Primary + Stormsinger Secondary
```

and:

```text
Stormsinger Primary + Skywarden Secondary
```

even when both builds know the same two Disciplines.

---

## 2. Discipline Change Cooldowns

Changing Primary or Secondary is a meaningful live-character commitment.

Production default:

```text
PRIMARY DISCIPLINE CHANGE COOLDOWN   = 4 real hours
SECONDARY DISCIPLINE CHANGE COOLDOWN = 4 real hours
```

The two cooldowns are independent.

Rules:

- changing only Primary starts only the Primary timer;
- changing only Secondary starts only the Secondary timer;
- changing both in one committed update starts both timers;
- timers are server-authoritative and use trusted server time;
- browser clock changes cannot shorten them;
- logging out does not pause or reset them;
- switching devices does not bypass them;
- saved loadouts do not bypass them;
- queue/battle snapshots retain the committed disciplines for that battle/session;
- a preview/sandbox view may show the consequences of another pairing without committing it and without starting either timer;
- the confirmation UI must show which timer(s) will start and the exact remaining lock if a slot is unavailable;
- support/admin correction for a genuine data/bug incident must be audited and must not become an ordinary player respec path.

The 4-hour production defaults are Master Panel configurable and versioned.

### Tactical Hall experimentation

AUREVANE should preserve experimentation despite the live attunement cooldown.

The Tactical Hall may eventually support **non-authoritative preview/simulation loadouts** for trying a Discipline pairing without changing the persistent live build, earning normal progression, or carrying the preview into competitive/world state.

---

## 3. Discipline Skill Libraries

Every mature Discipline provides **8 learnable Discipline Skills**.

The old fixed `5 Arts + Ultimate` model is retired.

There are **no Discipline Ultimates**.

Skills are unlocked through Discipline Mastery milestones, challenges, quests, or other legitimate authored progression. A Discipline's eight skills should provide multiple tactical roles rather than eight versions of the same damage button.

A Discipline Skill may include:

- damage;
- healing;
- shielding;
- movement;
- teleportation;
- displacement;
- terrain interaction;
- status setup/payoff;
- resource conversion;
- ally support;
- enemy control;
- summon interaction;
- combo setup or payoff;
- other typed Effect Catalog behavior.

The player-facing umbrella term is **Skill**.

Origin should remain visible through tags/labels such as:

- Discipline Skill;
- Equipment Skill;
- Soulmark Skill;
- Essence Skill;
- Mantle Skill;
- Veteran Edge where applicable.

---

## 4. Discipline Skill Capacity — Pure vs Mixed

### One Discipline only

If the character equips a Primary Discipline and leaves Secondary empty:

- all **8 learned Discipline Skills** from that Primary may be equipped;
- the build is eligible for the pure-Discipline system defined below;
- no Resonance exists because only one Discipline is active.

### Primary + Secondary

If the character equips both a Primary and Secondary Discipline:

- the active loadout may equip a total of **6 Discipline Skills** from the two active Discipline libraries;
- the Secondary must be legitimately mastered;
- the pair generates a Resonance passive;
- the character loses eligibility for the pure-Discipline Essence Skill while Secondary remains equipped.

The total-six cap is locked. The exact permitted Primary/Secondary split inside those six slots may be tuned through validation; the engine must not assume that every future balance version requires one immutable 4/2 split.

The UI must always show the skill's source Discipline.

---

## 5. Extra Granted Skills Do Not Consume the 6/8 Discipline Cap

The 6/8 limit applies **only to Discipline Skills**.

Explicitly tagged skills granted by other systems use their own bounded slots/rules and do not consume the Discipline Skill capacity.

Examples include:

- pure-path Essence Skill;
- Soulmark Skills;
- Equipment Skills;
- temporary Mantle Skills while manifested;
- a future bounded Veteran Edge Technique if one is approved.

This is intentional.

However, `outside the 6/8 cap` does **not** mean unlimited buttons. Every source system must define its own bounded grant count and the battle UI must group skills by source so complexity remains readable.

---

## 6. Resonance — Mixed-Discipline Passive

The former **Confluence** system is renamed **Resonance**.

A Resonance exists when an eligible Primary + Secondary pair is equipped.

### Resonance is passive

The default Resonance reward is a **passive mechanical interaction**, not a separate active button.

Resonances should change how the two Disciplines work together rather than merely grant generic coefficients.

Examples of valid Resonance behavior:

- using one Discipline's setup tag changes the payoff of the other;
- a movement/displacement event triggers a bounded secondary effect;
- a particular skill sequence gains a bonus;
- healing, guarding, terrain, summons, statuses, position, facing, initiative, or resource use interact differently;
- a pair gains an authored once-per-turn/round passive trigger.

Example retained in spirit from the old Confluence concept:

```text
Skywarden + Stormsinger
Resonance: Thunderfall

Landing after an eligible aerial action creates a bounded storm effect around the landing area.
```

Resonance effects are data-driven, versioned, server-authoritative, forecastable where relevant, and Master Panel manageable.

### Pair direction

The preferred content model is one core Resonance per unordered Discipline pair unless a specific design needs a Primary-dependent clause.

Primary/Secondary direction already changes the base stat profile, available skill pool emphasis, and live combat identity; the project should not automatically double the full Resonance authoring matrix.

---

## 7. Pure-Discipline Counterpart to Resonance — Working Name: Essence

A character who intentionally leaves Secondary empty does not receive Resonance.

Instead, the character may equip the **pure-Discipline counterpart** to Resonance.

**Working recommended name:** **Essence** / **Discipline Essence**.

This name remains subject to Owner naming approval, but the mechanic is approved.

### Essence reward

A pure Primary build receives access to one special **Essence Skill** representing the undiluted identity of that Discipline.

This skill:

- sits outside the normal eight Discipline Skill slots;
- is effectively a special ninth pure-path skill;
- exists only while no Secondary Discipline is equipped;
- is authored as a strong signature expression of the Discipline;
- uses normal authoritative Action Economy, targeting, effect, and cooldown rules;
- is not called an Ultimate.

### Damage/effect balance principle

Each Essence Skill follows an explicit tradeoff:

> **The more of its budget spent on raw damage, the less remains for utility/control/special effect; the stronger or broader the effect, the lower the raw damage should generally be.**

Examples:

- high damage + very small rider;
- medium damage + meaningful displacement/status/terrain effect;
- low/no damage + powerful control, movement, shielding, or team effect.

The Effect Catalog and balance tooling must make this tradeoff inspectable rather than hiding it inside arbitrary numbers.

### Resonance versus Essence

The two routes must remain competitive alternatives:

```text
MIXED BUILD
Primary + Secondary
6 Discipline Skills
+ Resonance passive
+ broader cross-Discipline interactions

PURE BUILD
Primary only
8 Discipline Skills
+ 1 Essence Skill
+ no Resonance
```

Neither route should be globally superior.

---

## 8. Cooldowns

All usable non-basic Skills have cooldowns unless a future rule explicitly defines a different bounded use model.

Cooldowns are:

- server-authoritative;
- content/version controlled;
- visible in the battle UI;
- included in forecasts/tooltips;
- configurable through the appropriate Master Panel content editor;
- testable under AI, PvE, PvP, reconnect, and replay.

### Basic-action exemptions

The following ordinary Basic actions do not use normal Skill cooldowns:

- Movement;
- Basic Attack;
- Guard.

The baseline heal/recovery action **does** use a cooldown.

Production default:

```text
Basic Heal / Recover cooldown = 2 of the actor's own turns
```

Unless a specific skill says otherwise, `N turn cooldown` means the skill remains unavailable through the next N turns of that actor and then becomes ready according to the server-owned cooldown clock.

Cooldown reduction/extension effects may exist later only through typed, bounded, testable rules. Infinite refresh loops are forbidden.

---

## 9. Equipment Skills — Replacement for Equipment Arts

The player-facing term **Art** is retired from the build system.

Weapons, armor, and shields may grant **Equipment Skills**.

Equipment Skills:

- sit outside the 6/8 Discipline Skill cap;
- use the same Target Spec, Effect Catalog, Action Economy, cooldown, forecast, AI-legality, and server-authority framework as other combat Skills;
- may have unusual Action Economy costs;
- should create build-changing interactions rather than merely duplicate Discipline Skills;
- can include movement-style behavior, reaction-like behavior, terrain interaction, setup/payoff, defense, utility, or attacks.

Not every item should grant an active skill.

A normal equipment item may instead grant stats, passive triggers, action modifiers, or no special effect.

To preserve interface readability, each equipped item may grant at most one ordinary active Equipment Skill unless an exceptional authored item is explicitly reviewed. Main Hand, Off Hand/shield, and Armor are the primary active-skill sources; accessories should default to passive/effect identity unless specifically approved.

---

## 10. Traits, Reactions, Movement Arts, and Ultimates Are Removed as Separate Systems

The following previous player-facing slot concepts are retired:

- Traits;
- Reactions;
- Movement Arts;
- Ultimates.

Their useful design space remains available through simpler systems:

- persistent/conditional passives from Resonance, Soulmarks, equipment, Mantles, or bounded prestige;
- triggered passive effects through the Effect Catalog;
- movement-capable Discipline/Equipment/Soulmark/Mantle Skills;
- powerful cooldown Skills rather than a separate Ultimate subsystem.

Reaction-like effects may still exist as automatic typed triggers, but there is no standalone Reaction slot players must manage.

This deliberately reduces build-system clutter.

---

## 11. Combo / Sequence Passives

Passives may reward using specific Skills, tags, or tactical actions in an authored order.

Examples:

```text
Skill with MARK tag
→ then eligible mobility Skill
→ then melee Skill
= bonus effect
```

or:

```text
Guard
→ take a hit from front arc
→ next shield Equipment Skill gains a bonus
```

or:

```text
Scorch target
→ displace target
→ storm Skill gains additional effect
```

Sequence effects can originate from:

- Resonance;
- Soulmark branch;
- equipment;
- Mantle state;
- bounded prestige/Veteran Edge.

Rules:

- sequences are typed and deterministic;
- the player can inspect the required sequence;
- forecasts/contextual UI surface an armed combo where practical;
- no secret keyboard-combo memorization requirement;
- loop guards prevent recursive trigger chains;
- failed/expired combo states are server-owned.

---

## 12. The Supernatural Fork

Soulmarks and Mantles are now **mutually exclusive character paths**.

A character eventually reaches a supernatural decision point with three conceptual states:

```text
UNAWAKENED
Has not yet made the permanent supernatural choice.
Cannot exploit this temporary state for Mantle access.

SOULMARKED
Accepted a Soulmark.
Can never become Soul-Severed or acquire/manifest a Mantle through ordinary rules.

SOUL-SEVERED
Underwent the Severance.
Can never acquire/equip a Soulmark.
May pursue Mantles.
```

### Terminology

Approved terminology:

- **The Severance** — the irreversible rite/decision;
- **Soul-Severed** — formal state/adjective;
- **the Severed** — natural shorthand for such characters.

The choice is explicit, heavily confirmed, server-authoritative, auditable, and not reversible through ordinary respec systems.

Simply not yet owning a Soulmark is not the same as being Soul-Severed.

The Soulmark/Mantle path remains with the character across Rekindling unless a future explicit story system says otherwise.

---

## 13. Soulmarks — Identity, Not a Fixed Template

Soulmarks represent persistent supernatural identity.

A Soulmarked character may have **one current Soulmark**.

Ordinary rules never allow simultaneous Soulmarks.

If a Soulmarked character later acquires and chooses to bind a different eligible Soulmark, the previous Soulmark is permanently lost from that character after a strong confirmation flow. This must not be an accidental one-click operation.

Soul-Severed characters can never bind a Soulmark.

### Acquisition

Potential gameplay acquisition sources include:

- the main-story supernatural awakening;
- authored world/story discoveries;
- event rewards;
- bosses/Expeditions/rites;
- other recurring gameplay routes.

The first story awakening may use an authored random roll from an eligible pool, but the result and consequences must be clearly presented before the permanent bind/Severance decision.

### Real-money rule

AUREVANE's existing anti-pay-to-win policy remains controlling.

Because Soulmarks have combat effects, **combat Soulmark ownership/power must not be sold as cash-only or premium-only power** under the current monetization philosophy.

Premium products may sell cosmetic Soulmark presentation variants, VFX, profile treatments, or other non-power expression. Selling gameplay-exclusive combat Soulmarks would require an explicit future Owner decision to overturn the anti-pay-to-win policy and is not approved by this addendum.

---

## 14. Soulmark Catalog Size

The architecture must support **100+ Soulmarks over the lifetime of the game** without schema redesign.

However, quality matters more than reaching a marketing number at launch.

Recommended content pacing:

- early playable proof: small representative set;
- first broad release: approximately 24–36 high-quality Soulmarks;
- mature live catalog: approximately 48–72;
- long-term live-service expansion: 100+ only when each new Soulmark adds real build identity.

Because branches multiply content substantially, 50 strong Soulmarks with meaningful branches can create more usable diversity than 120 shallow percentage variants.

---

## 15. Soulmark Branches

Soulmarks do **not** all have three branches.

Branch counts vary intentionally:

- some focused Soulmarks have **1 branch/path**;
- most have **2 branches**;
- rare/complex Soulmarks may have **3 branches**.

Branches represent specialization inside the same supernatural identity.

A branch must materially change how the Soulmark is built or used, not merely rename a percentage bonus.

Unless a specific Soulmark is explicitly designed otherwise, switching among legitimately unlocked branches outside combat is not an irreversible character choice. The irreversible choice is the Soulmark identity itself and any later permanent replacement of that Soulmark.

All branch configuration occurs from the Character Profile/build interface.

---

## 16. Soulmark Packages May Vary

Soulmarks/branches are **not forced into one passive + one active Skill**.

Valid packages include, for example:

```text
1 passive + 1 powerful Skill
2 passives + 0 Skills
0 passives + 2 Skills
1 strong passive + 0 Skills
0 passives + 1 exceptionally strong long-cooldown Skill
1 passive + 2 deliberately smaller Skills
```

The exact package must fit the Soulmark's internal balance budget.

This allows one branch to feel like a permanent mutation, another like a supernatural technique set, and another like a risk/reward curse.

### Extra Soulmark Skills

Any Soulmark Skill granted by the active branch sits outside the 6/8 Discipline Skill cap.

Powerful Soulmark Skills should generally have long cooldowns and clear audiovisual identity.

---

## 17. Soulmark Strengths, Weaknesses, and Power Budget

Soulmarks use an internal **Soulmark Power Budget** rather than being balanced solely by counting passives and Skills.

Balance dimensions include:

- always-on passive impact;
- active Skill impact;
- Skill cooldown;
- Action Economy cost;
- targeting/range/area;
- conditionality/setup;
- reliability;
- flexibility across encounters;
- stat scaling;
- positive modifiers;
- genuine drawbacks/weaknesses.

Illustrative patterns:

```text
+10% Fire effectiveness
```

or:

```text
+5% Fire
+5% Wind
```

or a genuine risk/reward identity:

```text
stronger Fire benefit
+
a real relevant defensive/resource weakness
```

or non-damage identity:

```text
improved Jump/vertical access
```

or:

```text
movement/displacement rules altered
```

### Drawback credit rule

A weakness may justify a stronger positive benefit, but only if the weakness is **genuinely relevant to the build**.

Do not grant a huge Fire bonus in exchange for a penalty the intended Fire build can trivially ignore.

Drawback-to-power conversion is capped and reviewed. Soulmarks must not become optimization puzzles where players select a fake weakness for free upside.

---

## 18. Soulmarks Versus Resonance Versus Essence

These systems must remain distinct.

### Resonance

- requires Primary + Secondary;
- passive;
- expresses interaction between two learned Disciplines;
- has no independent supernatural identity.

### Essence (working name)

- requires Primary only / no Secondary;
- active special Skill outside the 8 Discipline slots;
- expresses the pure identity of one Discipline;
- balanced through damage-versus-effect tradeoff.

### Soulmark

- requires the character to be Soulmarked rather than Soul-Severed;
- persistent supernatural identity;
- branch-defined package of passives and/or Skills;
- may modify tags/combos but is not created by Discipline pairing;
- one current Soulmark only.

Do not author them as reskins of one another.

---

## 19. The Severed and Mantles

The Severance is the permanent alternative to Soulmarks.

Soul-Severed characters:

- can never acquire or equip a Soulmark;
- become eligible to pursue Mantles;
- do not gain a generic always-on `Severed damage bonus` merely for rejecting Soulmarks;
- receive their supernatural payoff through Mantle access itself.

This replaces the earlier concept of Soulmarks and Mantles coexisting on the same character.

---

## 20. Mantles — Six Transformation Paths

AUREVANE's mature target is **six distinct Mantles**.

Mantles are temporary, manually manifested combat transformations available only to Soul-Severed characters who have legitimately earned the relevant Mantle.

This addendum replaces the old assumption that Mantles must use a universal Rank I/II/III ladder. The six-Mantle model should be kept simpler unless later playtesting proves ranks are genuinely needed.

### Mantle identity

A Mantle should:

- create a major temporary power/stat/rule shift;
- scale meaningfully from the character's fundamental attributes/derived stats rather than granting disconnected fixed power;
- last only a small number of the character's turns/activations;
- create a meaningful timing decision;
- visibly transform the character/state;
- potentially grant temporary Mantle Skills outside the 6/8 Discipline cap;
- end in **Afterstrain** or another clearly readable vulnerability period;
- never become a permanent always-on stat upgrade.

### Afterstrain

Afterstrain is the price of the burst window.

Valid Afterstrain patterns may include bounded temporary reductions to:

- Armor/Ward;
- Movement/Jump;
- Accuracy/Evasion;
- resource recovery;
- Action Economy efficiency;
- specific resistance or combat properties;
- other Mantle-specific vulnerabilities.

The weakness must matter, but it must not make using the Mantle feel like self-sabotage.

### Soulmark versus Mantle balance

Soulmarks should generally provide **consistent supernatural identity throughout the battle**.

Mantles should provide **higher temporary peak expression followed by vulnerability**.

Neither path should be universally stronger.

---

## 21. Character Profile Is the Build Headquarters

All persistent player build configuration is centered on the **Character Profile**.

The profile is not merely a biography page; it is the character's build headquarters.

Recommended routed/subsection structure:

```text
CHARACTER PROFILE
├ Overview
├ Attributes
├ Disciplines
│  ├ Primary
│  ├ Secondary
│  ├ Mastery
│  ├ 4-hour timers
│  ├ Discipline Skills
│  ├ Resonance / Essence
├ Supernatural
│  ├ Unawakened / Soulmarked / Soul-Severed state
│  ├ Soulmark + branch OR Mantle
│  ├ Severance history/confirmation where relevant
├ Equipment
│  ├ gear
│  ├ equipment-granted Skills
│  ├ stat/effect preview
├ Loadouts
│  ├ saved configurations
│  ├ legality
│  ├ cooldown lock warnings
└ Prestige
   ├ Rekindling
   ├ Renown
   ├ Hall of Selves
   └ Veteran Edge
```

All writes are server-authoritative.

The battle screen shows the currently committed combat build; it is not the place to redesign persistent character configuration.

---

## 22. Saved Loadouts

Saved loadouts are convenience, not an attunement-cooldown bypass.

A saved loadout may store:

- Primary/Secondary selection;
- Discipline Skill selection;
- Resonance/Essence result;
- Soulmark branch or equipped Mantle where legal;
- equipment;
- other approved build components.

Activating a saved loadout must validate every component at activation time.

If it would change a locked Primary/Secondary slot, activation is blocked or offered as a partial/preview-only operation; it never bypasses the remaining 4-hour timer.

---

## 23. Prestige / Rekindling Integration

Rekindling remains AUREVANE's long-horizon prestige system and must not become infinite raw stat inflation.

The supernatural identity choice persists:

- a Soulmarked character remains Soulmarked across Rekindling;
- a Soul-Severed character remains Soul-Severed across Rekindling;
- Rekindling does not erase the Severance merely to create another optimization cycle.

### Recommended prestige benefits

Prestige should mainly reward **history, flexibility, options, and identity**.

Approved/strong candidate benefit families:

1. **Hall of Selves / Chronicle prestige** — prior-cycle build snapshots, titles, frames, profile evolution, history.
2. **Memory Carryover** — a tightly bounded remembered Discipline/mastery advantage or unlock familiarity that reduces re-learning friction without bypassing new-cycle level/world gates.
3. **Veteran Edge** — one bounded active Edge slot or passive/technique choice in modes where allowed; additional Rekindlings unlock more choices, not more simultaneous Edge slots.
4. **Build convenience** — additional saved-loadout capacity, improved build comparison/history, veteran training utilities that do not grant battle power.
5. **Veteran-only cosmetic/challenge content** — rites, emotes, banners, profile treatments, NPC/world recognition.
6. **Mentorship/knowledge systems** — optional veteran social functions if later approved, without creating an economy exploit.

### Veteran Edge under the new build system

The old `Trait/Reaction` terminology must not return through Veteran Edge.

If an Edge grants an active combat Skill, that Skill is explicitly tagged **Veteran Edge**, sits outside the 6/8 Discipline cap, uses a cooldown, and standard competitive modes still allow only the single bounded Edge slot unless an explicit mode says otherwise.

Most Edge designs should prefer situational utility/information/once-per-battle tactical texture over raw percentage damage or permanent stats.

More Rekindlings should broaden available Edge choices rather than stack additional active Edge slots.

---

## 24. Master Panel Requirements

The mature Master Panel must support safe, versioned control over:

### Disciplines

- base stat profiles;
- mastery thresholds;
- the eight Skill definitions;
- Skill AE costs;
- Skill cooldowns;
- eligibility and unlock references;
- Primary/Secondary change cooldown defaults;
- disabled/emergency state.

### Resonance

- pair identity;
- passive trigger/conditions/effects;
- combo sequences;
- cooldown/once-per-X caps where used;
- PvE/PvP coefficients/overrides;
- version/publish/rollback.

### Essence

- per-Discipline pure-path Skill;
- damage/effect budget;
- AE cost;
- cooldown;
- tags/effects/visuals;
- PvE/PvP tuning.

### Soulmarks

- acquisition source/eligibility;
- branch count;
- branch package;
- passives;
- Skills;
- cooldowns;
- strengths/weaknesses;
- internal power-budget metadata;
- event availability;
- replacement/retirement behavior;
- PvP legality/coefficients;
- art/audio;
- analytics.

### Mantles

- one of six definitions;
- acquisition route;
- equipped eligibility;
- readiness;
- transformation duration;
- stat/effect scaling;
- temporary Skills;
- Afterstrain;
- PvE/PvP legality;
- emergency disable;
- art/audio;
- analytics.

### Prestige

- Memory Carryover rules;
- Veteran Edge definitions;
- mode legality;
- cooldowns/effects;
- Rekindling reward packages;
- Hall of Selves/profile presentation.

All editors use typed validated definitions, preview, versioning, audit, and rollback. No arbitrary live-code or SQL editing.

---

## 25. Balance / Complexity Guardrails

This redesign intentionally removes several old slot systems, but it can still become too complex if every source grants active buttons.

Therefore:

- Discipline Skills are capped at 8 pure / 6 mixed;
- Resonance is passive;
- Essence grants exactly one pure-path extra Skill;
- only the current Soulmark branch can grant Soulmark Skills;
- only one Soulmark can exist on the character at a time;
- Soulmark and Mantle are mutually exclusive paths;
- only one Mantle can be equipped/manifested at a time;
- Equipment Skills come only from bounded equipped sources;
- only one Veteran Edge slot exists in standard modes;
- all non-basic usable Skills have cooldowns;
- origin tags and UI grouping must make the action set understandable;
- no system may silently bypass battle legality, cooldown, Action Economy, or PvP normalization.

The desired outcome is high theorycraft depth with a battle interface players can still read.

---

## 26. Naming Still Open

The following naming decision remains open for final Owner approval:

### Pure-Discipline opposite of Resonance

Recommended current favorite:

- **Essence** / **Discipline Essence**

Other viable options:

- Trueform;
- Apex;
- Singularity;
- Devotion;
- Pureform;
- Discipline Focus.

The mechanic is locked even if the final branding changes.
