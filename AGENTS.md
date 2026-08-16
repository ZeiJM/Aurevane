# AUREVANE — Permanent Codex Guidance

## Project authority and scope

- The project is **AUREVANE**, an original persistent browser-based multiplayer RPG.
- `docs/GAME_MASTER_PLAN.md` is the authoritative game-design document.
- `docs/LORE_BIBLE.md` is the authoritative lore expansion for Aurevane, the central goddess mystery, the Binding, the long-form antagonist reveal, and related narrative motifs. Do not casually alter or spoil its approved canon.
- `docs/PROGRESSION_RETENTION.md` is the authoritative feature expansion for the minimum six-month first-character journey, Horizon pacing, urgency/FOMO design, Rekindling prestige, Veteran Edge PvP constraints, lore discovery/Archive systems, and their Master Panel controls.
- `docs/NATURAL_PACING.md` is the authoritative refinement for achieving the six-month journey through meaningful layered progression rather than generic timers. Where earlier planning language could be interpreted as a crude visible day-gate, follow the natural-pacing standard instead.
- `docs/OFFLINE_PROGRESSION.md` is the authoritative specification for Wayfarer's Practice, Training Reports, offline XP/Mastery boundaries, Rested Momentum, absence protection, anti-abuse rules, and Master Panel controls. It is a secondary catch-up/return system and must never replace active progression or become a generic timer gate.
- `docs/COMBAT.md` is the authoritative combat-system expansion for turn economy, movement budget, targeting grammar, use requirements, effect/cost modeling, Reactions, weapon attack profiles, battle scenes, combat acquisition/Mastery rules, Combat Content Studio, balance telemetry, and phased combat implementation.
- `docs/ITEMS_INVENTORY_LOADOUTS.md` is the authoritative Master Plan expansion for item definitions/instances, reusable Effect Catalog, strategic non-damage items, inventory categories, protected key/story items, equipment/consumables/materials, three saved combat loadouts, Turn Economy Tracker integration, item acquisition, Item Studio, and item/effect balance operations.
- `docs/COMBAT_AI_TRAINING.md` is the authoritative specification for combat NPC intelligence, AI fairness/knowledge boundaries, reusable behavior profiles, Tactical Hall/Practice Arena, progression-gated Tactical Records, AI difficulty versus raw stats, Battle Review, and the protected Combat AI Lab.
- `docs/PRODUCT_EXPERIENCE_CONTENT_SYSTEM.md` is the authoritative specification for thoughtful player-facing pages, circular content architecture, World Atlas/region/settlement presentation, discovery-aware Codex content, terrain depth, page-experience contracts, content dependency/impact modeling, and the explicit prohibition on unreviewed generic “AI slop.”
- `docs/OWNER_OVERRIDE.md` is the authoritative Master Panel expansion for protected Owner bypass grants, exceptional/nonstandard player state, special permissions, unearned grants, and Break-Glass God Mode.
- `docs/PLAYER_MANUAL.md` is the authoritative specification for the comprehensive player manual, contextual help, glossary, protected Owner/Staff operations manual, and documentation-update requirements.
- `docs/MONETIZATION.md` is the authoritative premium-shop and real-money commerce specification. It governs the understated premium-store UX, USD pricing, anti-pay-to-win catalog rules, PayPal/payment architecture, purchase ledger, refunds/disputes, and Master Panel commerce controls.
- `docs/ENGINEERING_EXECUTION_STANDARD.md` is the authoritative cleanliness/efficiency refinement for all implementation work. Every coding ticket must favor the smallest clean solution that fully satisfies the requirement, avoids unnecessary complexity and waste, and leaves the repository easier to maintain.
- `docs/MEDIA_PIPELINE.md` is the authoritative media/audio pipeline document.
- `docs/TECHNOLOGY_POLICY.md` is authoritative engineering guidance for language/runtime/toolchain selection; use modern stable/LTS production technology rather than blindly chasing previews or legacy stacks.
- Treat `docs/ART_BIBLE.md` and `docs/AUDIO_BIBLE.md` as authoritative when they are added.
- Never redesign, remove, simplify, or invent game mechanics unless explicitly asked.
- Never rewrite major approved lore, Aurevane's identity/motivation, the reason for her imprisonment, or the central reveal without explicit owner approval.
- Never collapse the approved six-month progression journey, natural Horizon progression, Rekindling model, Veteran Edge constraints, lore-discovery loop, or Wayfarer's Practice absence-protection model into a short generic XP grind or generic timer farm without explicit owner approval.
- Never replace AUREVANE's approved baseline combat economy with a generic percentage Action Point system, universal Stamina bar, or another imported combat economy without explicit owner approval. Preserve the `Movement Budget + one Action + Reaction` baseline and the bounded action-economy manipulation defined in `docs/COMBAT.md`.
- Never collapse the item system into only stat sticks or one giant undifferentiated bag. Preserve the shared item/effect grammar, strategic non-damage effects, protected quest/key items, central Armory/build experience, and three saved-loadout baseline defined in `docs/ITEMS_INVENTORY_LOADOUTS.md`.
- Never collapse combat AI into random action selection, hidden stat cheating, remote-LLM calls, or one identical behavior script for every enemy. Preserve the fair, learnable, progression-gated Tactical Hall and reusable AI-profile architecture defined in `docs/COMBAT_AI_TRAINING.md`.
- Never ship a major page, settlement, region, enemy, item, Discipline, quest, content catalog, or other player-facing vertical as generic generated filler. Reuse systems and authored kits, not identities; require clear purpose, stable source-of-truth relationships, intentional presentation, and review as defined in `docs/PRODUCT_EXPERIENCE_CONTENT_SYSTEM.md`.
- Build one small ticket at a time. Implement only the requested ticket, do not implement future systems prematurely, and stop when that ticket is complete.
- Preserve working functionality unless explicitly replacing it.
- For major architectural changes, propose the plan before modifying code.
- Before every meaningful coding/implementation ticket, read `docs/ENGINEERING_EXECUTION_STANDARD.md` together with the applicable authoritative documents and inspect the existing code before proposing or writing changes.
- Before significant architecture or implementation work, read the relevant authoritative documents in `docs/` and inspect the existing code before proposing changes.
- Before implementing any battle rule, movement/path rule, action economy, Art/Reaction/Movement Art, target shape, use requirement, status, combat cost, weapon attack profile, initiative rule, battle scene/map, combat item, objective/scenario, PvP combat rule, combat content editor, or combat-balance tooling, read `docs/COMBAT.md` in addition to the Game Master Plan and applicable specifications.
- Before implementing item definitions/instances, equipment, inventory, consumables, materials, quest/key items, item effects/triggers, item targeting, combat-item kits, saved loadouts, Armory/build UI, loot/acquisition, crafting/marketplace item behavior, Item Studio, Effect Catalog, or item/effect analytics, read `docs/ITEMS_INVENTORY_LOADOUTS.md` together with `docs/COMBAT.md` when combat interactions are involved.
- Before implementing character progression, XP/Mastery pacing, retention, offline training/rested progression, events, seasons, prestige/Rekindling, PvP veteran rewards, Archive/lore discovery, player correction tools, or related Master Panel features, read `docs/PROGRESSION_RETENTION.md`, `docs/NATURAL_PACING.md`, and `docs/OFFLINE_PROGRESSION.md` in addition to the Game Master Plan.
- Before implementing tactical combat AI, NPC/enemy decision-making, boss behavior, allied NPC behavior, AI difficulty, Practice Arena/Tactical Hall, Tactical Records, AI-vs-AI simulation, or related Master Panel tooling, read both `docs/COMBAT.md` and `docs/COMBAT_AI_TRAINING.md` in addition to the Game Master Plan and applicable Discipline specifications.
- Before implementing a major player-facing page, game-shell surface, landing/signup experience, World Atlas, region map, settlement/local map, terrain rule, Codex/content catalog, content authoring/editor workflow, content dependency/impact tooling, or a vertical that connects gameplay to art/audio/manual/analytics, read `docs/PRODUCT_EXPERIENCE_CONTENT_SYSTEM.md` in addition to the relevant domain specifications.
- Before implementing Owner/player modification tools, special grants, staff powers, entitlements, exceptional character state, or Break-Glass actions, read `docs/OWNER_OVERRIDE.md` and `docs/MASTER_PANEL.md`.
- Before implementing premium products, real-money checkout, payment providers, purchase fulfillment, refunds, payment webhooks, commerce analytics, paid entitlements, or related Master Panel controls, read `docs/MONETIZATION.md` in addition to the Game Master Plan, Master Panel specification, and relevant security/architecture guidance.
- Before implementing any player-facing feature or materially changing an existing mechanic, review `docs/PLAYER_MANUAL.md` and include the documentation impact required by that specification.
- Before implementing narrative, world, quest, NPC, event, Soulmark, Confluence, region, Expedition, nation, or major media content that may touch the central mythology, read `docs/LORE_BIBLE.md` in addition to the Game Master Plan.
- Never assume a system, package, database table, route, or feature exists; verify it in the repository.

