# AUREVANE — Product Strategy, Commercial Viability & Validation

**Status:** Authoritative product-strategy and commercial-validation specification subordinate only to `docs/GAME_MASTER_PLAN.md`. It complements `docs/ROADMAP.md`, `docs/ROADMAP_PRODUCT_VALIDATION.md`, `docs/PROGRESSION_RETENTION.md`, `docs/MONETIZATION.md`, `docs/PRODUCT_EXPERIENCE_CONTENT_SYSTEM.md`, `docs/AI_DEVELOPMENT_QUALITY_MANDATE.md`, and `docs/MEDIA_PIPELINE.md`.

**Direction approved:** 2026-08-16.

This document exists because a technically coherent game can still fail commercially. AUREVANE must prove that players understand it, enjoy it, return to it, can find other players, and are willing to support it **before** the project spends years completing the entire long-term specification.

The final product vision remains ambitious. The operating rule changes from:

> Build the complete specification, then discover whether the market wants it.

To:

> Preserve the complete vision, but earn the right to expand it through evidence.

---

## 1. Commercial North Star

AUREVANE should be positioned as:

> **A deep, beautiful tactical online RPG that happens to run in your browser, built around mastering Disciplines and combining them into surprising Confluences.**

The browser is an accessibility/distribution advantage, not the product identity by itself.

The product identity is:

- permanent character ownership;
- Current + mastered Legacy Discipline buildcraft;
- mechanically meaningful Confluences;
- tactical combat where positioning and timing matter;
- cooperative Expeditions;
- small-team competitive play;
- a persistent world with social memory;
- high-quality presentation without a large install barrier.

If an external player cannot explain what makes AUREVANE different after experiencing the signature loop, the project has not yet earned large-scale content expansion.

---

## 2. Ranked Weakness Register

### Critical — Signature hook can arrive too late

The Master Plan correctly makes Current + Legacy + Confluence the heart of AUREVANE, but permanent Legacy use requires a mastered Discipline. A new player therefore risks spending too long inside ordinary early-RPG progression before experiencing the mechanic used to market the game.

**Risk:** acquisition messaging promises buildcraft while the first sessions deliver character creation, basic leveling, and conventional combat.

**Patch:** introduce a controlled **Confluence Preview Trial** during early onboarding after the player understands baseline movement/action combat. The trial temporarily supplies a curated Legacy pairing and Confluence in a non-persistent training/story scenario. It does **not** grant permanent mastery, bypass progression, or unlock the real system early. It demonstrates the future fantasy so the player understands what they are working toward.

Target outcome: a new player should experience an authentic sample of the signature mechanic during the first meaningful play session or early onboarding arc, not after weeks of progression.

---

### Critical — Scope can consume the project before fun is proven

The full design includes 36 Disciplines, hundreds of Confluence relationships, Soulmarks, tactical combat, PvE, co-op, Expeditions, PvP, guilds, economy, nations, live events, deep operations tooling, art/audio production, and long-term progression.

This is a valid final vision but an unacceptable single commercial bet.

**Patch:** development is governed by **proof gates** in `docs/ROADMAP_PRODUCT_VALIDATION.md`. Large content expansion is blocked until the smaller preceding product thesis has been demonstrated with players.

Examples:

- do not build 16 Disciplines to discover whether combat is fun;
- do not build 36 Disciplines to discover whether Confluences are compelling;
- do not open many permanent PvP queues before concurrency supports them;
- do not build nation warfare before the social game proves it can sustain guild-scale participation;
- do not build an aggressive live-ops cadence before the operating model proves sustainable.

Failure of a proof gate means **iterate the weak layer**, not hide the weakness under more content.

---

### Critical — Confluence content has a combinatorial production burden

Every released pairing must remain mechanically meaningful. With 36 Disciplines, treating Current→Legacy and Legacy→Current as automatically separate bespoke content would create up to 1,260 directional pair records before optional Confluence Arts. Even 16 released Disciplines can imply 240 directional combinations.

That is expensive to author, balance, explain, test, animate, and maintain.

