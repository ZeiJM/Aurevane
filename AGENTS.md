# AUREVANE — Permanent Codex Guidance

## Project authority and scope

- The project is **AUREVANE**, an original persistent browser-based multiplayer tactical fantasy RPG.
- `docs/GAME_MASTER_PLAN.md` is the authoritative master game-design document.
- `docs/ROADMAP.md` is the authoritative current phase sequence and must reflect repository truth rather than historical sequencing.
- `TASKS.md` reports the active implementation/validation boundary.
- Current `docs/PHASE_*_TICKETS.md` files define exact phase execution. `docs/PHASE_2_TICKETS.md` is historical; `docs/PHASE_3_TICKETS.md` is the next implementation plan after Phase-2 closure.
- `docs/GAME_MASTER_PLAN_BUILD_SYSTEM_ADDENDUM.md` governs Primary/Secondary Disciplines, Skills, Resonance, Essence, Soulmarks, Severance/Mantles and related build rules.
- `docs/ROADMAP_BUILD_SYSTEM_REWORK.md` is the current build-sequencing companion.
- `docs/COMBAT.md` is canonical combat authority. Its current shared Action Economy supersedes Movement Budget + one Action.
- `docs/ROADMAP_PRODUCT_VALIDATION.md` defines product-evidence gates.
- `docs/REKINDLING_FRONTIER_ANOMALIES.md` is the binding long-horizon design extension for Rekindling replay differentiation, the Unwritten Reach, Frontier Acumen, Veyr/Inward Drift concepts and Anomalies.
- `docs/LORE_BIBLE.md` governs central narrative canon. Do not casually alter/spoil it.
- `docs/PROGRESSION_RETENTION.md`, `docs/NATURAL_PACING.md`, and `docs/OFFLINE_PROGRESSION.md` govern progression/pacing/Rekindling/Passive Training except where the newer frontier/Rekindling extension deliberately adds detail.
- `docs/LIVING_WORLD_STORY.md` governs living-world/story operations except where the newer frontier extension deliberately adds frontier-specific direction.
- `docs/ITEMS_INVENTORY_LOADOUTS.md` governs items/inventory/equipment/consumables/loadouts.
- `docs/COMBAT_AI_TRAINING.md` governs combat AI/fairness/Battle Hall/Tactical Records.
- `docs/PRODUCT_EXPERIENCE_CONTENT_SYSTEM.md`, `docs/OWNER_OVERRIDE.md`, `docs/PLAYER_MANUAL.md`, `docs/MONETIZATION.md`, `docs/ENGINEERING_EXECUTION_STANDARD.md`, `docs/MEDIA_PIPELINE.md`, and `docs/TECHNOLOGY_POLICY.md` remain authoritative in their domains.
- Treat `docs/ART_BIBLE.md` and `docs/AUDIO_BIBLE.md` as authoritative when present.

---

## Current phase direction

```text
Phase 0 — Engineering Foundation                    substantially complete
Phase 1 — Character & Progression Foundation       substantially complete
Phase 2 — Tactical Combat & Battle Platform        implementation mature; Owner testing / PV-1 exit open
Phase 3 — Signature Buildcraft Foundation          next major implementation phase after explicit Phase-2 closure
```

Phase 2 now formally includes reusable tactical combat, Battle Hall/AI, direct-PvP, multi-combatant, spectation, battle communication/log and responsive battle-platform foundations already delivered.

Later phases **inherit/audit** compatible early-delivered work rather than rebuilding it.

Mature ranked matchmaking, ratings, seasons, tournaments, competitive population systems and Colosseum/public spectator discovery remain later Phase-8 work.

### Owner Phase-3 transition rule

If the Owner clearly says wording equivalent to:

- “Phase 2 is done.”
- “We are done with Phase 2; start Phase 3.”
- “Proceed to Phase 3.”
- “Code Phase 3.”

then treat that as explicit Owner authorization to close the current Phase-2 feature phase and begin the Phase-3 execution sequence.

