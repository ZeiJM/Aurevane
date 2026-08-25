# AUREVANE — Permanent Codex Guidance

## 1. Project authority

- The project is **AUREVANE**, an original persistent browser-based multiplayer tactical fantasy RPG.
- `docs/GAME_MASTER_PLAN.md` is the highest product-design authority.
- `docs/ROADMAP.md` is the authoritative current phase sequence and must reflect repository truth, not obsolete historical sequencing.
- `TASKS.md` is the active implementation/validation ledger.
- `docs/PHASE_2_TICKETS.md` is historical.
- `docs/PHASE_3_TICKETS.md` is the exact next implementation sequence once Phase 2 is explicitly closed.
- `docs/GAME_MASTER_PLAN_BUILD_SYSTEM_ADDENDUM.md` governs Primary/Secondary Disciplines, Skills, Resonance, Essence, Soulmarks, Severance/Mantles and related build rules.
- `docs/ROADMAP_BUILD_SYSTEM_REWORK.md` is the current build-system sequencing companion.
- `docs/COMBAT.md` is current combat authority.
- `docs/ROADMAP_PRODUCT_VALIDATION.md` defines evidence gates.
- `docs/REKINDLING_FRONTIER.md` governs Rekindling replay differentiation and the Unwritten Reach.
- `docs/LORE_FRONTIER_CONTINUITY.md` is the authoritative lore bridge connecting the War of the Last Horizon, Closed Horizon/Great Vanes, Unwritten Reach, Veyr and Inward Drift.
- `docs/ANOMALIES.md` governs **Owner-granted exceptional Anomaly character states**.
- `docs/LORE_BIBLE.md` governs central narrative canon.
- `docs/PROGRESSION_RETENTION.md`, `docs/NATURAL_PACING.md`, and `docs/OFFLINE_PROGRESSION.md` govern long-horizon progression, pacing and Passive Training except where a newer approved specification deliberately adds detail.
- `docs/LIVING_WORLD_STORY.md` governs world/story operations.
- `docs/ITEMS_INVENTORY_LOADOUTS.md` governs items, equipment, inventory, consumables and loadouts.
- `docs/COMBAT_AI_TRAINING.md` governs combat AI and Battle Hall behavior.
- `docs/OWNER_OVERRIDE.md` and `docs/MASTER_PANEL.md` govern privileged operations.
- `docs/ENGINEERING_EXECUTION_STANDARD.md`, `docs/CONCURRENT_AGENT_WORKFLOW.md`, `docs/PRODUCT_EXPERIENCE_CONTENT_SYSTEM.md`, `docs/PLAYER_MANUAL.md`, `docs/MONETIZATION.md`, `docs/MEDIA_PIPELINE.md`, and `docs/TECHNOLOGY_POLICY.md` remain authoritative in their domains.
- Treat `docs/ART_BIBLE.md` and `docs/AUDIO_BIBLE.md` as authoritative when present.

When current documents conflict with clearly historical text, use the newer Owner-approved current authority and reconcile the stale document rather than restoring retired rules.

---

## 2. Current phase direction

Current state:

```text
Phase 0 — Engineering Foundation               substantially complete
Phase 1 — Character & Progression Foundation  substantially complete
Phase 2 — Tactical Combat & Battle Platform   implementation mature; Owner testing / PV-1 exit open
Phase 3 — Signature Buildcraft Foundation     next major phase after explicit Phase-2 closure
```

Phase 2 formally includes reusable tactical combat, Recruit AI/Battle Hall, direct PvP, multi-combatant battles, spectation, battle communication, battle logs and responsive battle presentation already delivered.

Later phases inherit compatible early-delivered systems and audit them instead of rebuilding them solely because older roadmaps scheduled them later.

### Owner Phase-3 transition rule

If the Owner clearly says wording equivalent to:

- “Phase 2 is done.”
- “We are done with Phase 2; start Phase 3.”
- “Proceed to Phase 3.”
- “Code Phase 3.”

then treat that as explicit authorization to close the current Phase-2 feature phase and begin the Phase-3 execution sequence.

Do not ask the Owner to repeat an unambiguous transition instruction because an older issue/document remains open.

Before Phase-3 runtime code:

1. inspect current `main`, recent commits, open implementation PRs/issues and `TASKS.md`;
2. reconcile the Phase-2/PV-1 boundary factually;
3. record actual evidence/Owner decision without fabricating tester counts or metrics;
4. preserve/reuse the battle/PvP/spectator platform;
5. activate `docs/PHASE_3_TICKETS.md`;
6. start at **P3.1**.

