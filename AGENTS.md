# AUREVANE — Permanent Codex Guidance

## Project authority and scope

- The project is **AUREVANE**, an original persistent browser-based multiplayer tactical fantasy RPG.
- `docs/GAME_MASTER_PLAN.md` is the authoritative master game-design document.
- `docs/GAME_MASTER_PLAN_BUILD_SYSTEM_ADDENDUM.md` is the owner-approved authoritative build-system refinement. It controls Primary/Secondary Disciplines, Skills, Resonance, Essence, the supernatural fork, Soulmarks, Mantles, and related build rules where older documents conflict.
- `docs/COMBAT.md` is the canonical combat source of truth. Its current PV-1F Action Economy revision supersedes the older Movement Budget + one Action model.
- `docs/LORE_BIBLE.md` governs Aurevane, the Binding, the long-form antagonist reveal, and central narrative canon. Do not casually alter or spoil it.
- `docs/PROGRESSION_RETENTION.md` governs the long-horizon first-character journey, Horizon pacing, urgency/FOMO design, Rekindling, Veteran Edge constraints, lore discovery/Archive systems, and related operations.
- `docs/NATURAL_PACING.md` refines the six-month journey through meaningful layered progression rather than crude visible day gates.
- `docs/OFFLINE_PROGRESSION.md` governs background/return progression. The current implemented player-facing model is **Passive Training**: explicit Short / Medium / Extended server-timed plans, no automatic idle accrual for new sessions, bounded completion rewards, and server-owned time. When older Wayfarer's Practice wording conflicts with the current implementation or Master Plan, the current Passive Training contract wins.
- `docs/ITEMS_INVENTORY_LOADOUTS.md` governs item definitions/instances, Effect Catalog, inventory categories, protected story items, equipment/consumables/materials, saved loadouts, acquisition, Item Studio, and item/effect operations. Build-field names inside that document must be interpreted through the current Primary/Secondary/Skill/Resonance/Essence model.
- `docs/COMBAT_AI_TRAINING.md` governs combat NPC intelligence, fairness/knowledge boundaries, reusable AI profiles, practice progression, Tactical Records, Battle Review, and Combat AI Lab. **Battle Hall** is the current player-facing practice destination; older Tactical Hall wording is retired unless explicitly historical.
- `docs/PRODUCT_EXPERIENCE_CONTENT_SYSTEM.md` governs thoughtful player-facing pages, circular content architecture, Atlas/region/settlement presentation, discovery-aware content, page-experience contracts, and the prohibition on unreviewed generic filler.
- `docs/OWNER_OVERRIDE.md` governs protected Owner bypass grants, exceptional state, special permissions, unearned grants, and Break-Glass operations.
- `docs/PLAYER_MANUAL.md` governs the comprehensive player manual, contextual help, glossary, protected operations manual, and documentation-update requirements.
- `docs/MONETIZATION.md` governs premium commerce and anti-pay-to-win rules.
- `docs/ENGINEERING_EXECUTION_STANDARD.md` governs implementation cleanliness and efficiency.
- `docs/MEDIA_PIPELINE.md` governs media/audio pipeline work.
- `docs/TECHNOLOGY_POLICY.md` governs production technology selection.
- Treat `docs/ART_BIBLE.md` and `docs/AUDIO_BIBLE.md` as authoritative when present.

## Canonical current terminology

Use these player-facing terms in new implementation and documentation:

- **Primary Discipline** — principal active combat tradition; defines the active Discipline base-stat profile.
- **Secondary Discipline** — optional mastered combat tradition mixed into the active build; supplies no second base-stat profile.
- **Skill** — player-facing umbrella term for usable combat abilities, with origin labels such as Discipline Skill, Equipment Skill, Soulmark Skill, Essence Skill, Mantle Skill, or Veteran Edge where applicable.
- **Resonance** — passive interaction created by an eligible Primary + Secondary pairing.
- **Essence / Discipline Essence** — pure-Discipline counterpart to Resonance; a Primary-only build may gain one special Essence Skill outside its normal Discipline Skill capacity.
- **Soulmark** — persistent supernatural identity on the Soulmarked path.
- **The Severance / Soul-Severed** — permanent alternative supernatural path.
- **Mantle** — temporary manifested transformation available to eligible Soul-Severed characters.
- **Battle Hall** — current player-facing practice-combat destination.
- **Passive Training** — current explicit server-timed background training system.

