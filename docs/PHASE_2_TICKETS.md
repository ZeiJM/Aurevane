# AUREVANE — Phase 2 Tactical Combat Core Tickets

**Authority:** Derived from `docs/GAME_MASTER_PLAN.md`, `docs/ROADMAP.md`, `docs/COMBAT.md`, `docs/COMBAT_AI_TRAINING.md`, `docs/TECH_ARCHITECTURE.md`, and `docs/RESPONSIVE_EXPERIENCE_STANDARD.md`. If any conflict exists, the Master Game Plan wins.

## Purpose

Phase 2 proves the smallest complete version of AUREVANE's tactical combat grammar. It must establish reusable, server-authoritative combat foundations without prematurely implementing the Phase 3 Discipline framework, every targeting shape, a full Reaction system, complete combat-item/catalog tooling, PvP timing, or final content editors.

Only one implementation ticket is ACTIVE at a time.

The Phase 2 gate remains the roadmap gate: two controlled units can complete a deterministic, visually readable tactical battle in which movement, terrain/position, targeting, one Action, resources, effects, and genuinely different choices matter; the Turn Economy Tracker makes costs obvious; the first Recruit AI obeys the same legality; reconnect/replay-critical state is stable; and the vertical slice is fun enough to justify extending the grammar.

While the current free-plan Vercel Production deployment quota is constrained, a successful exact-head Vercel Preview is the external deployment gate by explicit owner decision on 2026-08-16. GitHub quality/database/browser gates remain mandatory where applicable.

---

## P2.1 — Deterministic Battle State + Turn Economy Foundation

### Goal

Create the pure server-compatible combat state machine and baseline turn economy before board/path/targeting complexity is added.

### Scope

Implement in `packages/game-core`:

- stable battle, combatant, team, round, turn and action identities;
- explicit combat rule/content version identifiers;
- deterministic battle RNG seed/state representation with no `Math.random()` authority;
- battle lifecycle states such as pending, active, completed and abandoned only as actually required;
- explicit round and turn counters;
- deterministic initiative ordering for the first vertical slice;
- current actor identity and turn ownership;
- baseline **Movement Budget + one Action** economy;
- action readiness/spent state;
- movement remaining/spent state;
- final-facing commitment slot without yet implementing board-facing legality;
- HP/MP state fields and temporary-resource extension boundary without inventing future Discipline resources;
- explicit turn lifecycle transitions: turn start → decision → commit/end turn → end-turn processing → schedule next actor;
- basic pure commands/results for start battle, spend movement budget, spend Action, choose final facing placeholder, and end turn where those operations can be expressed without board rules;
- stable combat-event identities sufficient to log lifecycle/economy transitions later;
- invariant validation for malformed states, duplicate combatant IDs, invalid initiative, defeated current actor, negative resources, over-spent movement, double-spent Action and impossible lifecycle transitions;
- deterministic snapshot serialization-friendly types with no browser or React dependencies.

### Explicitly deferred

Do not implement yet:

- grid/pathfinding;
- terrain/elevation/cover;
- target selection/shapes/LOS;
- damage/effects/status resolution beyond state-extension boundaries;
- Basic Attack targeting;
- persistence/database schema;
- HTTP routes;
- battle UI;
- AI;
- Discipline Arts, Reactions, Movement Arts, Confluences, Soulmarks or complete items.

### Verification

- identical initial inputs produce byte-stable equivalent battle snapshots;
- deterministic initiative order and next-actor scheduling;
- Movement Budget cannot go below zero or exceed refreshed allowance;
- Action can be spent only once per normal turn;
- split-movement state remains possible because spending the Action does not automatically erase remaining Movement Budget;
- turn-end processing refreshes the next actor correctly;
- defeated/ineligible actors are skipped deterministically once that state is representable;
- invalid battle/rule/content/RNG/lifecycle inputs fail closed;
- no wall-clock or client-derived state enters deterministic rules.

### Acceptance

A pure test can create two controlled combatants, start a deterministic battle, advance multiple turns/rounds through the baseline Movement + one Action economy, and prove invariant-safe replay from the same initial state and command sequence.

