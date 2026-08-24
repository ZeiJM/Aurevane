# AUREVANE — Permanent Codex Guidance

## Project authority and scope

- The project is **AUREVANE**, an original persistent browser-based multiplayer tactical fantasy RPG.
- `docs/GAME_MASTER_PLAN.md` is the authoritative master game-design document.
- `docs/ROADMAP.md` is the authoritative current phase sequence and must reflect repository truth rather than an obsolete historical plan.
- `docs/PHASE_3_TICKETS.md` is the exact next implementation specification once Phase 2 is explicitly closed by the Owner.
- `docs/PHASE_2_TICKETS.md` is a historical Phase-2 record and must never override current combat or phase direction.
- `docs/GAME_MASTER_PLAN_BUILD_SYSTEM_ADDENDUM.md` is the Owner-approved authoritative build-system refinement. It governs Primary/Secondary Disciplines, Skills, Resonance, Essence, the supernatural fork, Soulmarks, Mantles, and related build rules where older documents conflict.
- `docs/COMBAT.md` is the canonical combat source of truth. Its current PV-1F Action Economy revision supersedes the older Movement Budget + one Action model.
- `docs/ROADMAP_PRODUCT_VALIDATION.md` defines the current product-evidence gates.
- `docs/ROADMAP_BUILD_SYSTEM_REWORK.md` is the current sequencing companion for the build-system redesign and is subordinate to the current Roadmap and Master Plan.
- `docs/LORE_BIBLE.md` governs central narrative canon. Do not casually alter or spoil it.
- `docs/PROGRESSION_RETENTION.md`, `docs/NATURAL_PACING.md`, and `docs/OFFLINE_PROGRESSION.md` govern long-horizon progression, pacing, Rekindling, retention and Passive Training.
- `docs/ITEMS_INVENTORY_LOADOUTS.md` governs items, inventory, Effect Catalog, equipment, consumables and saved loadouts.
- `docs/COMBAT_AI_TRAINING.md` governs combat NPC intelligence, fairness/knowledge boundaries, Tactical Records, Battle Review and Combat AI Lab. **Battle Hall** is the current player-facing practice destination.
- `docs/PRODUCT_EXPERIENCE_CONTENT_SYSTEM.md`, `docs/OWNER_OVERRIDE.md`, `docs/PLAYER_MANUAL.md`, `docs/MONETIZATION.md`, `docs/ENGINEERING_EXECUTION_STANDARD.md`, `docs/MEDIA_PIPELINE.md`, and `docs/TECHNOLOGY_POLICY.md` remain authoritative in their respective domains.
- Treat `docs/ART_BIBLE.md` and `docs/AUDIO_BIBLE.md` as authoritative when present.

## Current phase direction

AUREVANE's current phase state is:

```text
Phase 0 — Engineering Foundation                    substantially complete
Phase 1 — Character & Progression Foundation       substantially complete
Phase 2 — Tactical Combat & Battle Platform        implementation mature; Owner testing / PV-1 exit open
Phase 3 — Signature Buildcraft Foundation          next major implementation phase after explicit Phase-2 closure
```

Phase 2 now formally includes the reusable tactical-combat, Battle Hall/AI, direct-PvP, multi-combatant, spectation, battle-communication, battle-log and responsive battle-platform foundations already delivered.

Later phases **inherit and audit** compatible early-delivered work rather than rebuilding it merely because an older roadmap scheduled it later.

Mature ranked matchmaking, ratings, seasons, tournaments, competitive population systems and Colosseum/public spectator discovery remain later competitive work even though direct PvP/spectation foundations already exist.

### Owner phase-transition rule

If the Owner explicitly says wording equivalent to:

- “Phase 2 is done.”
- “We are done with Phase 2; start Phase 3.”
- “Proceed to Phase 3.”
- “Code Phase 3.”

then treat that as explicit Owner authorization to close the current Phase-2 feature phase and begin the Phase-3 execution sequence.

Do **not** ask the Owner to repeat an unambiguous transition instruction merely because an older issue/document still describes Phase 2 as open.

Before Phase-3 runtime code:

1. inspect current `main`, recent commits, open implementation PRs/issues and `TASKS.md`;
2. reconcile the phase boundary factually;
3. record the actual Owner/PV-1 decision without fabricating tester counts, metrics or evidence;
4. preserve/reuse the existing battle/PvP/spectator platform;
5. activate `docs/PHASE_3_TICKETS.md` and start at **P3.1**;
6. continue one coherent ticket at a time unless the Owner explicitly authorizes a wider batch.