**Patch:** use a **canonical pairing model by default**.

- A base Confluence is authored against the unordered Discipline pair unless the mechanic genuinely needs a directional distinction.
- Current versus Legacy still matters because the active build, borrowed Arts, traits, and loadout differ.
- A directional override is allowed when the design produces meaningfully different gameplay and survives review.
- Shared tags/effect grammar create emergent interactions underneath the named Confluence instead of requiring bespoke engine code per pair.
- Every released pair still receives a meaningful Confluence; the patch reduces duplicated authoring, not player-facing combination depth.

This reduces the baseline full-roster pair set from 1,260 directional records to 630 canonical pairs before deliberate overrides. A 16-Discipline set has 120 canonical pairs.

The Confluence authoring workflow must report completeness, test coverage, effect reuse, missing media, and balance risk for the **released** roster rather than treating all 36 as a prerequisite for early testing.

---

### High — The 180-day journey can become artificial withholding

A long-lived character is a strength. A hard calendar wall placed in front of exciting gameplay is not.

Earlier planning language can be read as requiring approximately 180 days before a player reaches all meaningful endgame activity. That creates several risks:

- highly engaged players feel artificially stopped;
- real endgame is difficult to validate before launch;
- testers cannot exercise later systems naturally;
- the game can feel like a timer rather than a world;
- content is forced to fill calendar space instead of earning attention.

**Approved clarification:** the approximately 180-day production default applies to the **first complete character cycle / First Horizon / Rekindling eligibility**, not to blanket access to every endgame-grade activity.

Players may reach challenging Expeditions, high-level PvP, advanced buildcraft, endgame regions, bosses, and other serious content before day 180 when their level, skill, story progress, build, and relevant milestones qualify them.

The 180-day boundary protects the meaning of completing a full era of the character and entering Rekindling. It must not function as “come back in 73 days before you are allowed to play the interesting game.”

Horizon Gates may pace specific progression layers when justified, but every calendar gate must have a clear design reason and must be testable through accelerated non-production tooling.

---

### High — Closed Alpha is currently too close to a small finished MMO

The existing Closed Alpha target is already substantial: many Disciplines, Soulmarks, Confluences, regions, enemies, bosses, quests, Expeditions, PvP modes, social foundations, operations tooling, full audio, and strong presentation.

That is an excellent **mature alpha target**, but it is too expensive as the first external truth test.

**Patch:** add staged playable validation cohorts before the mature Closed Alpha:

1. **Combat Proof** — smallest polished tactical fight.
2. **AUREVANE Identity Proof** — small Discipline/Legacy/Confluence/Soulmark build set.
3. **Retention Loop Proof** — short progression/world loop that tests whether players choose to return.
4. **Co-op / Population Proof** — small party experience and matchmaking health.
5. **Mature Closed Alpha** — only after the preceding layers are working.

The project should regularly put a smaller, representative build in front of real humans rather than waiting for the full alpha checklist.

---

### High — PvP can fragment a niche population

AUREVANE eventually wants direct challenges, casual/ranked 1v1, casual/ranked 2v2, seasons, tournaments, and nation-scale conflict. A small community cannot support all of those queues simultaneously.

**Patch:** PvP modes are **population-gated**.

- Start with the smallest queue set that produces healthy match times.
- Use scheduled/rotating 2v2 or ranked windows when permanent concurrency is insufficient.
- Do not fill ranked competition with disguised bots.
- Direct challenges and unranked practice remain available where they do not fragment the public queue.
- Matchmaking telemetry must include queue time, abandon rate, rematch rate, skill spread, region/time-of-day concentration, and repeated-opponent frequency.
- Permanent queues are enabled because population data supports them, not because the final design document lists them.

A healthy single queue is better than five empty ones.

---

### High — Co-op can become a progression blocker when population is small

Three-player Expeditions are a product strength, but requiring a healthy group at every stage can strand players during low concurrency.

**Patch:**