---

## P2.2 — Board, Movement, Terrain + Facing Legality

### Goal

Add the smallest reusable tactical board and movement grammar required for meaningful positioning.

### Scope

Implement:

- finite grid/board coordinates and bounds;
- tile identities and occupancy;
- first terrain definitions required by the vertical slice;
- traversal cost and blocked-tile representation;
- first movement profiles, beginning with ordinary ground and only additional profiles genuinely needed by the slice;
- deterministic orthogonal/approved path adjacency;
- authoritative path legality and movement-cost calculation;
- occupied-tile, blocked-tile and board-bound validation;
- basic elevation/height representation and the smallest height/jump legality needed by the slice;
- split movement before/after Action using P2.1 remaining Movement Budget;
- four-direction facing: North, East, South, West;
- deterministic front/side/rear relationship calculation;
- final-facing selection/validation at turn commitment;
- path/position/facing preview data that can later feed both player UI and AI without becoming authoritative client state;
- golden board states for movement, cost, occupancy, height and facing edge cases.

### Explicitly deferred

- flying/burrowing/teleport movement unless a released vertical-slice action requires it;
- advanced cover and projectile rules not used by released actions;
- terrain transformation/zones unless P2.3 introduces one meaningful utility effect that requires them;
- full map authoring/editor tooling;
- animation/path tweening.

### Verification

- cheapest/selected legal paths produce deterministic costs;
- illegal client-proposed paths are rejected even when the destination itself is reachable;
- movement cost cannot exceed remaining Movement Budget;
- occupied/blocked/out-of-bounds tiles fail closed;
- Action-spent actors can continue only legal remaining movement;
- front/side/rear classification is deterministic for every facing/relative-position combination;
- final facing cannot be omitted where the battle rule requires commitment.

### Acceptance

Two units can move on a small authored board, pay terrain costs, stop around obstacles/occupancy, split movement around the Action boundary, and end turns with unambiguous four-direction facing relationships.

---

## P2.3 — Targeting, Combat Actions + Effect Grammar

### Goal

Create the first shared typed action grammar so Basic Attacks and utility actions use the same target/cost/effect foundations future Arts/items/AI will reuse.

### Scope

Implement the minimum reusable grammar for the Phase 2 vertical slice:

- `CombatActionDefinition` identity/source/tags/version boundary;
- typed Target Spec foundation;
- initial target kinds: self, unit, ground tile and empty tile only where actually needed;
- initial shapes: Single, Circle and Line only where released actions need them;
- origin, minimum/maximum range, occupancy, ally/enemy, friendly-fire and basic height rules;
- deterministic line-of-sight/path blocking required by released ranged actions;
- use requirements and first cost grammar;
- Action cost consuming the P2.1 Action state;
- MP cost and bounded temporary-resource extension hook;
- effect sequence with explicit deterministic ordering;
- initial Effect Catalog primitives: damage, healing, resource change and at least one meaningful non-damage utility effect where the vertical slice benefits;
- HP defeat handling;
- first status representation with duration/stack timing only as required by Guard or the released utility effect;
- Basic Attack driven by an explicit weapon/unarmed attack profile rather than bespoke UI logic;
- Guard as a conservative authored action/effect;
- Wait/End Turn behavior;
- Interact only if the first test scenario genuinely needs a battle object;
- selected-action forecast/legality explanation model suitable for later UI;
- explicit rejection reasons for invalid target/range/LOS/resource/action-state requests.

### Explicitly deferred

- full Reaction framework;
- Phase 3 Arts/Traits/Movement Arts/Soulmarks/Confluences;
- every target kind/shape/filter;
- multi-stage portals/complex chains;
- giant element/resistance chart;
- unrestricted combat inventory;
- universal free Heal basic action;
- arbitrary script execution inside action definitions.

### Verification