A request to start/code Phase 3 is **not deployment authorization**. Deployment remains separately Owner-controlled.

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

Retired player-facing terminology includes Current Discipline, Legacy Discipline, Art as the generic ability term, Confluence, separate Trait/Reaction/Movement Art/Ultimate slots, and Tactical Hall as the current practice destination. These may remain only in clearly historical/reference snapshots, migration notes, old identifiers awaiting deliberate migration, or quoted legacy material.

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

## Reserved terminology — Anomaly

When the Owner uses capitalized **Anomaly** in a rarity/acquisition context, interpret it as an **exceptionally rare, exceptional-provenance thing that is not normally or easily obtainable through ordinary legitimate gameplay acquisition paths**.

Do not casually use **Anomaly** as a generic synonym for an ordinary world event, rotating modifier, random encounter, routine phenomenon, common rarity tier, or scheduled live-ops variation. Prefer precise terms such as world event, rotation, modifier, encounter, phenomenon, or special condition unless a future approved domain specification deliberately defines another Anomaly system.

An Anomaly designation never legitimizes exploit-generated, duplicated, unauthorized-admin or otherwise invalid state. If an Anomaly can enter legitimate ownership, its provenance and authorization must still be server-authoritative and auditable.

## Current attribute model

The universal player-assigned attributes are:

- Might;
- Finesse;
- Vitality;
- Agility;
- Intellect;
- Resolve.

Do not restore the earlier four-attribute model. Primary Discipline contributes a base Discipline stat profile without rewriting the player's separately assigned attribute investment. Secondary Discipline does not contribute a second base profile.

## Non-negotiable design rules

- Never redesign, remove, simplify, or invent game mechanics unless explicitly asked or an already-approved authoritative document requires the migration.
- Preserve working functionality unless explicitly replacing it.
- Build one small coherent ticket at a time unless the active execution mandate explicitly authorizes a larger verified release workflow.
- Do not implement future roadmap systems merely because architecture anticipates them.
- Inspect existing code and relevant authoritative docs before meaningful changes.
- Never rewrite approved central lore or expose late-story secrets without explicit Owner approval.
- Do not collapse the long progression journey, item system, AI system, or player experience into generic shortcuts merely to reduce implementation work.
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

## Phase 3 execution contract

Once Phase 3 is activated, follow `docs/PHASE_3_TICKETS.md` in this order:

```text
P3.1  Discipline build authority + Primary profiles
  ↓
P3.2  Secondary Discipline + independent attunement cooldowns
  ↓
P3.3  Mature Skill schema + generic cooldown engine
  ↓
P3.4  Profile Skill configuration + pure/mixed capacity
  ↓
P3.5  Resonance framework + representative mixed build
  ↓
P3.6  Essence framework + representative pure build
  ↓
P3.7  Build snapshots across AI / PvP / saved loadouts
  ↓
P3.8  Representative buildcraft slice + PV-2 readiness
```

Phase 3 implements the first playable Resonance **and** Essence foundations. Phase 4 scales/balances the roster on top of them.

Soulmark/Severance/Mantle implementation remains a later world/supernatural phase and is not required to prove the Phase-3 core build thesis.

## Required document reads by domain

Before meaningful implementation work, read `docs/ENGINEERING_EXECUTION_STANDARD.md`, inspect existing code, and read the applicable authoritative domain documents.

- **Phase transition / current sequence:** `docs/ROADMAP.md`, `TASKS.md`, current `docs/PHASE_*_TICKETS.md`.
- **Buildcraft / Disciplines / Skills / Resonance / Essence / Soulmark / Mantle:** Master Plan + build-system addendum + current build-system roadmap/tickets.
- **Combat / targeting / Action Economy / statuses / effects / movement / facing / battle scenes:** `docs/COMBAT.md`.
- **Items / equipment / inventory / consumables / loadouts / loot / crafting / marketplace:** `docs/ITEMS_INVENTORY_LOADOUTS.md` plus Combat where relevant.
- **Progression / XP / Mastery / Passive Training / Horizons / Rekindling / Veteran Edge / Archive:** progression, natural-pacing and offline-progression docs.
- **Combat AI / bosses / allied NPCs / Battle Hall / Tactical Records:** Combat + Combat AI Training.
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
- Discipline Skills, Basic Attack profiles, Equipment Skills, Soulmark/Essence/Mantle Skills, combat items, scenario actions and AI legality should reuse the same typed targeting/requirement/effect grammar where practical.
- Do not permit arbitrary JavaScript or SQL in content editors.
- Use migrations for every database schema change.
- Avoid N+1 queries, unbounded reads, redundant round trips, duplicate subscriptions and unnecessary polling.
- Authoritative calculations stay server-side.
- Primary/Secondary cooldowns, progression curves, Passive Training, item/effect/loot/loadout definitions, combat content, AI profiles, acquisition/visibility metadata, Rekindling, Veteran Edge, events and other live-operated configuration should be data-driven/versioned where practical.
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