Retired player-facing terminology:

- Current Discipline;
- Legacy Discipline;
- Art as the generic ability term;
- Confluence;
- separate Trait slot;
- separate Reaction slot;
- separate Movement Art slot;
- separate Ultimate slot;
- Tactical Hall as the current player-facing destination.

These retired words may remain in explicitly historical/reference snapshots, migration notes, old database identifiers awaiting deliberate migration, or quoted legacy material. Do not use them as current design instructions.

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

Do not reintroduce separate player-facing Trait, Reaction, Movement Art, or Ultimate loadout systems through new code under different names.

## Current attribute model

The universal player-assigned attribute model is six attributes:

- Might;
- Finesse;
- Vitality;
- Agility;
- Intellect;
- Resolve.

Do not restore the earlier four-attribute model in new tickets. Primary Discipline contributes a base Discipline stat profile without silently rewriting the player's separately assigned attribute investment. Secondary Discipline does not contribute a second base profile.

## Non-negotiable design rules

- Never redesign, remove, simplify, or invent game mechanics unless explicitly asked or an already-approved authoritative document requires the migration.
- Preserve working functionality unless explicitly replacing it.
- Build one small coherent ticket at a time unless the active execution mandate explicitly authorizes a larger verified release workflow.
- Do not implement future roadmap systems merely because architecture anticipates them.
- For major architectural changes, inspect the repository and authoritative docs before changing code.
- Never rewrite approved central lore or expose late-story secrets without explicit Owner approval.
- Never collapse the six-month progression journey, natural Horizon progression, Rekindling, Veteran Edge constraints, lore discovery, or return-support systems into a short generic XP grind or timer farm.
- Never collapse the item system into stat sticks or one giant undifferentiated bag.
- Never collapse combat AI into random actions, hidden stat cheating, remote-LLM live decisions, or one identical script for all enemies.
- Never ship major player-facing content as generic generated filler. Reuse systems and authored kits, not identities.
- Audio and visual presentation are first-class systems throughout development, not a launch-week afterthought.

## Current combat authority

`docs/COMBAT.md` is definitive for the current combat baseline.

The current PV-1F model uses one shared **Action Economy (AE)** pool, normally 100 AE at turn start. It explicitly supersedes the former Movement Budget + one Action validation model.

Current validation costs are versioned balance:

```text
Inspect                         0 AE
Move, normal traversal unit    10 AE
Move, terrain cost 2           20 AE
Basic Attack                   30 AE
Guard                          30 AE
Recover                        50 AE
Final Facing                    0 AE and ends the turn
```

Multiple legal commands may occur in one turn while AE remains. Do not “correct” the game back to one action per turn based on older documents.

New Skills, items, interactions, equipment effects, scenario commands, Resonances, supernatural effects, and future systems must integrate through the authoritative combat grammar and current Action Economy contract unless a later Owner-approved combat revision supersedes it.

Do not introduce a second generic Movement Budget, universal Stamina bar, or another imported combat economy without explicit Owner approval.

## Required document reads by domain

Before meaningful implementation work, read `docs/ENGINEERING_EXECUTION_STANDARD.md`, inspect existing code, and read the applicable authoritative domain documents.

- **Buildcraft / Disciplines / Skills / Resonance / Essence / Soulmark / Mantle:** `docs/GAME_MASTER_PLAN.md` + `docs/GAME_MASTER_PLAN_BUILD_SYSTEM_ADDENDUM.md` + applicable Discipline/supernatural docs.
- **Combat / targeting / AE / statuses / effects / movement / facing / battle scenes / combat content:** `docs/COMBAT.md`.
- **Items / equipment / inventory / consumables / loadouts / loot / crafting / marketplace effects:** `docs/ITEMS_INVENTORY_LOADOUTS.md` + `docs/COMBAT.md` when combat interactions are involved.
- **Progression / XP / Mastery / Passive Training / retention / Horizons / Rekindling / Veteran Edge / Archive:** `docs/PROGRESSION_RETENTION.md`, `docs/NATURAL_PACING.md`, `docs/OFFLINE_PROGRESSION.md`.
- **Combat AI / bosses / allied NPCs / Battle Hall / Tactical Records / simulations:** `docs/COMBAT.md` + `docs/COMBAT_AI_TRAINING.md`.
- **Major player-facing pages / shell / Atlas / regions / settlements / Codex / content-editor workflows:** `docs/PRODUCT_EXPERIENCE_CONTENT_SYSTEM.md`.
- **Owner/player mutation tools / grants / entitlements / exceptional state / Break-Glass:** `docs/OWNER_OVERRIDE.md` + `docs/MASTER_PANEL.md`.
- **Premium commerce:** `docs/MONETIZATION.md` + relevant Master Panel/security docs.
- **Player-facing feature changes:** review `docs/PLAYER_MANUAL.md` and update public/manual copy where required.
- **Narrative/world/quest/NPC/event/supernatural/Expedition/nation/media touching central mythology:** `docs/LORE_BIBLE.md`.