- player and future AI callers receive identical legality for the same state/action/target;
- Basic Attack uses the shared target/effect grammar;
- Action and MP costs cannot be bypassed;
- damage/healing/resource bounds are deterministic and integer-safe;
- friendly-fire policy is explicit;
- effect sequence order is stable;
- Guard/first statuses expire at the authored lifecycle point;
- illegal range/LOS/occupancy/team targets return stable reasons;
- no client-submitted damage/outcome value is trusted.

### Acceptance

On a small P2.2 board, units can legally move, Basic Attack, Guard, Wait/End Turn and use at least one differentiated utility interaction through shared definitions, with deterministic forecasts and outcomes.

---

## P2.4 — Authoritative Battle Session + Persistence Boundary

### Goal

Make the pure combat engine a reconnect-safe server-authoritative battle service rather than a client-owned simulation.

### Scope

Implement:

- private battle-session persistence and versioned battle snapshots/event records;
- battle participants/ownership boundary appropriate to the first controlled PvE slice;
- server-side creation of the initial deterministic battle snapshot, rule/content versions and RNG seed/state;
- one authoritative intent command boundary using `expectedBattleVersion`;
- transactional state lock/update;
- stale-version rejection with authoritative refetch metadata;
- durable idempotent retry semantics for committed battle intents;
- request fingerprint conflict rejection;
- browser roles denied direct mutation of battle tables/RPCs;
- server/service repository boundary following existing AUREVANE patterns;
- structured append-only combat event log suitable for replay/debug/Battle Review later;
- safe state projection/read model that excludes private internals not needed by the player;
- reconnect-safe current snapshot loading;
- identifier-only invalidation/refetch events rather than broadcasting mutable battle outcomes as truth;
- server-only logs/errors without leaking secret state.

### Explicitly deferred

- PvP matchmaking/timers;
- co-op synchronization;
- full replay viewer;
- Master Panel combat editors;
- broad encounter catalog;
- remote/LLM decision logic.

### Verification

- browser cannot mutate battle state or execute privileged battle RPCs directly;
- same idempotency key + same fingerprint replays one committed result;
- same key + conflicting fingerprint fails;
- stale `expectedBattleVersion` cannot overwrite newer state;
- concurrent intents resolve to one authoritative sequence;
- event log and snapshot version advance atomically;
- reconnect returns the authoritative latest state;
- reconstructed event/snapshot sequence remains deterministic for tested cases.

### Acceptance

An authenticated player can resume a persisted battle and submit opaque movement/action/facing/end-turn intents; the server alone validates and commits outcomes, with stale/retry/concurrent requests unable to fork the battle state.

---

## P2.5 — Responsive Battle Experience + Turn Economy Tracker

### Goal

Deliver the first board-first player-facing combat experience on the authoritative P2.4 battle boundary.

### Scope

Implement:

- battle route/shell for the controlled Phase 2 encounter;
- readable board-first layout;
- current actor, HP/MP and concise visible state;
- initiative/turn-order presentation;
- path preview and legal/illegal movement explanation;
- target and shape preview for released actions;
- front/side/rear/facing preview and final-facing selection;
- selected-action forecast without implying guaranteed outcomes that rules do not guarantee;
- **Turn Economy Tracker** showing Movement remaining, Action ready/spent, MP, relevant temporary resource/cooldown/charges if present, and projected selected-action cost;
- touch-friendly selection/confirmation/cancel flow;
- keyboard focus and operability;
- phone width, laptop height and desktop-scale layouts;
- horizontal-overflow protection and safe transient overlays;
- reduced-motion treatment;
- combat scene/environment presentation foundation with requested-media fallbacks through the existing media pipeline;
- audio/VFX event hooks that remain gesture-gated and restore board readability quickly;
- clear stale-state/reconnect/recovery treatment that refetches authority rather than guessing locally.

### Explicitly deferred

- final art/VFX polish for unreleased content;
- giant hotbar;
- full Discipline loadout UI;
- PvP turn clocks;
- Battle Review UI;
- final map editor.

### Verification

