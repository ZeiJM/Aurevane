# AUREVANE — Permanent Codex Guidance

## Project authority and scope

- The project is **AUREVANE**, an original persistent browser-based multiplayer tactical fantasy RPG.
- `docs/GAME_MASTER_PLAN.md` is the authoritative master game-design document.
- `docs/ROADMAP.md` is the **single canonical implementation-sequencing roadmap**. It alone defines which phase a feature belongs to, what is currently active, what comes next, and the acceptance gates between phases.
- Existing `docs/ROADMAP_*.md` files are supporting implementation/history references only. They may contain useful detail, but they do **not** define independent phase ordering and never override `docs/ROADMAP.md`. When a roadmap decision changes, update `docs/ROADMAP.md` in the same change rather than creating another standalone roadmap as the sole phase authority.
- `docs/GAME_MASTER_PLAN_BUILD_SYSTEM_ADDENDUM.md` is the owner-approved authoritative build-system refinement. It controls Primary/Secondary Disciplines, Skills, Resonance, Essence, the supernatural fork, Soulmarks, Mantles, and related build rules where older documents conflict.
- `docs/GAME_MASTER_PLAN_FRONTIER_REKINDLING_PVP_ADDENDUM.md` is the owner-approved long-term refinement for Rekindling replayability, The Verge/The Uncharted frontier direction, the distant supernatural threat working concept, and the expanded PvP format framework.
- `docs/COMBAT.md` is the canonical combat source of truth. Its current PV-1F Action Economy revision supersedes the older Movement Budget + one Action model.
- `docs/LORE_BIBLE.md` governs central narrative canon. Do not casually alter or spoil it.
- `docs/PROGRESSION_RETENTION.md`, `docs/NATURAL_PACING.md`, and `docs/OFFLINE_PROGRESSION.md` govern long-horizon progression, pacing, Rekindling, retention and Passive Training, subject to newer owner-approved refinements.
- `docs/ITEMS_INVENTORY_LOADOUTS.md` governs items, inventory, Effect Catalog, equipment, consumables and saved loadouts.
- `docs/EQUIPMENT_LOAD_AND_BUILD_PHYSICS.md` governs Equipment Weight / Equipped Load / load-aware build physics when that system is active. Any stale four-attribute wording in older subordinate roadmap/reference material is superseded by the current six-attribute model.
- `docs/COMBAT_AI_TRAINING.md` governs combat NPC intelligence, fairness/knowledge boundaries, Tactical Records, Battle Review and Combat AI Lab. **Battle Hall** is the current player-facing practice destination.
- `docs/WORLD.md` governs living-world/event behavior; `docs/HOMESTEAD_WORLD_NAVIGATION.md` governs Homesteads, safe territory and navigation; `docs/PVP_SPECTATION_COLOSSEUM.md` governs spectation/Colosseum privacy and viewing rules; social/economy/referral documents remain authoritative in their respective domains.
- `docs/PRODUCT_EXPERIENCE_CONTENT_SYSTEM.md`, `docs/OWNER_OVERRIDE.md`, `docs/PLAYER_MANUAL.md`, `docs/MONETIZATION.md`, `docs/ENGINEERING_EXECUTION_STANDARD.md`, `docs/MEDIA_PIPELINE.md`, and `docs/TECHNOLOGY_POLICY.md` remain authoritative in their respective domains.
- Treat `docs/ART_BIBLE.md` and `docs/AUDIO_BIBLE.md` as authoritative when present.

## Canonical current terminology

Use these player-facing terms in new implementation and documentation:

- **Primary Discipline** — principal active combat tradition; defines the active Discipline base-stat profile.
- **Secondary Discipline** — optional mastered combat tradition mixed into the active build; supplies no second base-stat profile.
- **Skill** — player-facing umbrella term for usable combat abilities, with origin labels such as Discipline Skill, Equipment Skill, Soulmark Skill, Essence Skill, or other explicitly approved typed sources.
- **Resonance** — passive interaction created by an eligible Primary + Secondary pairing.
- **Essence / Discipline Essence** — pure-Discipline counterpart to Resonance; a Primary-only build may gain one special Essence Skill outside its normal Discipline Skill capacity.
- **Soulmark** — persistent supernatural identity on the Soulmarked path.
- **The Severance / Soul-Severed** — permanent alternative supernatural path.
- **Mantle** — temporary manifested transformation available to eligible Soul-Severed characters.
- **Battle Hall** — current player-facing practice-combat destination.
- **Passive Training** — current explicit server-timed background training system.
- **Veteran Edge** — bounded prestige option associated with Rekindling; do not turn it into uncapped stacked raw stats.