## Server authority and security

- All authoritative game state must be server-side. The browser may request actions, but it must never determine authoritative combat legality, path/movement cost, target validity, action costs, Reaction triggers, cooldowns, terrain transformations, timers, item ownership/quantity/equip state, loadout legality/activation, item consumption/effects, NPC/AI actions, practice-opponent unlocks/config legality, content-discovery/access state, rewards, XP, currency, progression, offline-training elapsed time/rewards, PvP, trading, quest outcomes, Rekindling state, Veteran Edge state, lore discovery, permissions, Owner overrides, premium prices, payment completion, purchase fulfillment, or other persistent state.
- Validate all external input server-side. Privileged operations require server-side authorization; hidden UI elements are never security controls.
- Use transactions for multi-step authoritative state changes.
- Never expose server secrets, service-role credentials, database credentials, payment-provider credentials, or privileged keys to client code or `NEXT_PUBLIC_*` environment variables.
- Never import server-only database, authorization, payment-provider, privileged game logic, authoritative content-publication logic, or authoritative combat-AI decision logic into Client Components.
- Owner power is implemented through explicit authoritative commands, permissions, validation, audit records, provenance metadata, and Break-Glass workflows where required—not by exposing raw production credentials to the browser.
- Owner override may deliberately bypass normal acquisition/eligibility rules, but it must not silently corrupt hard persistence/runtime invariants. If a desired state requires a supported exceptional-state representation, content rule, or isolated sandbox, implement that deliberately.
- Premium commerce must never trust a browser redirect, client-submitted price, client-selected reward payload, or client success flag as proof of payment. Fulfillment occurs only from a verified authoritative provider/payment state.