- core character progression must retain meaningful solo play;
- required group content should arrive only when party-finding reliability is demonstrated;
- party finder and reconnect are not optional polish for co-op;
- low-stakes story/training content may use carefully scoped companion support if later testing proves necessary, but competitive leaderboards and true co-op prestige must remain human-authentic;
- if queue health is weak, use scheduled community windows, flexible difficulty, or alternate progression paths rather than making the player wait indefinitely.

The goal is to make friends increase the fun, not make lack of friends invalidate the account.

---

### High — Discoverability / go-to-market is under-specified

AUREVANE can be a good game and still be invisible.

**Patch:** audience-building starts before content completion.

The initial target audience is players who already enjoy one or more of:

- tactical RPGs;
- buildcraft/theorycrafting;
- class mixing;
- persistent browser RPGs;
- dungeon/raid teamwork;
- small-team competitive games;
- long-lived character identity.

Marketing should demonstrate the mechanic, not advertise generic fantasy lore.

High-value acquisition surfaces include:

- short clips/GIFs showing tactical consequences and Confluence interactions;
- shareable build cards when build systems exist;
- battle/replay highlights when technically justified;
- devlogs showing real game progress rather than concept promises;
- a lightweight waitlist/community funnel before broad alpha;
- creator-friendly preview access once the vertical slice is genuinely representative;
- community challenges/discoveries that naturally generate stories.

A later Steam/native-wrapper distribution experiment may be evaluated after the core loop proves itself. Browser-first development must not assume browser-only distribution forever, but the project must not add desktop packaging simply because Steam is large.

---

### High — Monetization implementation exists, but business economics need validation

`docs/MONETIZATION.md` provides a strong anti-pay-to-win commerce implementation direction. The remaining risk is assuming that a tasteful shop automatically produces a sustainable business.

**Patch:** monetization is treated as a hypothesis with measurable unit economics.

Track:

- active players and retained cohorts;
- payer conversion;
- average order value;
- repeat-payer rate;
- refund/dispute/chargeback rate;
- checkout abandonment/failure rate;
- net revenue after provider/platform/tax/refund effects where measurable;
- infrastructure cost per active player;
- content/live-ops cost per active player;
- contribution margin;
- acquisition source and acquisition cost when paid acquisition begins;
- lifetime value only after enough cohort history exists to estimate it honestly.

Initial commerce remains direct, understandable, cosmetic/supporter-oriented, and non-P2W.

Do not add a premium currency, subscription obligation, gacha, pay-to-skip progression, or aggressive sales pressure merely because conversion is weak. Weak conversion first triggers product/offer/audience diagnosis.

PayPal remains the initial provider implementation direction. A second provider is added only when real checkout coverage, conversion, regional access, or operational evidence justifies it. The internal provider boundary should make that possible without building multi-provider complexity prematurely.

---

### High — Infrastructure cost can quietly erase niche profitability

AUREVANE's multiplayer persistence, realtime features, media, analytics, matchmaking, and live operations can produce a cost structure that grows faster than revenue if left unmeasured.

**Patch:** operational economics are a product metric.

Track by environment and release stage where practical:

- database compute/storage;
- realtime messages/connections;
- server/function invocations and execution time;
- egress/bandwidth;
- asset/media delivery;
- logging/analytics volume;
- worker/queue cost;
- payment-provider cost;
- support/moderation workload;
- cost per DAU/MAU and per completed battle/Expedition where useful.

Before large public scale, establish cost alarms and kill/degrade paths for non-essential expensive features.

Do not optimize hypothetical scale too early, but do not discover unit economics only after a viral traffic spike.

---

### Medium-High — Browser performance and tactical UX can conflict

AUREVANE promises high-quality presentation and a tactically dense board inside a browser. Rich VFX, large media, realtime state, complex pathfinding, responsive layouts, and mobile support can collectively degrade input latency and readability.

**Patch:**

- define performance budgets for representative combat scenes;
- profile actual low/mid-range hardware, not only developer machines;
- preserve a dedicated mobile/narrow tactical layout rather than shrinking desktop UI;
- reduced effects and reduced motion must remain first-class;
- avoid making the server authoritative model feel sluggish through unnecessary network round trips for harmless previews;
- keep final outcomes authoritative while allowing deterministic client previews from approved rule data;
- lazy-load noncritical media and avoid expensive media blocking interaction;
- do not add visual spectacle that hides board state.