Do **not** ask the Owner to repeat an unambiguous instruction merely because an older issue/document still describes Phase 2 as open.

Before Phase-3 runtime code:

1. inspect current `main`, recent commits, open implementation PRs/issues and `TASKS.md`;
2. reconcile the phase boundary factually;
3. record the actual Owner/PV-1 decision without inventing missing tester counts/metrics;
4. preserve/reuse the battle/PvP/spectator platform;
5. activate `docs/PHASE_3_TICKETS.md` and start **P3.1**;
6. continue one coherent ticket at a time unless the Owner explicitly authorizes a wider batch.

Phase-transition authorization is **not** deployment authorization.

---

## Phase 3 execution contract

```text
P3.1 Discipline build authority + Primary profiles
  ↓
P3.2 Secondary Discipline + independent attunement cooldowns
  ↓
P3.3 Mature Skill schema + generic cooldown engine
  ↓
P3.4 Profile Skill configuration + pure/mixed capacity
  ↓
P3.5 Resonance framework + representative mixed build
  ↓
P3.6 Essence framework + representative pure build
  ↓
P3.7 Build snapshots across AI / PvP / saved loadouts
  ↓
P3.8 Representative buildcraft slice + PV-2 readiness
```

Phase 3 implements first playable Resonance **and** Essence foundations. Phase 4 scales/balances the roster.

Soulmark/Severance/Mantle and frontier implementation remain later world/supernatural phases.

---

## Canonical terminology

Use:

- **Primary Discipline** — principal active combat tradition; defines active Discipline base profile.
- **Secondary Discipline** — optional mastered combat tradition mixed into the build; no second base profile.
- **Skill** — usable combat ability umbrella term.
- **Resonance** — passive interaction from eligible Primary + Secondary pairing.
- **Essence / Discipline Essence** — pure-Discipline counterpart; one special Essence Skill outside normal Discipline capacity.
- **Soulmark** — persistent supernatural identity.
- **The Severance / Soul-Severed** — permanent alternative supernatural path.
- **Mantle** — temporary manifested transformation available to eligible Soul-Severed characters.
- **Battle Hall** — current practice-combat destination.
- **Passive Training** — explicit server-timed background progression.
- **Unwritten Reach** — canonical working name for the unstable frontier commonly called the Edge of the World.
- **Anchor** — persistent authored frontier discovery.
- **Driftspace** — mutable connective frontier geography.
- **Cartographic Drift** — deterministic server-seeded frontier re-resolution.
- **Frontier Acumen** — proven frontier knowledge/competency, not generic raw-power reputation.
- **Anomaly** — exceptional irregular-origin thing not normally/easily obtainable through sanctioned ordinary progression.

Retired current-facing terms include Current Discipline, Legacy Discipline, Art as the generic ability term, Confluence, separate Trait/Reaction/Movement Art/Ultimate slots and Tactical Hall.

### Mature build contract

```text
PLAYER-ASSIGNED ATTRIBUTES
+
PRIMARY DISCIPLINE BASE PROFILE
+
OPTIONAL MASTERED SECONDARY DISCIPLINE
+
DISCIPLINE SKILLS
+
PURE ESSENCE OR MIXED RESONANCE
+
SOULMARK OR SOUL-SEVERED MANTLE PATH
+
EQUIPMENT + EQUIPMENT SKILLS
+
BOUNDED PRESTIGE / VETERAN EDGE
```

Pure:

```text
Primary only
8 Discipline Skills
+ 1 Essence Skill
+ no Resonance
```

Mixed:

```text
Primary + mastered Secondary
6 total Discipline Skills across the pair
+ Resonance passive
+ no pure Essence while Secondary is equipped
```

Never reintroduce separate player-facing Trait/Reaction/Movement Art/Ultimate loadout systems under new names.

---

## Anomaly rules

When the Owner uses capitalized **Anomaly** in rarity/acquisition context, interpret it as an exceptionally rare, exceptional-provenance build/item/technique/discovery that is **not normally or easily obtainable through ordinary sanctioned gameplay paths**.