## Architecture, cleanliness, and data

- Prefer modular, feature-oriented architecture. Keep UI, domain/game logic, database access, validation, authorization, and payment-provider integration clearly separated.
- Implement the smallest coherent change that completely satisfies the current ticket. Do not turn a feature ticket into unrelated architecture churn, broad formatting changes, or speculative future scaffolding.
- Reuse or extend existing services, schemas, components, validators, and patterns when they already own the behavior. Do not create parallel `V2`, `New`, `Better`, or duplicate implementations because the repository was not inspected first.
- Avoid giant files and giant routers, but also avoid excessive fragmentation. A file/module should have a clear responsibility and every abstraction should earn its existence.
- Keep one authoritative source of truth for game rules and live configuration. Do not duplicate formulas, permissions, balance values, unlock requirements, validation, product prices, grant bundles, offline-training accrual rules, item definitions/effect rules/loadout requirements, combat-AI profile values, Tactical Record requirements, combat Target Specs, action costs, use requirements, effect definitions, terrain rules, acquisition rules, content visibility rules, or authoritative calculations across layers.
- Important content types should use stable IDs and explicit typed relationships so gameplay, Master Panel editors, Codex/manual, AI, media, acquisition, analytics, and support can reference the same content identity instead of maintaining unrelated copies.
- Item definitions and owned item instances must be distinct concepts where needed. Static definition data should not be unnecessarily duplicated into every owned row; instance state should hold ownership, quantity, provenance, binding, charges/rolls where applicable, and player-specific flags.
- Combat Arts, Basic Attack profiles, combat items, scenario actions, AI legality, and item-granted actions should reuse the same typed targeting/requirement/effect grammar where practical rather than creating parallel battle rule engines.
- The reusable Effect Catalog should use typed primitives/triggers and controlled tags. Damage is a possible effect, not an assumption; non-damage strategic effects must be first-class.
- Do not create one enormous universal content JSON/table merely to centralize everything. Use domain-owned schemas with shared version/publish/reference conventions.
- Remove obsolete/dead/debug code when replacement is complete and safe. Do not leave abandoned branches, duplicate helpers, commented-out implementations, stray logs, or unused exports behind.
- Avoid unnecessary dependencies. Prefer maintained platform/framework capabilities or existing project libraries when they solve the problem cleanly.
- Use migrations for every database change.
- Database and network work must be bounded and intentional: avoid obvious N+1 queries, unbounded reads, redundant round trips, oversized payloads, duplicate subscriptions, and expensive client polling when a cleaner architecture exists.
- Keep client JavaScript/state/hydration no larger than necessary. Use small Client Component boundaries, derived state, and server-side work where appropriate rather than moving logic client-side for convenience.
- Progression curves, Horizon milestones, Wayfarer's Practice accrual/focus rules, Rested Momentum, item/effect/loot/loadout definitions, combat action/target/requirement definitions, combat-AI profiles/knowledge policies/intelligence grades/Tactical Records, terrain definitions/movement profiles, acquisition/visibility metadata, Rekindling rules, Veteran Edge definitions, event/urgency settings, lore Fragment Sets, documentation metadata, premium products, commerce-safe grant bundles, and other live-operated configuration should be data-driven/versioned where practical so the Master Panel can safely tune them later.
- Combat AI should reuse the authoritative combat engine's legality/range/path/effect/terrain/item rules rather than duplicating them in a second AI-only rules implementation. AI search must be bounded, deterministic under recorded versions/seeds where practical, and must degrade to a safe legal fallback rather than hanging a battle.
- Combat/item content must not permit arbitrary JavaScript/SQL entered in the Master Panel. Requirements and designer formulas should use typed/whitelisted validated grammars with bounded deterministic server execution.
- Loadout activation should be one authoritative atomic domain command rather than many independent client equip requests; saved loadouts should remain versioned/validated and active battles should use pinned build snapshots.
- Wayfarer's Practice should calculate elapsed offline progress lazily from authoritative timestamps rather than requiring continuous per-character background updates. Claims must be idempotent and atomically advance the claimed-through boundary so reconnects/retries cannot duplicate progression.
- Premium purchase records, provider references, fulfillment records, refunds/disputes, and entitlement provenance must be durable and auditable. Duplicate provider events/retries must not duplicate grants.
- Schemas should preserve provenance for loot/quest/vendor/crafting/marketplace/support/Owner/premium/internal item grants and for support/Owner-granted exceptional state where appropriate.
- TypeScript is the default application/game-service language and PostgreSQL/SQL is the authoritative relational data layer unless a documented architectural decision justifies another production language.
- New framework/runtime/compiler majors must be verified against current authoritative documentation and introduced deliberately through focused migration work rather than incidental gameplay tickets.
- Optimize meaningful bottlenecks with evidence where possible; do not trade readability for speculative micro-optimization.