The mobile experience must be competent, but mobile parity must not force the tactical game to become shallow.

---

### Medium-High — Live-service operations can burn out a tiny team

AUREVANE's plan includes changing events, seasons, community discovery, balance, support, moderation, economy operations, and content publishing. A system that requires daily manual intervention is not sustainable for a lean project.

**Patch:**

- prefer schedulable, versioned content and recurring event templates;
- build kill switches and rollback before high-risk live systems;
- automate routine health checks;
- write operator runbooks as systems become live;
- batch content production instead of relying on emergency weekly creation;
- treat owner/staff time as a real operating cost;
- do not promise a content cadence until it has been sustained in test operations for multiple cycles.

The goal is a living world, not an owner trapped in a 24/7 control room.

---

### Medium — AI-assisted production can create quality/trust problems

The repository already has strong anti-slop and media provenance rules. The remaining commercial risk is inconsistency at scale.

**Patch:** preserve human review, content briefs, mechanical purpose, visual/audio provenance, and reusable content systems. Marketing should show finished representative work, not flood channels with generated concept volume.

AI reduces production cost; it does not lower the acceptance bar.

---

### Medium — User-uploaded images and social systems increase moderation/legal surface

Uploaded portraits, imported URLs, social messaging, guilds, user identity, and commerce create moderation, privacy, copyright, impersonation, and abuse concerns.

**Patch:** these features remain gated behind real moderation/reporting/storage policies. Uploaded media is never required for the core product. If moderation capacity is not ready, official/unlocked portraits ship first and user uploads remain disabled.

---

## 3. Core-Hook Time-to-Value Rule

The player must see progressively stronger evidence of AUREVANE's identity early.

Recommended sequence:

```text
FIRST MINUTES
Permanent character + clear Foundation Discipline fantasy
        ↓
FIRST COMBAT
Movement + one Action + obvious positional choice
        ↓
EARLY ONBOARDING
Terrain/status/reaction preview and meaningful tactical consequence
        ↓
CONFLUENCE PREVIEW TRIAL
Temporary curated Current + Legacy + Confluence demonstration
        ↓
NORMAL PROGRESSION
Earn real Mastery and permanent Legacy access
        ↓
REAL BUILDCRAFT
Player chooses their own pairing, Soulmark, equipment and tactics
```

The preview is a promise demonstrated through gameplay, not a shortcut.

Track time from account entry to:

- character created;
- first combat started/completed;
- first meaningful tactical choice;
- Confluence Preview experienced;
- permanent first Legacy unlocked;
- first self-selected Confluence used;
- first build change after observing combat results.

---

## 4. Confluence Production Rule

For planning and content budgeting:

```text
BASE CONFLUENCE KEY = canonical unordered Discipline pair
OPTIONAL DIRECTIONAL OVERRIDE = only when design requires it
OPTIONAL CONFLUENCE ART = iconic/high-value pairings
```

A released pair must still have at least one meaningful mechanical interaction.

A Confluence is rejected if it is effectively only a bland percentage bonus without changing decisions.

The authoring system should make it cheap to compose Confluences from tested targeting/condition/effect/status/tag primitives while allowing bespoke mechanics only when they create enough value to justify additional code/test burden.

Before adding another Discipline to a released roster, calculate the additional Confluence authoring/test/media burden it creates. Roster expansion is a product decision, not merely “one more class.”

---

## 5. Long-Horizon Progression Correction

The six-month concept is retained, with a clearer boundary:

### What the 180-day default protects

- completion of a full first character era;
- First Horizon recognition;
- Rekindling eligibility;
- long-term prestige and history;
- enough time for multiple build/world/social experiences to matter.

### What it must not blanket-lock

- fun tactical battles;
- meaningful advanced buildcraft;
- challenging Expeditions;
- serious PvP participation;
- important story/world arcs;
- guild/social participation;
- high-level equipment experimentation;
- other gameplay needed to prove that AUREVANE has a compelling endgame.