Possible Anomaly forms include:

- one Anomaly Skill/Technique;
- anomalous item/effect property;
- impossible learned memory;
- irregular traversal ability;
- forbidden/unsanctioned combat interaction;
- object/effect from an unrealized history;
- exceptionally rare alternate acquisition;
- only with separate Owner approval, a fully authored Anomalous Discipline.

Do not use **Anomaly** as a generic synonym for world event, modifier, routine phenomenon or normal rarity tier.

“In-world illegal/unsanctioned” acquisition may include forbidden rites, contraband research, hidden frontier markets, sealed sites or faction/Veyr dealings. It **never** legitimizes exploiting bugs, cheating, duplication, unauthorized admin state or real-money black markets.

Anomaly ownership/acquisition must remain server-authoritative, versioned, provenance-aware and auditable.

No cash-only Anomaly combat power. No ultra-rare Anomaly may be required for ordinary competitive viability. Competitive modes explicitly classify relevant Anomalies as allowed/normalized/disabled/event-only/tournament-restricted.

---

## Rekindling / frontier direction

Rekindling is AUREVANE's prestige system, but later cycles must **not** be identical level/quest repetition with a permanent XP multiplier.

Future Rekindling differentiation should use:

- Memory Carryover;
- Echo Routes influenced by prior-cycle history;
- history-aware NPC/mentor interactions;
- abbreviated mastered tutorials;
- alternate progression/Discipline routes;
- different build goals;
- live-world variation;
- Archive reinterpretation;
- Hall of Selves;
- frontier history/deeper Reach opportunities;
- bounded Veteran Edge choices.

The Unwritten Reach should feel near-infinite through **authored Anchors + deterministic Driftspace**, not technically unbounded random generation.

The Reach connects directly to the Unchosen/Unmoored/Closed Horizon/Great Vane mythology. Avoid generic endless-dungeon or purple-corruption presentation.

Working far-inhabitant concept **the Veyr** is non-monolithic and morally/culturally varied. Working looming-threat concept **the Inward Drift** describes Reach-like contradictions moving into previously stable territory rather than a simple invading army.

These working names may be refined during dedicated lore authoring, but their underlying design roles are approved unless the Owner changes them.

---

## Current attributes

Player-assigned attributes:

- Might;
- Finesse;
- Vitality;
- Agility;
- Intellect;
- Resolve.

Primary contributes a base Discipline profile without rewriting assigned investment. Secondary contributes no second base profile.

---

## Current combat authority

`docs/COMBAT.md` is definitive.

Current combat uses one shared **Action Economy**, normally 100 AP at turn start.

Current implemented baseline:

```text
Inspect                         0 AP
Move, normal traversal point   25 AP
Move, terrain cost 2           50 AP
Basic Attack                   30 AP
Guard                          30 AP
Recover                        50 AP
Final Facing                    0 AP and ends the turn
```

Multiple legal commands may occur while AP remains.

Never restore Movement Budget + one Action merely because it exists in historical tickets.

New Skills/items/Resonances/supernatural/Anomaly interactions reuse authoritative targeting/requirements/effects/AP/cooldown rules unless an explicitly approved exception is typed/versioned.

---

## Non-negotiable engineering/design rules

- Never redesign/remove approved mechanics unless explicitly asked or required by newer authority.
- Preserve working functionality unless replacing it deliberately.
- Build one small coherent ticket at a time unless explicitly authorized otherwise.
- Do not implement future systems merely because architecture anticipates them.
- Inspect existing code and applicable docs before meaningful changes.
- Never casually rewrite central lore/spoilers.
- Audio/visual presentation are first-class systems.
- All valuable/persistent state is server-authoritative.
- Browser submits intent; it does not determine outcomes.
- Validate all external input server-side.
- Use transactions for multi-step authoritative state changes.
- Rewards/fulfillment must be idempotent.
- Never expose service/database/payment secrets to browser or `NEXT_PUBLIC_*`.
- Never import server-only authority into Client Components.
- Use migrations for schema changes.
- Prefer existing services/schemas/components before parallel replacements.
- Stable content types use stable IDs/versioned relationships.
- Do not permit arbitrary JavaScript/SQL in content editors.
- Avoid N+1/unbounded reads/redundant polling/subscriptions.
- Saved loadouts use one atomic authoritative activation and cannot bypass attunement/mastery/item legality.
- AI reuses authoritative legality and has deterministic bounded fallback.
- Provenance matters for valuable/exceptional grants, especially Anomalies.