## Narrative and live-world continuity

- The permanent character-building loop and the living-world story must reinforce each other.
- The central Aurevane mystery should unfold through fair foreshadowing, conflicting historical perspectives, player relationships, world events, and controlled story stages rather than an exposition dump.
- Lore must be discoverable through the world itself: documents, inscriptions, relics, environmental storytelling, NPC testimony, Archive Fragment Sets, events, Expeditions, and contradictory historical sources as defined in `docs/PROGRESSION_RETENTION.md` and `docs/LORE_BIBLE.md`.
- Do not reveal late-story secrets in early quests, public UI copy, item descriptions, art filenames, API payloads, logs visible to players, manual articles, premium product copy, Tactical Hall opponent catalogs, Codex catalogs, map data, or event metadata merely because the internal lore is known to the implementation agent.
- Story/world-event content should be data-driven and versioned where practical so long-running live narrative can evolve without routine code deployments.
- World-state changes should alter relevant presentation where practical—NPCs, ambience, markers, local-map state, weather, routes, props, dialogue—not merely add a generic notification badge.
- Reuse world rendering/navigation systems and environment kits, but do not carbon-copy important settlements or regions. Major places require their own authored spatial composition, landmarks, material/cultural identity, ambience, and meaningful activities.
- Battle scenes should derive coherently from world/encounter context where practical so combat does not feel disconnected from the place the player entered.
- Quest/key items must preserve story integrity: they should not be accidentally sellable/salvageable/discardable, and consuming or transforming a physical quest item must not erase Archive knowledge already legitimately learned.
- Do not make every system secretly originate from Aurevane. The world must remain larger than the central antagonist.

## Product experience and circular content integrity

- Every major player-facing page requires a clear player intent, primary action, authoritative data source, information hierarchy, visual focus, feedback/loading/error states, responsive behavior, accessibility plan, contextual-help impact, and media requirement appropriate to its scope. Use the Page Experience Contract in `docs/PRODUCT_EXPERIENCE_CONTENT_SYSTEM.md`.
- A page is not complete merely because the route renders or CRUD works. It should be clear, attractive, smooth, progression-aware, intentionally authored, and specific to its system/location.
- The game shell should keep persistent character context concise and give the primary experience—map, settlement, build, battle, Expedition, dialogue, marketplace, Tactical Hall—the majority of useful visual space rather than trapping gameplay inside heavy permanent chrome.
- The battle UI is board-first. Keep targeting, movement, objective state, concise actor state, turn order, forecast, Turn Economy Tracker, and action controls immediately readable; move deep logs/status/terrain detail into contextual inspection rather than permanent oversized sidebars.
- Inventory should present clear player-facing categories for Equipment, Consumables, Materials, and Quest/Key Items while remaining one coherent domain internally. The central Build/Armory surface should configure equipment, Arts, Traits/Reaction, Movement Art, Soulmark/Confluence, combat items, stats, and saved loadouts without forcing six disconnected database-like pages.
- World navigation should progress coherently from World Atlas → Region → Sector/Route/District → Settlement/Landmark/Wilderness → Activity/Encounter, while preserving location awareness and discovery state.
- Terrain is gameplay data, not decoration. Movement cost/profile interaction, hazards, cover/concealment, transformations, zones, AI valuation, and audiovisual feedback should use shared authoritative rules and clear previews where applicable.
- Use art-directed seeded variation only for secondary environmental detail. Never randomize critical landmarks, essential paths, interactable readability, or cultural identity merely to create superficial variety.
- Discovery, visibility, eligibility, ownership, equipment state, and mode availability are separate concepts. Do not send hidden/unreleased catalogs to the browser and rely on client-side hiding.
- The Master Panel should progressively become the authoring backbone for versioned content and eventually provide dependency/usage lookup, impact preview, content completeness validation, preview-as-player/test-character, publication/rollback, and analytics as underlying systems exist.
- Acquisition rules are first-class content relationships. When practical, player-facing known acquisition paths should render from authoritative rules rather than duplicated prose.
- Reuse technical components, data schemas, environment kits, and content frameworks aggressively; do not reuse identity so aggressively that villages, enemies, quests, maps, items, or pages become obvious reskins.
- AI assistance must never be treated as a quality waiver. Reject filler copy, generic fantasy naming, mechanically duplicate content, obvious generated-art defects, random lore padding, repetitive NPC voices, copy-paste settlement layouts, same-item-plus-5%-number filler, and UI generated only to make a page look populated.

## Combat system integrity