Non-production environments require accelerated clocks/configuration and direct test-state setup so QA does not wait months to validate long-horizon systems.

A basic pacing simulator/forecast should appear as soon as progression configuration becomes complex enough to make manual reasoning unreliable; do not wait until the complete Phase 13 Master Panel if earlier simulation would prevent a six-month balance mistake.

---

## 6. Product Analytics Principles

Telemetry exists to answer product questions, not collect data because dashboards look professional.

Every tracked event should answer at least one question such as:

- Where do new players leave?
- Do players understand combat?
- Do players willingly experiment with builds?
- Which content makes players return?
- Are parties forming successfully?
- Are PvP queues healthy?
- Are players finding acquisition goals?
- Are long sessions caused by fun or friction?
- Are monetization offers supporting the game without damaging trust?
- Is infrastructure cost scaling acceptably?

Prefer privacy-respecting pseudonymous/account-scoped operational IDs and avoid collecting unnecessary personal information.

Analytics schemas should be versioned enough that major event meaning does not silently change underneath historical reports.

---

## 7. Validation Cohort Strategy

Use progressively larger cohorts rather than one giant launch.

Indicative sequence:

```text
INTERNAL / OWNER QA
        ↓
5–15 trusted usability testers
        ↓
20–50 combat/build testers
        ↓
50–150 retention-loop testers
        ↓
200–500 social/economy/concurrency alpha
        ↓
larger invite alpha / beta
        ↓
public launch when the product and operations can survive it
```

These are planning ranges, not promises. Quality of evidence matters more than forcing an exact headcount.

Do not recruit a huge cohort into a build known to have a broken first-session experience merely to generate more data.

---

## 8. Decision Rules — What We Do When Data Is Bad

### Combat is not fun

Do not build more regions, guild systems, or 30 more Disciplines. Iterate combat readability, pace, tactical consequences, enemy design, input feel, and encounter structure.

If three substantial combat iteration cycles with representative testers still fail to create replay desire, treat that as a product-level warning requiring deliberate redesign discussion before expanding scope.

### Players do not understand the signature build loop

Do not solve it with a larger wiki. Improve onboarding, terminology, previews, defaults, comparison tools, and the actual mechanic if necessary.

### Retention is weak

Do not immediately add stronger FOMO, harsher timers, or paid progression. Diagnose first-session value, session goals, content variety, friction, social connection, progression clarity, and technical reliability.

### PvP queues are empty

Consolidate or schedule queues. Do not open more modes.

### Co-op matchmaking is unhealthy

Reduce progression dependency on unreliable matchmaking, improve party discovery, and use scheduled/community windows or flexible alternatives until population grows.

### Monetization conversion is weak

Check whether players love the game, whether the offers are desirable, whether checkout is accessible, and whether the audience can pay. Do not sell power to compensate.

### Infrastructure costs are too high

Profile and simplify the expensive path before scaling acquisition. Degrade optional realtime/media features before compromising authoritative correctness.

### Content cadence is exhausting operations

Reduce cadence and increase reusability/scheduling. Do not turn owner burnout into a product requirement.

---

## 9. Distribution Strategy

### Stage 1 — Browser-first direct product

Use instant access as a strength:

- click link;
- create/sign in;
- play;
- share builds/events with URLs where safe;
- test quickly without installer friction.

### Stage 2 — Audience-building before launch

Once representative gameplay exists:

- public-facing landing page;
- clear gameplay footage;
- waitlist/community signup;
- controlled invite waves;
- build/Confluence showcases;
- development updates tied to playable progress.

### Stage 3 — Additional distribution experiment

After strong hook/retention evidence, evaluate a desktop wrapper / Steam release or other channels if they materially improve:

- discovery;
- account acquisition;
- payment accessibility;
- social presence;
- user trust;
- retention.

Do not let desktop distribution fork authoritative game logic. Browser and any future packaged client remain clients of the same server-authoritative game.

---