Phase-transition authorization does **not** authorize Vercel deployment.

---

## 3. Canonical terminology

Use current player-facing terms:

- **Primary Discipline**
- **Secondary Discipline**
- **Skill**
- **Resonance**
- **Essence / Discipline Essence**
- **Soulmark**
- **The Severance / Soul-Severed**
- **Mantle**
- **Battle Hall**
- **Passive Training**

Retired player-facing terminology includes Current Discipline, Legacy Discipline, Art as the generic ability term, Confluence, separate Trait/Reaction/Movement Art/Ultimate slots and Tactical Hall.

The mature **normal** build contract is:

```text
CHARACTER ATTRIBUTES
+
PRIMARY DISCIPLINE
+
OPTIONAL SECONDARY DISCIPLINE
+
DISCIPLINE SKILLS
+
RESONANCE OR PURE ESSENCE
+
SOULMARK OR SOUL-SEVERED / MANTLE
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
6 total Discipline Skills
+ Resonance passive
+ no Essence while Secondary is equipped
```

Do not reintroduce retired separate Trait/Reaction/Movement Art/Ultimate loadout systems under new names.

---

## 4. Anomaly — reserved canonical meaning

**Anomaly is not a frontier rarity or acquisition system.**

Per `docs/ANOMALIES.md`, an Anomaly is a protected **Owner-granted exceptional character state** that deliberately bypasses normal supernatural exclusivity.

Initial approved forms:

```text
Soulmark + Mantle
Two Soulmarks
Two Mantles
```

Rules:

- normal players cannot earn, find, craft, trade, buy, randomly roll, Rekindle into, or otherwise naturally acquire an Anomaly;
- the Unwritten Reach is not an Anomaly acquisition source;
- only the protected Owner may create/revoke an Anomaly by default;
- the operation must use Master Panel / Owner Override, server authority, atomic mutation, required reason, provenance and immutable audit;
- Owner override may bypass gameplay eligibility but never data integrity;
- standard ranked PvP excludes gameplay-affecting Anomalies by default;
- analytics/support must be able to identify exceptional state;
- future Anomaly types require explicit Owner approval.

Do not use capitalized **Anomaly** as a generic synonym for a world event, random phenomenon, frontier rarity, loot tier or unusual encounter.

---

## 5. Rekindling and frontier direction

`docs/REKINDLING_FRONTIER.md` is the current long-horizon gameplay authority. `docs/LORE_FRONTIER_CONTINUITY.md` defines the protected lore relationship behind the Reach, Veyr and Inward Drift.

### Rekindling

Rekindling is prestige, but later cycles must not be an identical replay.

Preserve concepts such as:

- Memory Carryover;
- Echo Routes;
- history-aware NPC/mentor interactions;
- alternate progression paths;
- abbreviated already-mastered tutorials;
- Hall of Selves;
- bounded Veteran Edge;
- later-cycle frontier questions.

Later cycles should be different and more self-directed, not merely faster.

### Unwritten Reach

Working frontier direction:

- common phrase: **Edge of the World**;
- canonical working term: **Unwritten Reach**;
- persistent authored Anchors;
- mutable deterministic Driftspace;
- server-seeded Cartographic Drift;
- Frontier Acumen based on demonstrated knowledge;
- deed-based legendary explorer identity;
- working far-inhabitant culture: Veyr;
- long-term continuity threat: Inward Drift.

Protected lore connection:

- the Reach is a surviving continuity wound connected to the War of the Last Horizon rather than an unrelated magical biome;
- the Closed Horizon stopped the Great Opening but did not perfectly heal every ancient continuity wound;
- the Great Vanes contribute to why the known world remains reliably coherent;
- the Veyr are continuity-adapted people shaped by the outer wounds and aftermath of the ancient war, with deliberately ambiguous mixed ancestry/history rather than one simplistic origin;
- the Inward Drift is the modern appearance of Reach-like continuity failures inside previously stable territory;
- **“the Edge is closing in”** is valid public-facing fear, while the precise metaphysical explanation remains spoiler-gated;
- do not reveal the complete Aurevane/Closed Horizon/Heart-Lock explanation early.

Near-infinite feeling does not require technically infinite content.

The frontier should never become a generic procedural filler map or mandatory daily universal-best-in-slot farm.

---

## 6. Universal attributes

The player-assigned attributes are:

- Might
- Finesse
- Vitality
- Agility
- Intellect
- Resolve