Retired player-facing terminology includes Current Discipline, Legacy Discipline, Art as the generic ability term, Confluence, separate Trait/Reaction/Movement Art/Ultimate slots, Tactical Hall, and obsolete Wayfarer's Practice behavior that conflicts with the current Passive Training implementation. These may remain only in clearly historical/reference snapshots, migration notes, old identifiers awaiting deliberate migration, or quoted legacy material.

The mature build contract is:

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
BOUNDED PRESTIGE / VETERAN EDGE
```

Pure build:

```text
Primary only
8 Discipline Skills
+ 1 Essence Skill
+ no Resonance
```

Mixed build:

```text
Primary + mastered Secondary
6 total Discipline Skills across the pair
+ Resonance passive
+ no pure-path Essence while Secondary is equipped
```

Do not reintroduce separate player-facing Trait, Reaction, Movement Art, or Ultimate loadout systems under different names.

## Current attribute model

The universal player-assigned attributes are:

- Might;
- Finesse;
- Vitality;
- Agility;
- Intellect;
- Resolve.

Do not restore the earlier four-attribute model. Primary Discipline contributes a base Discipline stat profile without rewriting the player's separately assigned attribute investment. Secondary Discipline does not contribute a second base profile.

## Current roadmap position

The active sequence is governed by `docs/ROADMAP.md`.

Current status:

```text
Phase 0 — Engineering Foundation              substantially complete
Phase 1 — Character & Progression Foundation  substantially complete
Phase 2 — Tactical Combat Core                 CURRENT ACTIVE FOCUS
Phase 3+                                       planned; do not implement early merely because known
```

The mature sequence is:

```text
FOUNDATION
→ CHARACTER
→ COMBAT
→ SIGNATURE BUILDCRAFT
→ CORE CONTENT
→ LIVING WORLD
→ CO-OP
→ EXPEDITIONS
→ PvP / COLOSSEUM
→ FULL DISCIPLINE DEPTH
→ SOCIAL WORLD
→ ECONOMY / PROFESSIONS
→ NATIONS / HOMESTEADS
→ COMPLETE OPERATIONS
→ PRODUCTION POLISH
→ HARDENING
→ UNCHARTED FRONTIER & CONTINUING LONG-TERM EXPANSION
```

Rekindling is a long-horizon loop that threads through the mature systems once enough real content exists to make another era worthwhile.

## Rekindling replayability direction

Rekindling must not become:

```text
reset level
→ repeat identical quests
→ repeat identical route
→ repeat identical six-month checklist
```

The same long-lived character begins another era while retaining identity/history.

Mature later cycles should support a controlled combination of:

- alternate progression routes;
- veteran-only quest variants;
- different regional emphasis;
- cycle-specific goals;
- alternate Expedition/boss qualification;
- different lore routes;
- optional exploration/PvP/co-op emphasis;
- safe compression/skipping of beginner instruction already proven mastered;
- prior-cycle NPC/story recognition;
- Hall of Selves history;
- optional server-authored Echo Encounters based on safe prior-cycle snapshots;
- later frontier objectives.

A future Cycle Focus or equivalent route-emphasis system may support archetypes such as Champion, Explorer, Delver, Scholar, Challenger or Steward. These are progression-route emphases, not permanent combat classes.

Rekindling preserves the Soulmarked versus Soul-Severed fork unless an explicit future story rule says otherwise.

## Long-term frontier direction

The canonical roadmap now includes a long-term **Phase 16 — The Uncharted Frontier & Continuing Threat**.

Working names:

- **The Verge** — stable authored boundary of mapped civilization;
- **The Uncharted** — separate shifting outer-world exploration layer beyond the Verge;
- **World's Edge** — acceptable colloquial in-world wording;
- **The Horizonless** — working name for a distant supernatural people/host first encountered through frontier signs/deep contact.

These names are not all final lore names. Do not treat the working names as irreversible canon without a dedicated naming/lore pass.

The approved system direction is:

- the stable known Atlas visibly ends;
- crossing the Verge deliberately transitions into a separate frontier layer;
- the Uncharted feels near-infinite through deterministic recombination of authored modules, not uncontrolled meaningless procedural generation;
- daily is the initial target for a shared world frontier shift;
- players on the same world/server share the same authoritative active frontier cycle;
- active sessions pin to their seed/version across rollover/reconnect;
- anchored authored landmarks coexist with drifting temporary locations;
- frontier lore extends existing Unchosen / Unmoored / Closed Horizon / Great Vane mythology;
- frontier experience/renown rewards exploration knowledge, identity, access and bounded sidegrade build options rather than mandatory raw-stat supremacy;
- ordinary players do not receive the exceptional GAME OWNER-only Anomaly Character bypass as a generic frontier reward;
- the distant supernatural threat does not replace Aurevane as the principal mythic antagonist.

Do not implement the mature frontier during Phase 2 merely because it is now planned.

## Expanded PvP format direction

AUREVANE's mature PvP model must not hardcode the idea that every battle has exactly two players or only 1v1/2v2 forever.

Planned format family:

```text
STANDARD COMPETITIVE BASELINE
1v1

