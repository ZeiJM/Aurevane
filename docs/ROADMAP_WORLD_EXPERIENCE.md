# World experience — reference review delivery contract

**Status:** Owner-authorized roadmap scope, 2026-09-25. Implementation and acceptance remain open.

**Authority:** `ROADMAP.md` owns phase sequence; `PHASE_5_TICKETS.md` and `TASKS.md` own active work. This companion refines `LIVING_ATLAS_EXPANSION.md`, the current supernatural authority in `SUPERNATURAL_PATHS.md`, and current combat/build rules. It does not replace them.

## Intent and phase boundary

The Owner reviewed The Ninja RPG and Veilbound: Sien Archives to improve Aurevane's travel, maps, identity and usability. Desired outcome: faster everyday movement, a world that eventually feels continuous to walk through, recognizable authored places, and understandable character powers. Retain useful differences rather than rebuilding systems Aurevane already handles well.

Phase 5 takes bounded improvements to the existing Atlas, existing location interactions and the representative supernatural fork. Phase 6 owns the continuous multi-sector rendering foundation and mechanic-based Skill discovery. Phase 7 scales traversal into expeditions/frontier. Phases 8–12 deepen clarity, content and belonging within their existing mandates. Functional usability is not deferred to Phase 14 art polish.

The Owner authorized moving the bounded map/identity work into Phase 5. This explicitly permits tuning **ordinary overworld travel pace**, subject to the authority and encounter safeguards below. It does not authorize changing combat movement/AP, Passive Training timers, rewards, discovery eligibility, maritime traversal or frontier rules.

## Current baseline and concurrency

At planning baseline `42953429b0ba61b0529bc09e5c4728cceef71be3`:

- The Atlas already has charted destination search, routes, ETA, stop controls, server-owned movement, discovery and local interactions. Extend those implementations.
- `world/catalog.ts` has a 1,100 ms default **and eight authored road-sector overrides at 4,000 ms**. Looking only at `STEP_MS` understates actual travel delay. Trace all effective durations and the authoritative tick/encounter path before tuning.
- The expansion contract already requires distinct regional layouts and matching v02 art, gentle visible motion, stable globe framing and authored adjacent gates. New work must credit delivered slices rather than recreate them.
- Ordinary authored Skills and Essence use consecutive-use effectiveness at unchanged AP cost, not ordinary turn cooldowns. Preserve four selected Techniques and the pure/mixed contract. Reference-game cooldowns are not an Aurevane requirement.
- Use **Ascension, Severence, Ascended and Severed**, following the newer Master Plan and `SUPERNATURAL_PATHS.md`; do not restore retired Soulmark/Mantle terminology from older subordinate text.

Open work observed during planning includes #681 (settlement geometry held for matching art), #712/#715 (crossings/wilderness), #718/#719 (Anchor discovery/presentation), #720/#729 (Drift resolver/ledger), and #728 (PC music upload regression). These are discovery pointers, not permanent merge/status claims. Refresh main, each relevant PR head and the active Phase 5 branch before editing. Do not merge entire stacks merely to obtain a UI improvement; preserve their dependencies and existing verification.

## Phase 5 — execute now in bounded slices

### P5-W1 — Ordinary travel pace and responsiveness

**Outcome:** everyday movement is noticeably quicker while authoritative position, encounters and ETA remain trustworthy.