---

## Required document reads by domain

Before meaningful implementation, read `docs/ENGINEERING_EXECUTION_STANDARD.md`, inspect existing code, and read applicable authorities.

- **Phase transition/current sequence:** `docs/ROADMAP.md`, `TASKS.md`, current `docs/PHASE_*_TICKETS.md`.
- **Buildcraft:** Master Plan + build-system addendum + build roadmap/tickets.
- **Combat:** `docs/COMBAT.md`.
- **Items/equipment/loadouts/economy:** `docs/ITEMS_INVENTORY_LOADOUTS.md` plus Combat where relevant.
- **Progression/Rekindling:** progression/pacing/offline docs + `docs/REKINDLING_FRONTIER_ANOMALIES.md` when later-cycle/frontier behavior is involved.
- **Frontier/Anomalies:** `docs/REKINDLING_FRONTIER_ANOMALIES.md` + Lore Bible + Living World + applicable combat/economy docs.
- **AI/Battle Hall:** Combat + Combat AI Training.
- **Major player-facing pages:** Product Experience Content System.
- **Owner mutation/tools:** Owner Override + Master Panel.
- **Commerce:** Monetization + security/operations docs.
- **Narrative/world/events:** Lore Bible + Living World Story.

Never assume a package/table/route/system exists. Verify it.

---

## Product experience

- Major pages need clear intent, hierarchy, authoritative data, feedback, responsive behavior, accessibility, help/manual impact and media requirements.
- Battle UI is board-first.
- Character Profile is the persistent build headquarters; battle consumes committed snapshots.
- Public Manual/News/Rules must distinguish playable-now from roadmap direction.
- Player-facing terminology changes require documentation reconciliation.
- Frontier discovery should emphasize uncertainty without hiding actionable UI information required for fair decisions.

---

## Owner-controlled deployment gate

- **Never trigger Vercel Preview or Production unless the Owner explicitly requests deployment in the current conversation/ticket.**
- Implement/fix/continue/commit/push/open PR/merge do **not** imply deployment permission.
- Inspect `apps/web/vercel.json` before Git actions that could trigger deployment.
- Use non-deploying branches by default.
- Local checks/CI/commits/merges should validate work without consuming deployment quota where possible.
- Explicit deployment permission applies only to the requested release, not future unrelated work.

---

## Testing / validation discipline

- Run relevant tests/typecheck/lint/build where environment permits.
- Significant combat/build/frontier behavior requires regression coverage.
- Database changes require migration/RLS/security review.
- Multi-step valuable operations require idempotency/concurrency coverage.
- Deterministic systems preserve seed/version reproduction where designed.
- Manual verification steps must be explicit.
- Never fabricate human player-validation results.
- Production deployment is not proof of fun/readability/balance.
- Frontier generation must be deterministic/reproducible enough for QA/support and reject unreachable/invalid states.
- Anomaly acquisition must have duplication/provenance/competitive-legality tests before scale.

---

## Documentation drift rule

When a newer Owner-approved design replaces an older term/mechanic:

1. update the Master Plan or approved binding addendum as appropriate;
2. update `docs/ROADMAP.md`;
3. update this `AGENTS.md`;
4. update active validation/ticket/domain docs that would conflict;
5. update current player-facing Manual/public copy when relevant;
6. leave historical snapshots clearly historical;
7. verify current implementation constants before copying numeric values;
8. never allow stale subordinate text to silently restore superseded rules.

The target is **one coherent current design with history preserved in Git**.