- real responsive Chromium desktop/laptop/mobile journey;
- touch targets, keyboard focus and reduced-motion checks;
- no horizontal overflow;
- movement/action/facing controls reflect authoritative legality;
- stale state produces safe recovery/refetch;
- preview does not allow invalid client-side intent to masquerade as committed state;
- media/audio fallbacks remain graceful when assets are requested but unavailable.

### Acceptance

A player can complete the controlled normal battle loop from the browser with readable movement/target/facing previews and an always-understandable Turn Economy Tracker, while every committed result is server authoritative.

---

## P2.6 — Recruit AI + Tactical Hall Vertical Slice

### Goal

Prove the same combat rules support a fair deterministic computer opponent and a constrained practice loop once the normal battle loop is stable.

### Scope

Implement:

- server-authoritative AI decision interface consuming the same movement/target/action/effect legality as player commands;
- explicit AI knowledge filter so the decision model sees only permitted encounter information;
- first weak **Recruit** AI profile;
- deterministic seeded tie-breaking;
- bounded candidate-generation/evaluation budget;
- simple utility scoring for survival, legal damage/utility, positioning and scenario objective where present;
- safe fallback hierarchy ending in Guard/Wait/End Turn rather than illegal actions;
- structured AI decision-reason tags for debug/event logs;
- deterministic developer/QA practice harness;
- golden tactical regression states spanning movement, targeting, terrain, facing, Action/effect legality and AI choices;
- first player-facing Tactical Hall slice only after the normal battle loop is stable: Recruit Tactical Record, one training floor, constrained unlocked level/stat presets as supported, instant retry, and no normal repeatable progression rewards;
- clear separation between AI intelligence profile and raw combatant stats.

### Explicitly deferred

- remote generative AI/LLM calls in live combat;
- hidden-information cheating;
- stronger intelligence grades except where a tiny test stub is useful;
- boss knowledge/content spoilers;
- broad Tactical Record progression;
- full Battle Review;
- reinforcement-learning infrastructure;
- PvP bot substitution.

### Verification

- AI never selects an action the shared legality engine rejects;
- identical battle state/RNG/profile produces deterministic selected intent;
- knowledge filter blocks uncommitted player input/future RNG/private state;
- decision budget cannot run unbounded;
- fallback always yields a legal safe choice when any legal turn completion exists;
- Recruit behavior is deliberately beatable without illegal/stat-cheat advantages;
- Tactical Hall practice cannot grant normal repeatable XP/Mastery/loot/currency/PvP rating;
- representative browser journey remains responsive and reconnect safe.

### Acceptance

The Phase 2 vertical slice can be played against a fair Recruit opponent that uses the same combat grammar as the player, and the Tactical Hall can repeat that controlled encounter without becoming a progression farm.

---

## Phase 2 sequencing gate

The canonical sequence is:

```text
P2.1 deterministic state / turn economy
  ↓
P2.2 board / movement / terrain / facing
  ↓
P2.3 targeting / actions / effects
  ↓
P2.4 authoritative persisted battle session
  ↓
P2.5 player battle experience
  ↓
P2.6 Recruit AI / Tactical Hall vertical slice
```

Do not begin a later ticket merely because its types are easy to imagine. Each ticket may add only the extension points required to prevent obvious rewrites while leaving future gameplay unimplemented until its own scope is active.

## Cross-ticket invariants

Every Phase 2 ticket must preserve these rules:

- server owns authoritative combat outcomes;
- client sends intent, identifiers and expected version — not damage, movement cost, RNG results or final state;
- deterministic rules use explicit seed/state rather than browser randomness;
- baseline turn grammar remains Movement Budget + one Action;
- split movement remains legal where no authored rule disables it;
- targeting/effects are reusable typed grammar, not one-off ability functions;
- AI must reuse the same legality as players;
- browser roles cannot directly mutate privileged battle state;
- combat event ordering is deterministic and replay/debug friendly;
- mobile/touch/keyboard/laptop-height/desktop-scale behavior is a first-class acceptance requirement once UI exists;
- no Phase 3 Discipline system or later roadmap phase is smuggled into Phase 2 merely to make the first encounter look more content-rich.