1. Trace UI intent → handler/service → route/tick → persistence/locking → encounter guards → projection/rendering. Record effective local, road and crossing durations, including per-sector overrides; check whether the deployed version differs from the active candidate.
2. Measure a short settlement route and a settlement–road–settlement journey before changing pace. Separate authored waiting, request latency and visual update delay. Record route step count and elapsed/server ETA, not an unsupported comparison with Ninja.
3. Tune ordinary road/local travel through existing authoritative configuration. Initial candidate: bring ordinary 4-second road cells toward the existing 1.1-second walking baseline unless a specific authored hazard requires a longer duration. This is a candidate to validate, not a claimed final balance. Keep intentional exceptional travel costs explicit.
4. Keep one source for route duration and ETA. Check persisted routes after timing changes: safely revalidate/replan or stop with understandable feedback; never continue a stale-duration route silently.
5. Improve visible movement through interpolation if needed, honoring motion-off/reduced-motion. Animation never commits authoritative arrival or enables interactions early. Do not solve smoothness by hammering the server with per-frame requests.
6. Investigate overdue steps and browser-background behavior, but do not introduce unbounded offline auto-travel/catch-up as an incidental optimization. If changing advancement semantics requires a wider encounter/persistence redesign, deliver safe duration/presentation improvements first and record the exact dependency under P6-W1.

**Acceptance:** before/after timings for both representative routes; route ETA corresponds to the configured journey; first step waits its full authoritative interval; repeated/replanned commands cannot accelerate movement; stop/reconnect and stale-route behavior work; due movement versus attack and concurrent/retried commands retain existing protections; hidden cells and frontier gates remain protected. Server/DB/browser evidence must match the final candidate. A faster animation alone does not satisfy this ticket.

### P5-W2 — Globe/local navigation coherence

**Outcome:** the player can tell where they are, what they selected and what happens next.

- Keep the current player and selected destination distinct. Preserve the destination and route context when switching existing globe/local views; recenter remains explicit.
- Reuse charted-sector search/index. Provide plainly labeled view/focus and travel actions; merely inspecting a destination must not move the player or spend anything.
- Present authoritative route availability and ETA before starting where feasible within the current flow. Explain a blocked/no-known-route result without revealing hidden content.
- Retain local location names, meaningful landmarks, nearby actions and objective guidance. Do not make coordinates or internal sector IDs the primary location identity.
- Verify existing globe framing/rim-safe label work at desktop, laptop and mobile. Prioritize player/destination/important labels; prevent overlap, cropping and color-only meaning. Add marker toggles only where actual clutter warrants them, not a new overlay framework.
- Preserve accessible keyboard selection, focus and touch targets, loading/error states and reduced-motion behavior. Do not replace the renderer or require a new WebGL dependency in this slice.

**Acceptance:** inspect a charted location without travel; deliberately start a valid journey; reject inaccessible travel; cancel and reload; keep player/destination legible across scale/view changes; keyboard and mobile flows work; no hidden name/terrain/objective enters unauthorized payloads.

### P5-W3 — Places with identity and contextual actions

**Outcome:** existing towns and landmarks feel authored and their available actions are apparent.

- Complete the existing eight-settlement identity contract through staged reviewed work. Geometry, paths, safe zones, service positions and v02 art must agree; preserve #681's matching-art gate until satisfied.
- Use each region's approved silhouette and terrain/path grammar from `LIVING_ATLAS_EXPANSION.md`. Do not add lore, settlement names or copied reference art to manufacture variety.
- Add or refine a compact selected/current-location summary: public name, short approved purpose/atmosphere, relevant service or objective, and clear next action. Reuse current interaction/quest authority and existing panels.
- Existing eligible services should expose appropriate actions such as inspect, speak, enter or continue objective. Show unavailable actions honestly; server location/eligibility checks still decide execution.
- Keep map space usable: do not duplicate the persistent character rail or impose another oversized sidebar. Reuse approved art/media; missing required paintings become tracked media work and remain open rather than counting placeholders as complete.
- Verify gentle environmental movement in ordinary viewing, plus motion-off/reduced-motion, without distracting from routes or controls.

**Acceptance:** the representative town–road–town journey presents distinguishable places and truthful context actions; remote/stale action attempts cannot bypass location checks; eight regional compositions/art remain tracked to completion; inspect screenshots at supported sizes. One corridor is a delivery slice, not evidence all eight towns are done.

### P5-W4 — Existing character/supernatural identity clarity

**Outcome:** players understand their current identity and the representative Phase 5 fork before and after commitment.