## Product experience and circular content integrity

- Every major player-facing page needs clear intent, primary action, authoritative data source, hierarchy, visual focus, feedback states, responsive behavior, accessibility, help/manual impact and media requirements.
- A page is not complete merely because its route renders or CRUD works.
- Battle UI is board-first and must keep targeting, Action Economy, actor state, forecast, timeline/log and contextual inspection readable.
- Character Profile is the persistent build headquarters; battle screens show the committed battle snapshot rather than becoming the respec editor.
- Public Manual/News/Rules copy must distinguish playable-now behavior from roadmap direction.
- Whenever player-facing terminology changes, update the Master Plan, Roadmap, Manual/public copy, applicable domain docs and intentional tests/content fixtures.

## Media and licensing

- Respect the Art Bible and Audio Bible when present.
- If required media is missing, create a structured `ART_REQUEST` or `AUDIO_REQUEST` rather than normalizing placeholder quality.
- Never introduce unlicensed third-party art, audio, code, fonts or other assets.
- Reference games may inform abstract design principles only; do not copy their implementation, names, distinctive assets or protected presentation.

## Owner-controlled deployment gate

- **Vercel deployments are Owner-controlled and quota-sensitive. Never trigger a Vercel Preview or Production deployment unless the Owner explicitly requests a deployment in the current conversation/ticket.**
- Requests such as **implement**, **fix**, **execute**, **continue**, **commit**, **push code**, **open a PR**, **merge**, **start Phase 3**, or **code Phase 3** do **not** imply permission to deploy.
- By default, make and push development commits only to branches that do not trigger Vercel. **Do not push implementation commits to a deployment-enabled `preview/*` branch unless the Owner has explicitly asked for a deployment.** If the current working branch is deployment-enabled and no deployment has been requested, move subsequent work to a non-deploying branch before pushing.
- Batch related fixes and UI changes in code without deploying them. When the Owner later asks to deploy, deploy the accumulated verified batch together where practical rather than creating a deployment per fix.
- Before any Git action that could trigger Vercel, inspect the repository's current deployment policy (currently `apps/web/vercel.json`) and choose a non-deploying path unless explicit deployment authorization exists.
- Local builds, typechecks, tests, lint, CI, code review, commits, and merges should be used to validate work without consuming Vercel deployment quota whenever possible.
- An explicit deployment request authorizes only the deployment work needed for that requested release/preview. It does not grant standing permission to deploy later unrelated follow-up fixes.
- Never enable `main` production deployment merely to test a fix. Production remains a deliberate Owner-requested release action.

## Testing and release discipline

- Run relevant tests, typecheck, lint and build after implementation tickets where the environment allows.
- Significant combat behavior requires automated regression coverage.
- Database changes require migration and authority/RLS/security review.
- Multi-step economy/reward/loadout/training operations require idempotency/concurrency coverage where relevant.
- Deterministic systems preserve seed/version replay where designed.
- Manual verification steps must be explicit.
- **Do not fabricate human player-validation results.** Automated gates may be green, but a PV PASS requires actual human evidence when the roadmap calls for it or an explicit factual Owner phase-transition decision recorded without invented metrics.
- Production deployment is not proof that a feature is fun, readable, balanced or player-validated.

## Documentation drift rule

When a newer Owner-approved design replaces an older term, mechanic or phase sequence:

1. update the Master Plan where the top-level product contract changed;
2. update the implementation Roadmap;
3. update this `AGENTS.md` guidance;
4. update current `docs/PHASE_*_TICKETS.md` execution guidance;
5. update current player-facing Manual/public copy where relevant;
6. update active domain/validation documents whose instructions would otherwise contradict the new design;
7. leave explicitly historical snapshots intact only when clearly marked historical;
8. verify current implementation constants/rules before copying numerical values into canonical docs;
9. do not allow a subordinate stale document to silently restore superseded rules.

The goal is one coherent current design, with history preserved only where it is intentionally history.