TEAM FORMATS
2v2
3v3

FLEXIBLE CLASH
1–3 players vs 1–3 players
including intentionally uneven custom/event matches

MULTI-SIDED FORMAT
1v1v1
```

Rules:

- 1v1 remains the first/default persistent competitive reference;
- 2v2/3v3 permanent ranked queues open only when population supports healthy matchmaking;
- uneven 1v2/1v3/2v3 begins as direct/custom/social/event/exhibition content, not disguised fair ranked matchmaking;
- 1v1v1 begins as casual/custom/event until scoring/kingmaking/rating are validated;
- battle membership/targeting architecture should ultimately support team/faction identifiers rather than permanent `TEAM_A`/`TEAM_B` assumptions;
- do not widen current Phase-2 implementation only to prebuild every future PvP mode;
- the Colosseum/spectator system must later understand all released participant/team formats through the same viewing stack.

A healthy single queue is better than five empty queues.

## Non-negotiable design rules

- Never redesign, remove, simplify, or invent game mechanics unless explicitly asked or an already-approved authoritative document requires the migration.
- Preserve working functionality unless explicitly replacing it.
- Build one small coherent ticket at a time unless the active execution mandate explicitly authorizes a larger verified release workflow.
- Do not implement future roadmap systems merely because architecture anticipates them.
- Inspect `docs/ROADMAP.md`, existing code, and relevant authoritative domain docs before meaningful implementation work.
- Never rewrite approved central lore or expose late-story secrets without explicit Owner approval.
- Do not collapse the long progression journey, item system, AI system, player experience, Rekindling or frontier into generic shortcuts merely to reduce implementation work.
- Audio and visual presentation are first-class systems throughout development.

## Current combat authority

`docs/COMBAT.md` is definitive for the current combat baseline.

The current PV-1F model uses one shared **Action Economy**, displayed to players in **AP**, normally 100 AP at turn start. It supersedes the former Movement Budget + one Action validation model.

Current implemented PV-1F costs are:

```text
Inspect                         0 AP
Move, normal traversal point   25 AP
Move, terrain cost 2           50 AP
Basic Attack                   30 AP
Guard                          30 AP
Recover                        50 AP
Final Facing                    0 AP and ends the turn
```

These values are confirmed by the current server-authoritative PV-1F implementation and Battle Hall UI. Multiple legal commands may occur in one turn while AP remains. Do not restore the retired one-action-per-turn model or older draft movement costs.

New Skills, items, interactions, equipment effects, scenario commands, Resonances, supernatural effects, and future systems must integrate through the authoritative combat grammar and current Action Economy contract unless a later Owner-approved revision supersedes it.

Do not introduce a second generic Movement Budget, universal Stamina bar, or another combat economy without explicit Owner approval.

## Required document reads by domain

Before meaningful implementation work, read `docs/ROADMAP.md`, read `docs/ENGINEERING_EXECUTION_STANDARD.md`, inspect existing code, and read the applicable authoritative domain documents.

- **Implementation sequencing / what is current / what comes next:** `docs/ROADMAP.md`. Specialized `ROADMAP_*` files are supporting references only.
- **Buildcraft / Disciplines / Skills / Resonance / Essence / Soulmark / Mantle:** Master Plan + build-system addendum.
- **Combat / targeting / Action Economy / statuses / effects / movement / facing / battle scenes:** `docs/COMBAT.md`.
- **Items / equipment / inventory / consumables / loadouts / loot / crafting / marketplace:** `docs/ITEMS_INVENTORY_LOADOUTS.md` plus Equipment Load and Combat where relevant.
- **Progression / XP / Mastery / Passive Training / Horizons / Rekindling / Veteran Edge / Archive:** progression, natural-pacing and offline-progression docs plus the frontier/Rekindling/PvP addendum when later-cycle replayability is relevant.
- **Combat AI / bosses / allied NPCs / Battle Hall / Tactical Records:** Combat + Combat AI Training.
- **Living world / events / navigation / frontier compatibility:** World + Homestead/Navigation + Lore Bible; later Phase-16 work also reads the frontier/Rekindling/PvP addendum.
- **PvP / spectation / Colosseum:** Combat + canonical Roadmap + PvP Spectation/Colosseum + frontier/Rekindling/PvP addendum for expanded format direction.
- **Major player-facing pages:** Product Experience Content System.
- **Owner/player mutation tools / grants / exceptional state:** Owner Override + Master Panel.
- **Premium commerce:** Monetization + relevant security/operations docs.
- **Player-facing feature changes:** Player Manual and current public/manual copy.
- **Narrative/world/quest/event/supernatural content touching central mythology:** Lore Bible.

Never assume a package, table, route, system, or feature exists. Verify it.

## Server authority and security

- All valuable or persistent game state is server-authoritative.
- The browser may submit intent; it does not determine outcomes.
- Server owns combat legality, Action Economy, paths, targets, Skill legality, cooldowns, triggered effects, terrain transformations, timers, item ownership/equip state, loadout activation, consumptions/effects, AI actions, practice unlocks, rewards, XP, currency, progression, Passive Training timing/rewards, Primary/Secondary attunement cooldowns, PvP, trading, quests, Rekindling, Veteran Edge, lore discovery, permissions, Owner overrides, premium prices, payment completion and fulfillment.
- Future frontier seed/cycle/version, active frontier-session pinning, discovery/renown and valuable frontier rewards are server-authoritative.
- Validate all external input server-side.
- Privileged actions require server-side authorization; hidden UI is not security.
- Use transactions for multi-step authoritative state changes.
- Rewards and fulfillment must be idempotent.
- Never expose service-role/database/payment secrets to the browser or `NEXT_PUBLIC_*` variables.
- Never import server-only authoritative logic into Client Components.
- Owner power uses validated commands, permissions, provenance, audits and Break-Glass workflows.
- Premium fulfillment never trusts a browser redirect or client success flag as proof of payment.

## Architecture, cleanliness, and data

- Prefer modular feature-oriented architecture with clear UI/domain/database/validation/authorization boundaries.
- Implement the smallest coherent change that fully satisfies the ticket.
- Reuse existing services, schemas, validators, components and patterns before creating parallel replacements.
- Keep one authoritative source of truth for rules and live configuration; do not duplicate formulas, permissions, unlocks, balance values, Passive Training rules, Skill definitions, Resonance/Essence rules, AI profiles, item/effect definitions or Action Economy costs across layers.
- Important content types use stable IDs and typed relationships so gameplay, Master Panel, Manual/Codex, AI, media, acquisition, analytics and support reference the same identity.
- Item Definitions and owned Item Instances are distinct where needed.
- Discipline Skills, Basic Attack profiles, Equipment Skills, Soulmark/Essence Skills, combat items, scenario actions and AI legality should reuse the same typed targeting/requirement/effect grammar where practical.
- Do not permit arbitrary JavaScript or SQL in content editors.
- Use migrations for every database schema change.
- Avoid N+1 queries, unbounded reads, redundant round trips, duplicate subscriptions and unnecessary polling.
- Authoritative calculations stay server-side.
- Primary/Secondary cooldowns, progression curves, Passive Training, item/effect/loot/loadout definitions, combat content, AI profiles, acquisition/visibility metadata, Rekindling, Veteran Edge, events and other live-operated configuration should be data-driven/versioned where practical.
- Future frontier generation uses deterministic, versioned server-owned seeds and authored modules; do not use client-generated world truth.
- AI reuses authoritative legality/range/path/effect/terrain/item rules and has a bounded deterministic fallback.
- Saved loadout activation is one authoritative atomic command, validates the current build contract and respects Primary/Secondary attunement cooldowns.
- Passive Training uses server-owned timestamps and idempotent completion/claim behavior.
- Preserve provenance for valuable grants and exceptional support/Owner state.
- TypeScript remains the default application/game-service language and PostgreSQL/SQL the authoritative relational layer unless a documented architecture decision approves otherwise.
- Optimize bottlenecks with evidence; do not trade clarity for speculative micro-optimization.

## Narrative and live-world continuity

- Permanent character building and the living-world story reinforce each other.
- Do not leak late-story secrets in early quests, public UI, item descriptions, filenames, API payloads, logs, Manual articles, premium copy, Battle Hall catalogs, Codex catalogs, maps or event metadata.
- Story/world events should be data-driven and versioned where practical.
- World-state changes should visibly affect relevant presentation rather than merely add a badge.
- Important settlements/regions require authored identity; do not carbon-copy them.
- Battle scenes should derive coherently from world/encounter context.
- Quest/key items must preserve story integrity.
- Frontier foreshadowing may use unreliable maps, missing surveys, distant anomalies and rumors before the player legitimately knows the Unchosen/Closed Horizon explanation.
- The Horizonless working concept must not be reduced to a generic monster faction or automatically described publicly as Aurevane's army.

## Product experience and circular content integrity

- Every major player-facing page needs clear intent, primary action, authoritative data source, hierarchy, visual focus, feedback states, responsive behavior, accessibility, help/manual impact and media requirements.
- A page is not complete merely because its route renders or CRUD works.
- Battle UI is board-first and must keep targeting, Action Economy, actor state, forecast, timeline/log and contextual inspection readable.
- Character Profile is the persistent build headquarters; battle screens show the committed battle snapshot rather than becoming the respec editor.
- Public Manual/News/Rules copy must distinguish playable-now behavior from roadmap direction.
- Whenever player-facing terminology changes, update the Master Plan, canonical Roadmap, Manual/public copy, applicable domain docs and intentional tests/content fixtures.

## Media and licensing

- Respect the Art Bible and Audio Bible when present.
- If required media is missing, create a structured `ART_REQUEST` or `AUDIO_REQUEST` rather than normalizing placeholder quality.
- Never introduce unlicensed third-party art, audio, code, fonts or other assets.
- Reference games may inform abstract design principles only; do not copy their implementation, names, distinctive assets or protected presentation.

## Testing and release discipline

- Run relevant tests, typecheck, lint and build after implementation tickets where the environment allows.
- Significant combat behavior requires automated regression coverage.
- Database changes require migration and authority/RLS/security review.
- Multi-step economy/reward/loadout/training operations require idempotency/concurrency coverage where relevant.
- Deterministic systems preserve seed/version replay where designed.
- Manual verification steps must be explicit.
- **Do not fabricate human player-validation results.** Automated gates may be green, but a PV PASS requires the actual human playtest when the roadmap calls for one.
- Production deployment is not proof that a feature is fun, readable, balanced or player-validated.

## Documentation drift rule

When a newer Owner-approved design replaces an older term, mechanic or phase decision:

1. update the authoritative domain/design source;
2. update `docs/GAME_MASTER_PLAN.md` or its explicit owner-approved addendum when master design needs refinement;
3. update **`docs/ROADMAP.md` whenever implementation sequencing/scope changes**;
4. update this `AGENTS.md` guidance when future agents need the rule permanently;
5. update current player-facing Manual/public copy when players should know the change;
6. update active domain documents whose instructions would otherwise contradict the new design;
7. leave explicitly historical snapshots intact, but clearly treat them as historical/supporting rather than current phase authority;
8. verify current implementation constants/rules before copying numerical values into canonical docs;
9. do not allow a subordinate stale document or old `ROADMAP_*` integration note to silently restore superseded rules.

The goal is one coherent current design and **one canonical roadmap**, with history preserved only where it is intentionally history.