Primary Discipline contributes the active Discipline base-stat profile without rewriting assigned attributes. Secondary contributes no second base profile.

Do not restore the earlier four-attribute model.

---

## 7. Current combat authority

`docs/COMBAT.md` is definitive.

Current combat uses one shared **Action Economy**, displayed as AP, normally 100 AP at turn start.

Current implemented baseline costs:

```text
Inspect                         0 AP
Move, normal traversal point   25 AP
Move, terrain cost 2           50 AP
Basic Attack                   30 AP
Guard                          30 AP
Recover                        50 AP
Final Facing                    0 AP and ends turn
```

Multiple legal commands may occur while AP remains.

Never restore the retired Movement Budget + one Action model from historical Phase-2 tickets.

New Skills, items, Resonances, Essences, Soulmark/Mantle effects, scenario commands and future systems reuse the authoritative combat grammar unless a later Owner-approved revision changes it.

---

## 8. Phase 3 execution contract

Once Phase 3 is activated, follow `docs/PHASE_3_TICKETS.md` in order:

```text
P3.1 Discipline build authority + Primary profiles
P3.2 Secondary + independent attunement cooldowns
P3.3 Mature Skill schema + generic cooldown engine
P3.4 Profile Skill configuration + pure/mixed capacity
P3.5 Resonance framework + representative mixed build
P3.6 Essence framework + representative pure build
P3.7 Shared build snapshots across AI / PvP / saved loadouts
P3.8 Representative buildcraft slice + PV-2 readiness
```

Phase 3 implements first playable Resonance and Essence foundations. Phase 4 scales/balances the roster.

Soulmark/Severance/Mantle belongs later. Frontier implementation is not Phase-3 scope. Anomaly creation is not Phase-3 scope.

---

## 9. Non-negotiable engineering/product rules

- Never redesign/remove approved mechanics unless explicitly asked or a newer Owner-approved authority requires it.
- Preserve working functionality unless explicitly replacing it.
- Build one small coherent ticket at a time unless the active mandate authorizes a larger verified batch.
- Do not implement future roadmap systems merely because architecture anticipates them.
- Inspect existing code and applicable authoritative docs before meaningful implementation.
- When multiple coding chats/agents may be active, treat `main` as volatile and follow `docs/CONCURRENT_AGENT_WORKFLOW.md` before diagnosis, before editing, and again before finalizing.
- Prefer one independent `agent/<short-task-name>` branch per concurrent coding task unless the Owner explicitly requires direct work on `main`.
- Bug fixes require a focused regression guard when a practical automated test boundary exists; test both the behavior that must happen and the behavior that must not happen.
- All valuable/persistent game state is server-authoritative.
- The client submits intent; it does not determine combat, rewards, progression, inventory, PvP, Anomaly or Owner outcomes.
- Validate all external input server-side.
- Privileged actions require server authorization; hidden UI is not security.
- Use transactions for multi-step authoritative state changes.
- Rewards/fulfillment must be idempotent.
- Never expose service-role/database/payment secrets to browser code or `NEXT_PUBLIC_*` variables.
- Never import server-only authority into Client Components.
- Use migrations for schema changes.
- Prefer one authoritative source of truth for rules/configuration.
- Reuse existing services/schemas/components before creating parallel systems.
- Stable IDs/versioned definitions should connect gameplay, AI, Manual, Master Panel, media, analytics and support.
- Do not permit arbitrary JavaScript/SQL inside content editors.
- Optimize bottlenecks with evidence rather than speculative micro-optimization.
- Audio/visual presentation is first-class throughout development.
- Never fabricate human playtest evidence.

---

## 10. Required document reads by domain

Before meaningful work, read `docs/ENGINEERING_EXECUTION_STANDARD.md`, read `docs/CONCURRENT_AGENT_WORKFLOW.md` whenever concurrent work is possible, inspect existing code, and read applicable domain authority.