- Reuse authoritative Profile/world projections for Primary/Secondary Discipline and applicable Essence/Resonance. Improve hierarchy/help only where current presentation leaves a real gap; keep build editing in Profile.
- As the existing representative Ascension and Severence proofs become available, show their authored identity, strengths, constraints, eligibility and permanent branch consequence. Distinguish current, available and undiscovered states without exposing hidden catalogs.
- Render actual costs, timing/duration/recovery and counterplay only where defined. Do not invent a transformation, resource, weakness or counter-command for symmetry with a reference game.
- Explain the permanent choice and keep deliberate confirmation within the existing authorized story flow. Server-owned branch exclusivity, expected-version writes, idempotency and spoiler gates remain mandatory.
- If power definitions or approved story content are absent, deliver current identity clarity and record the precise content dependency. Do not fabricate mechanics or label W4 complete based on an empty card.

**Acceptance:** Unawakened, eligible choice, Ascended and Severed states are clear; unavailable content stays private; permanent choice cannot be replayed or switched through UI/state forgery; shared facts come from the same published/versioned definitions as gameplay. Normal players never acquire Owner-only Anomalies.

### Phase 5 ownership — two active chats

The Owner requested a separate Work Mode chat for layout/presentation. The handoff split below takes precedence over treating W1–W4 as one chat's implementation queue.

| Owner | Scope | Boundary |
| --- | --- | --- |
| Existing Phase 5 implementation chat | W1 authoritative durations, route/ETA compatibility and movement/encounter tests; W3 authored sector geometry, connections and existing content/interaction contracts; W4 story/power definitions, eligibility and safe public projection within approved canon. | Exclude layout, CSS, globe/camera rendering, location/identity card UI and visual asset production. Preserve ongoing music upload, Anchor/Drift and other authorized work. |
| Separate Work Mode presentation chat | W1 client movement presentation if warranted; W2 map/globe navigation and layout; W3 location cards, approved v02 art/geometry alignment and environmental presentation; W4 Profile/fork identity presentation using available authority. | No timing constants, movement legality, persistence/rewards, power rules, branch exclusivity, new canon or whole-world renderer rewrite. Identify missing data/contracts and coordinate rather than create parallel authority. |

Both chats inspect current main/open PRs and record their branch and file ownership in their normal handoff. UI and server share one agreed public projection; do not independently edit shared types or introduce competing endpoints. Sequence any required shared-contract change explicitly. The presentation chat must inspect the authoritative geometry candidate before painting, and the geometry candidate retains the matching-art merge gate. If either side lacks its dependency, name it and complete independent in-scope work; do not mark the integrated ticket accepted early.

### Phase 5 order and exit evidence

Finish a currently active atomic slice before switching. Reconcile W1–W4 against current implementation; implement only missing deltas. Preferred next order: W1 pace → W2 navigation → W3 location/art delivery → W4 alongside the existing fork proof. Independent media work may proceed under the session's existing authorization, but do not spawn new work or overwrite another chat's branch solely because this document exists.

For each ticket, record changed behavior, exact candidate, tests, browser/visual checks, measured result where applicable, and outstanding dependency in the normal task ledger. Keep unchecked until its criteria pass. Preserve the active PC music upload and other Phase 5 commitments. This scope does not authorize Preview/Production deployment or remote migrations; use the existing explicit release gate.

## Phase 6 — continuous traversal and practical discovery

### P6-W1 — Continuous local world surface

Keep internal sectors/chunks but render adjacent authorized terrain in one persistent surface, with camera follow, route continuity and no sector menu/loading-room transition at ordinary authored crossings. First proof: three connected known-world areas using completed reciprocal gates and geographically compatible boundaries.

Align roads, rivers, walls, scale and entry coordinates. Do not invent adjacency across cliffs/water or flatten frontier thresholds into ordinary walking. A rolling neighborhood is a reference pattern, not a mandatory 3×3 implementation. Choose bounded rendering/prefetch after profiling. Reuse Phase 5 position/routes; do not replace the authoritative travel system.