- Preserve the baseline combat grammar in `docs/COMBAT.md`: a Movement Budget plus one normal Action, with equipped Reactions and deliberately bounded exceptions. Do not add universal percentage Action Points or extra permanent combat resource bars by default.
- Movement Budget is derived from Movement and terrain/movement-profile rules; movement may be split before and after the Action unless the action/state explicitly prevents it.
- Basic Actions do not consume Art slots. The normal baseline includes Basic Attack, Guard, Wait, Interact when relevant, Use Item only when allowed, and End Turn. Do not add a universal free Heal action that erases build/recovery identity.
- Preserve the approved combat-loadout constraints: 4 Current Arts, 2 Legacy Arts, 2 Traits, 1 Reaction, 1 Movement Art, 1 active Soulmark, and resolved Confluence. Current Ultimate, Soulmark Signature, and Confluence Art use dedicated presentation slots when unlocked/available as defined in `docs/COMBAT.md`.
- Combat ability growth should use Discipline Mastery plus authored milestones/trials/discovery rather than reintroducing a generic JP-like skill currency. Core combat power should not be permanently missable, and high PvP rank must not be the sole path to core Discipline progression.
- Targeting is first-class typed data: target kind, shape, origin, range, line of sight, height, filters, friendly fire, selection stages, secondary-target policy, and preview behavior. Do not hard-code strings such as one-off `AOE_*` methods into UI components.
- Use requirements/costs/effects are separate concepts and should compose through typed server-authoritative definitions. A failed requirement should produce a useful reason when safe to reveal.
- Reactions use explicit triggers and deterministic priority. Most resolve automatically; manual response windows are exceptional and must be short, fair, accessible, and resistant to prompt spam.
- Cooldowns, charges, movement refunds, extra actions, timeline manipulation, resource refunds, and Reaction chains require explicit loop/cap safety. Generated actions must not casually generate infinite additional actions.
- Weapons, combat items, summons, battle objects, scenario interactions, item-granted actions, and AI actions should reuse the same targeting/effect/rule grammar rather than creating independent combat subsystems.
- PvE and PvP should share core action/item definitions. Explicit PvP overrides must be inspectable, versioned, tested, and player-documented where relevant rather than hidden copies of the ability/item.
- Combat scenes/maps require authored tactical identity, readable terrain/elevation/objectives, coherent world-linked background/art/audio, and deterministic validity. Reuse kits and systems, not the same meaningful map layout with a palette swap.
- Combat animation/audio should create anticipation and impact while restoring board readability quickly. Resolution animation must not consume the next player's PvP decision time.
- Battle commands submit intent, never authoritative outcomes. Pin relevant combat/content/item/AI/scenario/rules versions and RNG state so battles are reproducible enough for replay, support, simulation, and regression testing.

## Item, inventory, effect, and loadout integrity

- AUREVANE's player-facing inventory is categorized into Equipment, Consumables, Materials, Quest/Key Items, and later collection/relic views as justified; currencies remain authoritative ledgers rather than inventory stacks.
- Keep Item Definition separate from owned Item Instance/stack state where needed. Stable item IDs must connect inventory, loadouts, loot, vendors, quests, crafting, marketplace, Codex/manual, art/audio, analytics, AI, support, and Master Panel operations.
- Quest/key items are protected by default: non-destructive bulk actions must never include them, they ordinarily do not consume normal capacity, and quest rules explicitly define retain/consume/transform behavior.
- Every normal character has three saved combat loadout presets as a baseline feature once the dependent build systems exist. A preset can reference Current/Legacy Disciplines, Arts, Traits, Reaction, Movement Art, Soulmark/Confluence, equipment, and the allowed combat-consumable kit; presets are validated server-side and activated atomically.
- Missing/sold/retired items do not silently delete a saved preset. The preset remains visible with clear invalid/missing components; destructive item operations should warn when an item is used by a preset.
- Combat consumables come from a small pre-battle kit rather than unrestricted backpack access. Exact slot count is tuned later. Normal item use generally consumes the one normal Action unless the definition explicitly uses a bounded alternate Action Cost Class.
- The battle Turn Economy Tracker must show remaining Movement Budget, Action ready/spent state, Reaction readiness, MP, relevant Discipline resource, cooldown/charges, item quantity where relevant, and projected selected-action costs before commitment.
- Damage is a typed Effect primitive, not a mandatory tag on every item. Non-damage effects such as reveal, cleanse, shield, movement, displacement, terrain/zone creation, objective interaction, cooldown/resource manipulation, and tactical utility must be first-class.
- Item/equipment trigger effects use a controlled typed trigger/filter/effect grammar with deterministic ordering and loop guards. Do not expose arbitrary executable scripts to content staff.
- Equipment should create build choices through stats plus meaningful conditional/passive/granted-action interactions; reject effect soup and same-item-plus-small-number filler. A niche lower-rarity item may legitimately outperform a higher-rarity item in a specific strategy.
- Inventory capacity, if used, must be generous/player-friendly; key items are exempt, stackable categories compact cleanly, overflow/recovery protects important rewards, and paid storage must not be necessary for normal progression.
- Locked/favorite items and items referenced by loadouts are protected from careless bulk sell/salvage/discard flows. Multi-item mutations remain server-authoritative, transactional, and idempotent where appropriate.
- Durability is not universal by default. Only introduce item durability when a specific loop truly benefits; do not manufacture maintenance chores. Charges on consumables/devices are separate.
- PvP uses the same item definitions with explicit versioned Arena Tempering/mode overrides, consumable restrictions, and emergency disable rules where required. Do not maintain a duplicate PvP item catalog.
- Premium commerce must not sell superior equipment, stronger combat consumables, additional combat-item slots, more equipped actions, stronger action economy, or other item/loadout power advantages.