## 10. Monetization Strategy Hypothesis

The initial business hypothesis is:

```text
FREE ACCESS TO THE CORE GAME
+
DESIRABLE COSMETIC / IDENTITY PRODUCTS
+
OPTIONAL SUPPORTER COLLECTIONS
+
NON-POWER ACCOUNT SERVICES
=
PLAYER-FRIENDLY RECURRING REVENUE
```

No initial subscription is required for access.

No premium currency is required.

No paid loot boxes/gacha.

No paid combat power.

No paid removal of deliberately manufactured inconvenience.

Before public commerce, test product desirability with non-paid cosmetic unlocks/previews and supporter-interest surveys rather than guessing catalog demand entirely from internal taste.

Pricing is versioned business configuration and should be tested gradually. The first catalog should be small enough that each product teaches us something.

---

## 11. Unit Economics Scorecard

The Owner's commercial dashboard should eventually be able to answer:

```text
NET REVENUE
- PAYMENT / PLATFORM COSTS
- REFUNDS / CHARGEBACKS
- INFRASTRUCTURE COST
- VARIABLE LIVE-OPS / SUPPORT COST
= CONTRIBUTION BEFORE FIXED DEVELOPMENT COST
```

Useful operating metrics include:

- DAU / WAU / MAU;
- new account → character creation completion;
- D1 / D7 / D30 return cohorts;
- sessions per active player;
- build experiments per active player;
- party formation and Expedition participation;
- PvP queue health;
- payer conversion;
- average order value;
- repeat payer rate;
- ARPDAU / ARPMAU when sample size is meaningful;
- infrastructure cost per DAU/MAU;
- support tickets per 1,000 active players;
- content production time per meaningful playable hour/update;
- acquisition cost by channel only when paid acquisition exists;
- LTV only when enough observed history makes the estimate credible.

Never optimize one metric in isolation. A higher conversion rate caused by damaging retention is not success.

---

## 12. Sustainable Live-Ops Rule

Before promising a public cadence, AUREVANE should demonstrate in test operations that it can run the cadence repeatedly.

A candidate cadence is acceptable when:

- content can be prepared ahead of time;
- events can be scheduled safely;
- a bad event can be disabled/rolled back;
- support burden is manageable;
- the cadence does not require daily code deployments;
- reused systems still produce meaningfully different experiences;
- media production can keep up without lowering quality;
- the owner can take days away without the game becoming unhealthy.

A smaller reliable cadence beats an impressive schedule that collapses after two months.

---

## 13. Feature Deferral / Parking Rule

The following remain part of the final vision but must not become excuses to delay validation of the core product:

- all 36 Disciplines;
- complete nation warfare;
- tournament ecosystem;
- every possible guild feature;
- full marketplace/crafting depth;
- complete Master Panel;
- premium virtual currency;
- multiple payment providers;
- user-uploaded portrait pipeline;
- maximal live-event cadence;
- every planned PvP queue permanently open;
- elaborate desktop packaging.

Each is implemented when its roadmap dependency and validation evidence justify it.

---

## 14. Definition of Commercially Healthy Direction

AUREVANE is moving in a commercially healthy direction when evidence increasingly supports all of the following:

- new players reach the distinctive fantasy quickly;
- tactical combat creates voluntary replay desire;
- players experiment with multiple builds without being forced;
- Current + Legacy + Confluence is remembered as an AUREVANE mechanic;
- players return for goals rather than punishment;
- co-op works without stranding solo/low-concurrency players;
- PvP queues are consolidated enough to feel alive;
- content expansion improves retention instead of merely increasing checklist size;
- the six-month journey feels like history accumulating rather than time being withheld;
- the game can be operated sustainably by a lean team;
- infrastructure cost remains compatible with niche economics;
- non-P2W offers can generate support from players who already value the game;
- audience growth becomes reproducible rather than dependent on one lucky viral moment.

The project does **not** need to prove that it will become a mass-market MMO.

It needs to prove, layer by layer, that it can become a loved, sustainable, profitable niche RPG — and then expand its ceiling from evidence.