**Gate:** uninterrupted three-area walk, correct obstacles/crossings, stop/reconnect, authoritative encounter boundary, bounded data/render work, no private-discovery leakage, and responsive/reduced-motion behavior. Then integrate party pings/shared route context without granting control over another character. Scale after evidence, not before.

### P6-S1 — Skill discovery and shared factual summaries

Extend the existing Manual/Discipline/build browser with useful facets: effects, Discipline, target, range, actual resource/AP costs, eligibility and current-build compatibility. Add include/exclude conditions where they materially help. Clearly state within-facet any/all and across-facet combination behavior; show selected filters, clear/reset, empty results and public acquisition/requirement explanations.

Derive player-readable tags from canonical published structured content; no independently authorable presentation-tag catalog. Use the same factual summaries in discovery, loadout and battle inspection. Respect private/unpublished content, version-pinned combat, four-Technique selection and pure/mixed rules. Show repeat-use effectiveness and reset conditions accurately; do not import ordinary turn cooldowns or simultaneous combat from either reference.

**Gate:** a player can find an eligible support/control option for their build, explain its target/cost/effect timing, and understand why a locked choice is unavailable. Filters agree with authoritative definitions and never make an illegal loadout selectable.

## Phases 7–12 — carry forward rather than rebuild

| Phase | Required continuation | Acceptance focus |
| --- | --- | --- |
| 7 — Expeditions/frontier | Scale P6-W1 to longer routes, hazards, resumable exploration and authorized discovery. Preserve persistent Anchors and deterministic authored Drift. | No skipped hazards/encounters on delayed updates; valid resume after content/version changes; bounded streaming; deliberate unknown-territory transition. |
| 8 — Competitive PvP | Audit shared effect summaries, repeat-use penalties, target legality, onset/expiry and action-result explanations against committed battle versions. | Participant/spectator privacy; understandable legal choices; accurate logs/forecasts; no invented cooldowns or changed combat model. |
| 9 — Content expansion | Expand Skill facets and identity explanations with actual new Discipline/Essence/Resonance/Ascension/Severence content. | Published rules and UI agree; clear strengths/tradeoffs and defined counterplay; no redundant supernatural tree. |
| 10 — Social/explorer identity | Extend profiles/Chronicle and existing guild plans with meaningful deeds, public representatives/locations where authored, and clear affiliation context. | Privacy and provenance; public faction and player guild remain distinct; recognition reflects actual accomplishments. |
| 12 — Nations | Introduce approved groups through values, obligations, named authored representatives and map-linked places before commitment. | Deferrable introduction; transparent commitment; membership never silently respecs a build or locks essential competitive power. |

## Evidence and exclusions

Ninja evidence: authenticated travel controls and tested shield filtering; Owner screenshots of local map and globe; saved Core 4 source showing neighboring-sector rendering/path/camera continuity. The review browser could not render Ninja's WebGL map. Its speed advantage is Owner feedback, not a timed benchmark. Screenshots show useful geographic context and also label overlap; do not copy the clutter.

Veilbound evidence: authenticated live Travel, Profile, Field Info, Battle Loadout, Clan recruitment and Inventory. A destination was selected without moving. Its named illustrated districts, effect timing summaries, and faction values/representatives are useful. Public combat screenshots are explicitly illustrative previews, and live balance/combat were not tested. No movement, battle, purchase, faction commitment or loadout mutation was initiated by the review.

Reference URLs: <https://www.theninja-rpg.com/travel>, <https://www.theninja-rpg.com/manual/jutsu>, <https://veilbound-sien-archives.app/play>, <https://veilbound-sien-archives.app/gameplay>.

Exclude copied code/assets/lore, copied balance numbers, hex-grid conversion, a new combat model, a new hereditary/Field/transformation system, mandatory daily chores, paid streak recovery and whole-economy/inventory replacement. Keep Phase 5 bounded; the continuous renderer, larger Skill discovery work and new social/nation systems remain in their designated later phases.