- **Current sequence/phase:** `docs/ROADMAP.md`, `TASKS.md`, current phase ticket file.
- **Buildcraft:** Master Plan + build addendum + build roadmap/tickets.
- **Combat:** `docs/COMBAT.md`.
- **Items/equipment/loadouts:** `docs/ITEMS_INVENTORY_LOADOUTS.md`.
- **Progression/Rekindling:** progression/pacing docs + `docs/REKINDLING_FRONTIER.md` where relevant.
- **Frontier:** `docs/REKINDLING_FRONTIER.md` + `docs/LORE_FRONTIER_CONTINUITY.md` + Lore Bible + Living World Story.
- **Anomaly:** `docs/ANOMALIES.md` + `docs/OWNER_OVERRIDE.md` + `docs/MASTER_PANEL.md` + PvP rules where relevant.
- **Combat AI/Battle Hall:** Combat + Combat AI Training.
- **Major player-facing pages:** Product Experience Content System.
- **Owner/player exceptional mutation:** Owner Override + Master Panel + Anomalies when applicable.
- **Narrative/world:** Lore Bible + `docs/LORE_FRONTIER_CONTINUITY.md` + Living World Story.
- **Premium commerce:** Monetization + security/operations docs.
- **Player-facing terminology/copy:** Player Manual and current public copy.

Never assume a package, table, route, system or feature exists. Verify it.

---

## 11. Narrative/spoiler safety

- Do not casually rewrite approved central lore.
- Do not leak late-story truth in early quests, UI, filenames, API payloads, logs, analytics exposed to clients, Manual copy or content IDs where avoidable.
- The relationship among Aurevane, the War of the Last Horizon, the Closed Horizon, Great Vanes, Reach, Veyr and Inward Drift must follow the spoiler ladder in `docs/LORE_FRONTIER_CONTINUITY.md`.
- Early public-facing frontier material may use fear/rumor such as **“the Edge is closing in”** without revealing why.
- Veyr characters must not function as omniscient Lore Bible exposition devices.
- Story/world events should be versioned/data-driven where practical.
- Important regions/settlements require authored identity.
- World events and frontier systems must remain coherent with Lore Bible progression.

---

## 12. Product experience

Every major player-facing page needs clear intent, primary action, authoritative data source, hierarchy, responsive behavior, accessibility, help/manual impact and media requirements.

A route is not complete merely because it renders.

Battle UI stays board-first and must keep AP, targeting, actor state, forecast, logs and contextual inspection readable.

Character Profile remains the build headquarters; battle screens consume committed snapshots rather than becoming respec editors.

---

## 13. Media and licensing

- Respect Art/Audio Bible when present.
- Missing required media should create structured ART/AUDIO requests rather than normalize placeholder quality.
- Never introduce unlicensed third-party assets/code/fonts.
- Reference games may inspire abstract design principles only; do not copy distinctive implementation/presentation/assets.

---

## 14. Owner-controlled deployment gate

- Vercel deployment is Owner-controlled and quota-sensitive.
- Never trigger Preview or Production deployment unless explicitly requested in the current conversation/work item.
- Implement/fix/continue/commit/push/merge does **not** imply deployment permission.
- Inspect `apps/web/vercel.json` before Git actions that could trigger Vercel.
- Prefer non-deploying branches/commits for normal development.
- Local/CI tests, typecheck, lint and builds should validate work without consuming deployment quota.
- A deployment request authorizes only that requested release/preview, not later unrelated deployments.

---

## 15. Documentation drift rule

When a newer Owner-approved design replaces an older term/mechanic:

1. update the Master Plan/addendum where appropriate;
2. update `docs/ROADMAP.md`;
3. update `AGENTS.md`;
4. update active domain specs;
5. update `TASKS.md` if execution direction changes;
6. update player-facing Manual/public copy when the change is live/current;
7. preserve historical snapshots only when clearly marked historical;
8. never allow stale subordinate documentation to silently restore superseded rules.

---

## 16. Concurrent-chat freshness and regression gate

When more than one coding chat/agent may be active, **current repository truth outranks chat memory, handoffs, screenshots, and earlier assumptions**.

Mandatory behavior:

1. refresh and inspect current `main` before diagnosis/editing;
2. use an isolated task branch by default;
3. trace the full authoritative execution path before fixing state/timer/realtime/persistence bugs;
4. add a focused regression guard when practical;
5. keep the code change surgical and preserve unrelated modes/behavior;
6. run targeted checks and the repository quality gate appropriate to scope;
7. refresh `main` again immediately before finalization;
8. if `main` advanced, inspect and reconcile overlapping changes before pushing/merging;
9. rerun verification after reconciliation/conflict resolution;
10. inspect the final diff for unrelated churn and report exactly what was verified.

For timer/state-machine defects, explicitly test the no-input/timeout path and terminal-state boundaries. A timeout must not imply victory, completion, reward, or successful action unless the authoritative rule explicitly requires it.

The detailed commands and workflow are authoritative in `docs/CONCURRENT_AGENT_WORKFLOW.md`.