## Combat AI and training integrity

- Core production combat decisions should use bounded deterministic game logic—not remote generative-model/LLM calls. AI must choose only actions the authoritative combat engine declares legal.
- AI difficulty is separate from level, attributes, equipment, and other raw power. Higher intelligence should primarily improve candidate generation, tactical evaluation, lookahead, coordination, and risk management rather than grant hidden combat bonuses.
- Normal AI must obey its configured knowledge policy. It must not read future RNG, uncommitted player input, hidden private loadout state, unrevealed traps/stealth, or debug metadata that the encounter does not legitimately expose.
- AI behavior should be fair and learnable: strong enemies may adapt to observable battle-local patterns, but players should be able to recognize tendencies, counters, and tactical identities rather than fight an omniscient black box.
- Reuse a shared tactical framework with versioned behavior profiles rather than creating unrelated bespoke logic for every enemy. Boss phase directors may add authored rules while still using the same legality/fairness boundary.
- Team AI should coordinate according to enemy identity and intelligence grade without becoming globally omniscient. Disciplined squads may coordinate strongly; feral or disorganized enemies should not act like perfect military units unless their design says so.
- AI must understand equipped/item-granted actions and meaningful item/effect interactions through the same shared combat grammar; do not make AI ignore strategic equipment because it lives in a separate inventory subsystem.
- A new player starts with only basic weak Tactical Hall access. Stronger AI grades, enemy families, boss simulations, level/stat ranges, maps, and scenario records unlock through legitimate progression/Tactical Records and remain server-authorized/spoiler-safe.
- Practice mode must clearly separate AI Intelligence from Level/Attributes/Equipment and must not grant ownership of represented content.
- Normal custom practice battles are not a zero-risk progression farm: no repeatable normal XP/Mastery, loot, currency, PvP rating, boss/world clear, or event credit unless an explicit authored one-time training quest says otherwise.
- Boss/secret practice simulations must not reveal unreached phases, hidden mechanics, unreleased content, or late-story identities.
- Player-facing advanced practice access must not be sold as pay-to-win. Premium cosmetics may decorate a training space only when they provide zero tactical/preparation advantage.
- Practice Battle Review explanations should come from structured recorded decision reasons/telemetry rather than ungrounded invented explanations.
- AI versions and combat-content versions should be pinned/reproducible for battle replays and regression tests. Publishing a new profile must not silently change the brain in the middle of an existing battle.

## Retention, pacing, monetization, and competitive integrity

- AUREVANE intentionally uses time-limited live events, seasons, first-witness recognition, rotating encounters, community races, and other experiential urgency to make the world feel worth returning to.
- Retention pressure should primarily create "I wish I had been there" through world history, social participation, cosmetics, titles, discovery, and changing activity—not permanent competitive inferiority for missing a short window.
- Wayfarer's Practice should create a satisfying "come back and claim" loop through modest offline XP/Mastery and Rested Momentum while helping players who cannot play every day. It must remain secondary to active play, use a generous multi-day direct bank, and avoid destructive claim expiration or exact-hour login pressure.
- Offline Discipline practice may advance bounded Mastery progress but must not independently satisfy final mastery proofs/trials, Confluence discovery, story/world accomplishments, PvP rank, Expedition/boss clears, Horizon trials, endgame rites, or other achievements requiring actual play.
- Do not add mandatory daily energy, destructive login streaks, pay-to-avoid-loss mechanics, or one-time exclusive meta-defining combat power.
- The first full character journey must remain a minimum approximately six-month progression path under production defaults, but the duration should come from layered meaningful progression and live-world cadence rather than visible generic timers.
- Horizons are progression eras/milestone bundles first. Player-facing unlock explanations should emphasize accomplishments and requirements, not arbitrary day countdowns.
- A calendar-age floor, if retained at all, is an administrative pacing backstop rather than the primary progression mechanic.
- Repetitive low-risk grind should not be the optimal way to bypass the game's breadth. Reward varied skilled play, mastery challenges, world/story progress, Expeditions, and build development.
- Rekindling is a voluntary repeated long-form rebuild, not deletion of character identity/history and not a generic 180-day waiting loop.
- Veteran Edge may matter in PvP but must remain bounded, data-driven, non-stacking in standard play, measurable, disableable, and tunable from the Master Panel.
- Characters carrying gameplay-affecting exceptional Owner overrides should not silently enter standard ranked PvP unless the state is explicitly permitted/normalized.
- The normal premium shop must not sell levels, XP/Mastery boosts, superior equipment, stronger consumables, additional combat-item slots, exclusive meta-defining combat power, Veteran Edge power, ranked advantage, paid progression shortcuts, faster offline-training rates, larger offline-training banks, Rested Momentum multipliers, paid removal of Wayfarer's Practice ceilings, stronger Tactical Hall AI grades, unreached boss simulations, or faster Tactical Record unlocks.
- Premium monetization should focus on cosmetics, presentation, supporter goods, and account services that do not alter competitive power.
- Premium-store placement should be understated and non-intrusive, but not deceptive. Do not use aggressive popups, fake badges, fake scarcity, hidden real prices, or casino-like paid-random-reward design.
- Paid cosmetics must preserve tactical readability; ranked modes may normalize or suppress confusing premium presentation when needed.