Never assume a package, table, route, system, or feature exists. Verify it.

## Server authority and security

- All valuable or persistent game state is server-authoritative.
- The browser may submit intent; it does not determine outcomes.
- Server owns at minimum: combat legality, Action Economy, paths, target validity, Skill legality, cooldowns, passive/trigger resolution, terrain transformations, timers, item ownership/quantity/equip state, loadout activation, consumptions/effects, AI actions, practice unlocks, content access, rewards, XP, currency, progression, Passive Training elapsed time/rewards, Primary/Secondary attunement cooldowns, PvP, trading, quests, Rekindling, Veteran Edge, lore discovery, permissions, Owner overrides, premium prices, payment completion, and fulfillment.
- Validate all external input server-side.
- Privileged actions require server-side authorization; hidden UI is not security.
- Use transactions for multi-step authoritative state changes.
- Rewards and fulfillment must be idempotent.
- Never expose service-role credentials, database credentials, payment secrets, or privileged keys to the browser or `NEXT_PUBLIC_*` variables.
- Never import server-only database, authorization, payment, authoritative game logic, content publication, or AI decision logic into Client Components.
- Owner power uses explicit validated commands, permissions, provenance, audit records, and Break-Glass workflows—not raw browser-accessible credentials.
- Owner override may bypass normal eligibility only through supported exceptional-state rules; it may not corrupt hard persistence/runtime invariants.
- Premium fulfillment never trusts a browser redirect, client price, client reward payload, or client “success” flag as proof of payment.

## Architecture, cleanliness, and data

- Prefer modular feature-oriented architecture with clear UI/domain/database/validation/authorization boundaries.
- Implement the smallest coherent change that fully satisfies the ticket.
- Reuse existing services, schemas, validators, components, and patterns before creating parallel `V2`/`New`/`Better` implementations.
- Avoid giant files, but do not fragment code into abstractions that have no clear responsibility.
- Keep one authoritative source of truth for rules and live configuration. Do not duplicate formulas, permissions, unlocks, balance values, Passive Training rules, Skill definitions, Resonance/Essence rules, content visibility, AI profiles, item/effect definitions, action costs, or validation across layers.
- Important content types use stable IDs and typed relationships so gameplay, Master Panel, Manual/Codex, AI, media, acquisition, analytics, and support reference the same identity.
- Item Definitions and owned Item Instances are distinct where needed.
- Discipline Skills, Basic Attack profiles, Equipment Skills, Soulmark/Essence/Mantle Skills, combat items, scenario actions, AI legality, and future authored actions should reuse the same typed targeting/requirement/effect grammar where practical.
- The Effect Catalog uses typed primitives/triggers and controlled tags. Damage is one effect type, not an assumption.
- Do not permit arbitrary JavaScript or SQL in content editors.
- Use migrations for every database schema change.
- Keep database/network work bounded; avoid N+1 queries, unbounded reads, redundant round trips, duplicate subscriptions, and unnecessary polling.
- Keep client JS/state/hydration no larger than necessary. Authoritative calculations stay server-side.
- Primary/Secondary cooldowns, progression curves, Horizons, Passive Training, Rested Momentum, item/effect/loot/loadout definitions, combat content, AI profiles, terrain/movement profiles, acquisition/visibility metadata, Rekindling, Veteran Edge, event settings, lore content, premium products, and other live-operated configuration should be data-driven/versioned where practical.
- AI reuses authoritative legality/range/path/effect/terrain/item rules and has a bounded deterministic fallback.
- Saved loadout activation is one authoritative atomic command, validates the current build contract, respects Primary/Secondary attunement cooldowns, and uses pinned battle snapshots.
- Passive Training uses server-owned start/completion timestamps and idempotent completion/claim behavior. Do not infer rewards from logout, tab state, browser presence, or client clocks.
- Preserve provenance for valuable grants and exceptional support/Owner state.
- TypeScript remains the default application/game-service language and PostgreSQL/SQL the authoritative relational layer unless a documented architecture decision approves otherwise.
- Verify framework/runtime/compiler major upgrades against current authoritative documentation and handle them as focused migration work.
- Optimize bottlenecks with evidence; do not trade clarity for speculative micro-optimization.

## Narrative and live-world continuity

- Permanent character building and the living-world story reinforce each other.
- The central mystery unfolds through fair foreshadowing, conflicting perspectives, relationships, world events, and controlled story stages rather than an exposition dump.
- Lore is discoverable through documents, inscriptions, relics, environments, NPC testimony, Archive Fragment Sets, events, Expeditions, and contradictory sources.
- Do not leak late-story secrets in early quests, public UI, item descriptions, art filenames, API payloads, logs, Manual articles, premium copy, Battle Hall catalogs, Codex catalogs, maps, or event metadata.
- Story/world events should be data-driven and versioned where practical.
- World-state changes should visibly affect relevant NPCs, ambience, markers, routes, props, dialogue, weather, encounters, or other presentation—not merely add a badge.
- Important settlements/regions require authored spatial and cultural identity; do not carbon-copy them.
- Battle scenes should derive coherently from world/encounter context.
- Quest/key items must preserve story integrity and cannot be accidentally sold/salvaged/discarded under normal rules.
- Do not make every system secretly originate from Aurevane. The world must remain larger than the central antagonist.

## Product experience and circular content integrity

- Every major player-facing page needs clear player intent, primary action, authoritative data source, information hierarchy, visual focus, loading/error/feedback states, responsive behavior, accessibility, help/manual impact, and media requirements.
- A page is not complete merely because its route renders or CRUD works.
- The game shell keeps persistent character context concise and gives the primary experience the majority of useful visual space.
- Battle UI is board-first and must keep targeting, Action Economy, actor state, forecast, timeline, log, and contextual inspection readable without burying the board.
- Character Profile is the build headquarters for persistent configuration. Battle screens display committed battle state rather than becoming the persistent build editor.
- Public Manual/News/Rules copy must distinguish what is playable now from long-term roadmap direction.
- Whenever player-facing terminology changes, update the Master Plan, Roadmap, Manual/public copy, applicable domain docs, and tests/content fixtures that intentionally assert current labels.

## Media and licensing

- Respect the Art Bible and Audio Bible when present.
- If required media is missing, create a structured `ART_REQUEST` or `AUDIO_REQUEST` rather than silently normalizing placeholder quality.
- Never introduce unlicensed third-party art, audio, code, fonts, or other assets.
- Reference games may inform abstract design principles only; do not copy their implementation, names, distinctive assets, or protected presentation.

## Testing and release discipline

- Run the relevant tests, typecheck, lint, and build after implementation tickets where the environment allows.
- Significant combat behavior requires automated regression coverage.
- Database changes require migration and authority/RLS/security review.
- Multi-step economy/reward/loadout/training operations require idempotency/concurrency coverage where relevant.
- Deterministic systems must preserve seed/version replay where designed.
- Manual verification steps must be explicit.
- **Do not fabricate human player-validation results.** Automated gates may be green, but a PV PASS requires the actual human playtest when the roadmap calls for one.
- Production deployment is not proof that a feature is fun, readable, balanced, or player-validated.

## Documentation drift rule

When a newer Owner-approved design replaces an older term or mechanic:

1. update the Master Plan;
2. update the implementation Roadmap;
3. update this `AGENTS.md` guidance;
4. update current player-facing Manual/public copy;
5. update active domain documents whose instructions would otherwise contradict the new design;
6. leave explicitly historical snapshots intact, but clearly mark them historical;
7. do not allow a subordinate stale document to silently restore superseded rules.

The goal is one coherent current design, with history preserved only where it is intentionally history.