## Owner / Master Panel direction

- The Owner is the highest game-operations authority and must eventually be able to operate, rebalance, publish, repair, monetize, and delegate the live game through `/master`.
- The Owner must be able to grant/revoke staff roles, granular permissions, special account capabilities/entitlements, and perform audited player corrections through authoritative domain commands.
- The protected Owner must also be able to deliberately grant things that were not earned, bypass normal eligibility/acquisition rules, grant hidden/retired/internal registered content where safe, create exceptional test/event/support states, and use narrowly modeled Break-Glass God Mode actions as defined in `docs/OWNER_OVERRIDE.md`.
- Progression, Horizon pacing, XP/Mastery curves, Wayfarer's Practice accrual/focus/caps, Rested Momentum, item/effect/loot/loadout/acquisition definitions, combat actions/targeting/requirements/statuses/terrain/maps/scenarios and their dependencies, combat-AI profiles/Tactical Records/AI benchmark settings, retention/event cadence, Rekindling, Veteran Edge, PvP queue rules, lore discovery/reveal thresholds, economy/content configuration, premium product catalog/pricing/publication, payment operations, commerce analytics, manual publication, and player support/override corrections must all be planned for Master Panel control as their systems are implemented.
- The complete Master Panel should include a protected **Combat Content Studio** for authorized Art/Reaction/Movement/Ultimate/weapon/status/terrain/map/scenario authoring, visual targeting preview, requirement/effect-stack validation, test-character launches, impact preview, staged publication, rollback, emergency disable, and combat analytics as defined in `docs/COMBAT.md`.
- The complete Master Panel should include a protected **Item Studio / Effect Catalog** for authorized item/equipment/consumable/key-item definitions, effect triggers, action targeting/costs, loot/acquisition links, sets, PvP overrides, visual target preview, test equip, power-budget warnings, dependency/impact preview, staged publication, retirement/migration, rollback, emergency disable, and item/loadout/effect analytics as defined in `docs/ITEMS_INVENTORY_LOADOUTS.md`.
- The complete Master Panel should include a protected **Combat AI Lab** for authorized profile inspection/editing, staged version publication, rollback, unrestricted QA simulations, AI-vs-AI, deterministic seed replay, batch matchup tests, benchmark suites, and decision/performance analytics.
- The complete content-operations surface should eventually show where a content object is used, what depends on it, what player-facing/manual/media surfaces it affects, and what safe migration/rollback is required before destructive retirement or incompatible publication.
- Normal Premium Commerce publication should accept only commerce-safe product grants. The Owner's separate override authority does not mean the store itself should become a convenient pay-to-win pipeline.
- The Owner must eventually be able to disable premium checkout globally or per provider/product, inspect transactions, reconcile captured-but-unfulfilled purchases, manage refunds/disputes where supported, and review commerce audit/analytics.
- Warnings should inform high-risk Owner actions, not silently remove Owner authority. Hard integrity constraints still require a representable safe state.
- Staff receive least privilege. Owner actions are audited too.

## Manual and player-help quality

- AUREVANE must maintain a comprehensive, attractive, searchable, spoiler-safe manual as a first-class product feature.
- Complex systems should use progressive disclosure: quick answer, practical guide, and deep mechanics.
- Contextual help should link from the game UI to exact relevant manual sections.
- Official terminology and glossary definitions must remain consistent across UI, tutorial, manual, and error messages.
- Where practical, render exact current requirements/rules from authoritative structured game configuration rather than duplicating numbers manually.
- Combat documentation must explain Movement Budget/Action economy, targeting shapes, range/LoS/height, facing, terrain, statuses, Reactions, cooldowns/charges, initiative, friendly fire, objective actions, loadout constraints, Art acquisition/Mastery, and mode-specific PvP rules with visual examples where useful.
- Item/inventory documentation must explain item categories, equipment slots, consumable kit, protected key items, Effect Catalog concepts, action cost/targeting for active items, binding/trading, known acquisition, overflow/recovery, and three saved loadouts without exposing hidden/unreleased item definitions.
- The Codex/known-content catalog should be discovery-aware and should cooperate with the explanatory manual rather than becoming a public dump of unreleased/hidden content.
- Wayfarer's Practice documentation must clearly explain focus selection, accrual/caps, Training Reports, Rested Momentum, what can/cannot progress offline, Mastery ceilings, and the absence of paid progression acceleration.
- Tactical Hall documentation must explain Tactical Record unlocks, AI Intelligence versus level/stats, practice reward isolation, repeatable seeds, Battle Review, boss/spoiler restrictions, and the fact that stronger AI obeys the same encounter information/rules boundary rather than secretly cheating.
- Premium commerce documentation must clearly explain the shop location, no-pay-to-win philosophy, account/character ownership scope, purchase history, refund/support path, and missing-purchase troubleshooting without aggressive marketing.
- Every implementation ticket that introduces or materially changes a player-facing mechanic must include a `DOCUMENTATION IMPACT` section identifying manual/contextual-help/glossary/visual/staff-operations updates.
- Major features are not polished-complete until required manual content is correct, readable, attractive, accessible, and spoiler-safe.
- Staff/Owner operational documentation must remain protected from public players.

## Media and originality

- Art, music, SFX, ambience, and visual presentation are first-class product requirements.
- Production gameplay must not depend directly on a specific AI-generation model. AI-generated media requires review and approval before production use.
- AI-assisted output is not production-ready merely because it exists. Reject obvious generated defects, generic concept-art haze, filler environments, repeated identities, mechanically meaningless content, and unreviewed copy as defined in the Art Bible, Media Pipeline, and `docs/PRODUCT_EXPERIENCE_CONTENT_SYSTEM.md`.
- Important locations and battle scenes should reuse approved environment systems/kits while retaining unique authored composition, landmarks, culture, texture/material treatment, ambience, tactical identity, and visual storytelling.
- Important weapons, Legendaries, quest relics, and signature consumables should receive deliberate readable item art/audio appropriate to importance; common materials can use efficient approved art kits without placeholder slop.
- Do not copy proprietary game code, copyrighted characters, lore, dialogue, music, art, maps, or other protected content.
- `https://www.theninja-rpg.com/` may be used only as an abstract presentation/UX/game-system quality benchmark. Never copy its implementation, assets, wording, characters, setting, exact combat economy, effect taxonomy, exact targeting taxonomy, inventory layout, or proprietary UI.

## Verification and handoff

- After code changes, run relevant type checks, linting, tests, and build checks as required. Never claim completion when checks fail.
- Before finalizing a coding ticket, perform the cleanup/efficiency review defined in `docs/ENGINEERING_EXECUTION_STANDARD.md`: remove dead/debug code, verify no unnecessary duplication/dependencies/churn were introduced, and review database/network/client work for obvious waste.
- Tests should be deterministic and readable; flaky tests are defects, not acceptable background noise.
- Major player-facing page/world/content tickets must include a product-experience review appropriate to scope: Page Experience Contract, authoritative data-source review, responsive/accessibility states, loading/error/empty/locked states, media/documentation impact, and a check for generic duplicated/filler content.
- Content publication/editor tickets must test relationship validation, server-authorized visibility/discovery, versioning/rollback behavior, and dependency/impact safety appropriate to the implemented scope rather than relying on client-side hiding or disconnected copies.
- Combat tickets must test the applicable movement budget/path/terrain/elevation rules, action/requirement/cost authority, targeting shapes/range/LoS/filters/friendly-fire, effect order, status/cooldown/Reaction behavior, deterministic transformations, command/version/idempotency behavior, reconnect/version pinning, and board/forecast correctness. Do not accept a combat feature because only its happy-path animation works.
- Item/inventory/loadout tickets must test ownership/quantity authority, item-definition/instance boundaries, equip/unequip atomicity, loadout activation/versioning, key-item protections, locked/favorite/loadout destructive-action safeguards, stack/overflow behavior, effect trigger/loop safety, combat-item action cost/targeting/consumption, loot/acquisition idempotency, and PvP restrictions appropriate to scope.
- Battle-map/scenario tickets must test spawn/objective reachability, invalid isolated states, authoritative object/terrain references, side bias where relevant, performance/readability, and deterministic versioning appropriate to scope.
- Combat-AI tickets must test legal-action enforcement, determinism/version/seed behavior, configured knowledge boundaries, fallback safety, representative tactical regressions, and decision-performance budgets appropriate to the ticket. Tactical Hall tickets must additionally test server-authorized unlocks, spoiler gating, level/stat configuration legality, reward isolation, and repeat/retry behavior.
- Offline-progression tickets must test authoritative elapsed-time calculation, cap boundaries, focus changes, Mastery ceilings, idempotent claims, reconnect/retry behavior, long-absence cases, and the absence of unintended economy output appropriate to the ticket.
- Payment/commerce tickets must test authoritative pricing, webhook verification behavior, idempotency/double-delivery protection, fulfillment recovery, authorization, and sandbox provider flows appropriate to the ticket before production payment enablement.
- Clearly report every manual action the project owner must perform, explaining required steps plainly because the owner is a beginner programmer.
- For each completed implementation ticket, summarize what changed, tests run, required manual actions, documentation impact, cleanliness/efficiency review, and recommend a Git checkpoint.